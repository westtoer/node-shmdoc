/*jslint node: true */
/*jslint es5: true */
/*jslint nomen: true */

"use strict";

var fs = require('graceful-fs'),
    https = require('https'),
    csv = require('csv'),
    path = require('path'),
    moment = require('moment'),
    RUNTIME = moment().toJSON(),
    TYPES = ['boolean', 'date', 'time', 'datetime', 'integer', 'number', 'text'],
    TYPENDX = TYPES.reduce(function (s, t, i) { s[t] = i; return s; }, {}),
    BOOLEANREPS = ["true", "false", "0", "1"];

function isEmpty(obj) {
    return (obj === null || obj === undefined || (obj.hasOwnProperty('length') && obj.length === 0));
}

function contains(container, item) {
    return (container.indexOf(item) !== -1);
}


function testBoolean(v) {
    return contains(BOOLEANREPS, String(v).toLowerCase());
}
function testDateTime(v) {
    return (moment(v, [moment.ISO_8601], true).isValid());
}
function testTime(v) {
    return (moment(v, ['HH:mm:ssZZ'], true).isValid());
}
function testDate(v) {
    return (moment(v, ['YYYY-MM-DD'], true).isValid());
}
function testIntegerNumber(v) {
    var n = Number(v);
    return Math.floor(n) === n;
}
function testNumber(v) {
    var n = Number(v);
    return !isNaN(n) && String(n) === v;
}
function guessType(value) {
    // try bool
    if (testBoolean(value)) {
        return 'boolean';
    } //else try datetime
    // try date
    if (testDate(value)) {
        return 'date';
    } //else try datetime
    if (testTime(value)) {
        return 'time';
    } //else try datetime
    if (testDateTime(value)) {
        return 'datetime';
    } //else try number
    if (testNumber(value)) {
        // try int/long
        if (testIntegerNumber(value)) {
            return 'integer';
        }
        return 'number';
    } //else assume text
    return 'text';
}

function fallBackType(et, nt) {
    if (et === undefined) {
        return nt;
    }
    return TYPES[Math.max(TYPENDX[et], TYPENDX[nt])];
}

function SchemaDoc() {
    this.hideLevels = 1;
    this.count = {errors: 0, newfields: 0};
}

SchemaDoc.prototype.setHideLevels = function (num) {
    this.hideLevels = num;
};

SchemaDoc.prototype.setBase = function (newbase) {
    this.base = newbase;
    var me = this;

    //initialize refKeys after loading
    //force learnable if type is unknown
    this.refKeys = [];
    Object.keys(this.base).forEach(function (k) {
        var fd = me.base[k];
        if (!contains(TYPES, fd.type)) {
            fd.type = undefined;
            fd.learnable = true;
        }
        if (fd.type === "integer"  || fd.type === "number") {
            fd.min = Number(fd.min);
            fd.max = Number(fd.max);
        }
        if (fd.isReferenceToKey) {
            me.refKeys.push(fd.key);
            me.base[fd.isReferenceToKey].isReferenceable = true;
        }
    });
};

function handleJSONBaseData(strm, cb) {
    var data = "", error = false;
    strm.on('data', function (chunk) { if (!error) { data += chunk; } })
        .on('end', function () { cb(error ? {} : JSON.parse(data)); })
        .on('error', function (err) { if (err) { error = true; console.error(err); } });
}

function handleCSVBaseData(strm, cb) {
    var newbase = {}, error = false;

    function ifNotEmptyBool(testval, defval) {
        defval = defval || false;

        if (testval === "" || !testBoolean(testval)) {
            return defval;
        } // else
        return contains(["false", "0"], testval.toLowerCase()) ? false : true;
    }

    function ifNotEmpty(testval, nullval, setval) {
        setval = setval || testval;
        return testval === "" ? nullval : setval;
    }

    function mapcsv(data) {
        var key = data.key, fd = {key: key};

        fd.learnable = ifNotEmptyBool(data.learnable, false, !!data.learnable);
        fd.type = !contains(TYPES, data.type) ? undefined : data.type;
        fd.format = ifNotEmpty(data.format);
        fd.example = ifNotEmpty(data['example-value']);
        fd.min = ifNotEmpty(data['min-value']);
        fd.max = ifNotEmpty(data['max-value']);
        fd.minlen = ifNotEmpty(data['min-len']);
        fd.maxlen = ifNotEmpty(data['max-len']);
        fd.created = ifNotEmpty(data.created, RUNTIME);
        fd.updated = data.updated;
        fd.isReferenceToKey = ifNotEmpty(data.isReferenceToKey);
        fd.isReferenceable = ifNotEmptyBool(data.isReferenceable);
        fd.list = ifNotEmpty(data['value-list'], undefined, data['value-list'].split('|'));

        // don't load any of the errors.
        // don't load the counts

        newbase[key] = fd;
    }

    function onerr(err) { if (err) { error = true; console.error(err); } }

    strm.pipe(csv.parse({ delimiter: ',', columns: true }))
        .pipe(csv.transform(mapcsv, onerr))
        .on('end', function () { cb(error ? {} : newbase); })
        .on('error', onerr);
}

function handleBaseData(type, strm, cb) {
    if (type === 'json' || type === 'application/json') {
        return handleJSONBaseData(strm, cb);
    }
    if (type === 'csv' || type === 'text/csv') {
        return handleCSVBaseData(strm, cb);
    }
    console.error("can't decide how to handle type == %s", type);
    return cb({});
}

SchemaDoc.prototype.loadBase = function (basePath, done) {
    var me = this;

    function onLoad(newbase) {
        me.setBase(newbase);
        done();
    }

    if (basePath.indexOf('http') === 0) { // web reference to download base
        https.get(basePath, function (response) {
            handleBaseData(response.headers['content-type'], response, onLoad);
        }).on('error', function (err) {
            console.error("error trying to download shmdoc-base from %s", basePath);
            done(err);
        });
    } else { // assume file location locally
        if (fs.existsSync(basePath)) {
            handleBaseData(path.extname(basePath).slice(1), fs.createReadStream(basePath, 'utf8'), onLoad);
        } else {
            console.error("can't open base %s does not exist", basePath);
            onLoad({});
        }
    }
};

SchemaDoc.prototype.learn = function (fPath, cb) {

    if (isEmpty(fPath) || !fs.existsSync(fPath)) {
        console.error("missing learning file at %s", fPath);
        return cb("no file at " + fPath);
    }

    // derive file type from the file extension
    var ext = path.extname(fPath).slice(1),
        learner = SchemaDoc.learners[ext];

    if (!learner) {
        console.log("no implementation for %s - can't proces %s", ext, fPath);
        console.log("known formats limited to %j", Object.keys(SchemaDoc.learners));
        return cb("no learner for extension " + ext);
    }

    learner.call(this, fPath, cb);
};

SchemaDoc.prototype.traverseValue = function (pathelms, d, cb) {
    var me = this, t = Object.prototype.toString.call(d), p = pathelms;

    if (t === "[object Array]") {
        // handle array
        p = pathelms.slice(0);
        p.push("*");
        d.forEach(function (i) {
            me.traverseValue(p, i);
        });
    } else if (t === "[object Object]") {
        // handle object
        Object.keys(d).forEach(function (k) {
            var v = d[k];
            p = pathelms.slice(0);
            p.push(k);
            me.traverseValue(p, v);
        });
    } else {
        this.learnKeyValue(p, d);
    }

    if (cb) {
        cb();
    }
};

SchemaDoc.prototype.learnFromJSON = function (fPath, cb) {
    var me = this, data = "", error = false;
    fs.createReadStream(fPath, { encoding: "utf-8" })
        .on('data', function (chunk) { if (!error) { data += chunk; } })
        .on('end', function () { if (!error) { me.traverseValue([], JSON.parse(data), cb); } })
        .on('error', function (err) { if (err) { error = true; console.error(err); } });
};

SchemaDoc.prototype.learnFromCSV = function (fPath, cb) {
    var me = this, delim = ',', lines = [], line = 1;

    fs.createReadStream(fPath, { encoding: "utf-8" })
        .on('error', function (err) {
            console.error("ERROR reading file %s: %s", path, err);
        })
        .on('end', function () {
            me.traverseValue([], lines, cb);
        })
        .pipe(csv.parse({
            delimiter: delim,
            columns: true
        }))
        .pipe(csv.transform(
            function (data) {
                line += 1;
                lines.push(data);
            },
            function (err, data) {
                if (err !== null && err !== undefined) {
                    console.error("ERROR processing line %d data %j in file %s: %s", line, data, path, err);
                }
            }
        ));
};

SchemaDoc.learners = {
    json: SchemaDoc.prototype.learnFromJSON,
    csv:  SchemaDoc.prototype.learnFromCSV
};
//  http://stackoverflow.com/questions/10221229/list-all-keys-and-values-of-json
//  http://stackoverflow.com/questions/9064951/how-to-get-xpaths-for-all-leaf-elements-from-xml

SchemaDoc.prototype.fieldDoc = function (pathelms) {

    this.base = this.base || {};
    var key, fd, cnt;
    for (cnt = 0; cnt < Math.min(this.hideLevels, pathelms.length - 1); cnt += 1) {
        pathelms[cnt] = "*";
    }
    key = pathelms.join('.');
    if (!this.base.hasOwnProperty(key)) {
        this.count.newfields += 1;
        fd = {
            key      : key,
            learnable: true,
            created      : RUNTIME
        };
        this.base[key] = fd;
    } else {
        fd = this.base[key];
    }
    return fd;
};



function isNewValueAdd(arr, value) {
    if (contains(arr, value)) {
        return false;
    } //else
    arr.push(value);
    return true;
}


SchemaDoc.prototype.addErrorValue = function (fd, type, value) {
    this.count.errors += 1;
    fd.errors = fd.errors || {};

    var errarr = fd.errors[type] || [];
    fd.errors[type] = errarr;

    if (!contains(errarr, value)) {
        errarr.push(value);
    }
};

SchemaDoc.prototype.learnKeyValue = function (pathelms, value) {
    var fd = this.fieldDoc(pathelms), type, len = String(value).length;

    fd.count = fd.count || {used: 0, empty: 0, bytype: {} };

    // count use and emptyness
    fd.count.used += 1;
    fd.updated = RUNTIME;

    if (value === undefined || value === null || String(value).trim().length === 0) {
        fd.count.empty += 1;
        fd.nullable = true;
        return;
    }

    //else
    fd.example = fd.example || value;

    type = guessType(value);
    if (fd.count.bytype[type] === undefined) {
        fd.count.bytype[type] = 1;
    } else {
        fd.count.bytype[type] += 1;
    }
    type = fallBackType(fd.type, type);
    if (type === "integer" || type === "number") {
        value = Number(value);
    }

    if (fd.learnable) { // ok no sweat - this is new stuff we don't know anything about
        fd.type = type;
        fd.minlen = (fd.minlen < len) ? fd.minlen : len;
        fd.maxlen = (fd.maxlen > len) ? fd.maxlen : len;
        fd.min = (fd.min < value) ? fd.min : value; //written like this will bootstrap if isNaN(fd.min) (like when undefined)
        fd.max = (fd.max > value) ? fd.max : value;
    } else if (fd.type !== type) { // oh-oh
        this.addErrorValue(fd, "type", value);
    } else if (fd.list && !contains(fd.list, String(value))) {
        this.addErrorValue(fd, "newval", value);
    } else if (fd.minlen > len || fd.maxlen < len || fd.min > value || fd.max < value) {
        this.addErrorValue(fd, "boundary", value);
    } else if (fd.type === "text" && String(value) !== String(value).trim()) {
        this.addErrorValue(fd, "text", '"' + value + '"');
    }

    if (fd.isReferenceToKey || fd.isReferenceable) {
        fd.values = fd.values || [];
        // store unique values and track if all are unique
        fd.unique = !isNewValueAdd(fd.values, String(value)) && fd.unique;
    }
};

SchemaDoc.prototype.report = function (report) {
    var me = this;

    this.refKeys = this.refKeys || [];
    this.refKeys.forEach(function (refKey) {
        var refFd = me.base[refKey],
            tgtKey = refFd.isReferenceToKey,
            tgtFd,
            refValues,
            tgtValues;

        if (isEmpty(tgtKey)) {
            return me.addErrorValue(refFd, "reference", "unknown tgt key");
        }
        tgtFd = me.base[tgtKey];
        if (isEmpty(tgtFd)) {
            return me.addErrorValue(refFd, "reference", "unknown field definition for tgtkey=" + tgtKey);
        }
        if (refFd.type !== tgtFd.type) {
            return me.addErrorValue(refFd, "reference", "ref [" + refFd.type + "] and tgt [" + tgtFd.type + "] fields have unmatching types");
        }

        refValues = refFd.values || [];
        tgtValues = tgtFd.values || [];

        if (isEmpty(tgtValues) || tgtValues.length < refValues.length) {
            return me.addErrorValue(refFd, "reference", "less available tgtvalues (" + tgtValues.length + ") then used refvalues (" + refValues.length + ")");
        }

        refValues.sort();
        tgtValues.sort();

        refValues.some(function (ref) {
            if (!contains(tgtValues, ref)) {
                me.addErrorValue(refFd, "reference", "1st unmatched ref value: " + ref);
                return true;
            }
            return false;
        });
    });

    Object.keys(this.base).forEach(function (key) {
        var fd = me.base[key];
        // clean up some stuff that is internal to the processing
        delete fd.learnable;
        delete fd.values;
    });

    if (this.count.errors + this.count.newfields > 0) {
        console.error("shmdoc process found %d value-errors and %d new fields to document", this.count.errors, this.count.newfields);
    }

    fs.writeFile(report, JSON.stringify(this.base, null, 4), function (err) {
        if (err) {
            console.error("error writing shmdoc-report to %s: %s", report, err);
        }
    });
};

function run(files, hidelevels, base, report) {
    if (isEmpty(files) || !Array.isArray(files)) {
        throw "can't learn anything from unexisting data input";
    }

    if (isEmpty(base)) {
        throw "can't run if no basePath is specified.";
    }

    if (isEmpty(report)) {
        throw "can't run if no report location is specified.";
    }

    var sd = new SchemaDoc();
    sd.loadBase(base, function () {
        sd.setHideLevels(hidelevels);

        var cnt = 0;
        function done() {
            cnt += 1;
            if (files.length === cnt) {
                sd.report(report);
            }
        }

        files.forEach(function (f) {
            sd.learn(f, done);
        });
    });
}


module.exports.process = run;
module.exports.SchemaDoc = SchemaDoc;
