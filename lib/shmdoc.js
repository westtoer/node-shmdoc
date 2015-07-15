/*jslint node: true */
/*jslint es5: true */
/*jslint nomen: true */

"use strict";

var fs = require('fs'),
    path = require('path'),
    moment = require('moment'),
    RUNTIME = moment().toJSON(),
    TYPES = ['date', 'time', 'datetime', 'integer', 'number', 'text'],
    TYPENDX = TYPES.reduce(function (s, t, i) { s[t] = i; return s; }, {});

function isEmpty(obj) {
    return (obj === null || obj === undefined || (obj.hasOwnProperty('length') && obj.length === 0));
}

function contains(container, item) {
    return (container.indexOf(item) !== -1);
}

function SchemaDoc() {
    this.hideLevels = 1;
    this.count = {errors: 0, newfields: 0};
}

SchemaDoc.prototype.setHideLevels = function (num) {
    this.hideLevels = num;
};

SchemaDoc.prototype.loadBase = function (basePath, done) {
    var me = this;

    function onLoad() {
        //todo read refKeys
        me.refKeys = [];
        done();
    }

    // TODO allow basePath to be URI
    // TODO allow basePath to be csv format
    try {
        this.base = require(basePath);
    } catch (err) {
        this.base = {};
        if (err.code === 'MODULE_NOT_FOUND') {
            console.error("base schema-documentation not found - missing file @[%s]", basePath);
        }
    }

    //todo this should be async
    onLoad();
};

SchemaDoc.prototype.learn = function (fPath) {

    if (isEmpty(fPath) || !fs.existsSync(fPath)) {
        console.error("missing learning file at %s", fPath);
        return;
    }

    // derive file type from the file extension
    var ext = path.extname(fPath).slice(1),
        learner = SchemaDoc.learners[ext];

    if (!learner) {
        console.log("no implementation for %s - can't proces %s", ext, fPath);
        console.log("known formats limited to %j", Object.keys(SchemaDoc.learners));
        return;
    }

    learner.call(this, fPath);
};

SchemaDoc.prototype.traverseValue = function (pathelms, d) {
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
};

SchemaDoc.prototype.learnFromJSON = function (fPath) {
    var data;
    data = require(fPath);
    this.traverseValue([], data);
};

SchemaDoc.learners = {
    json: SchemaDoc.prototype.learnFromJSON
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
            count    : {
                used     : 0,
                empty    : 0,
                bytype   : {}
            },
            created      : RUNTIME,
            values       : []
        };
        this.base[key] = fd;
    } else {
        fd = this.base[key];
    }
    return fd;
};


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
    return !isNaN(n);
}
function guessType(value) {
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

function isNewValueAdd(arr, value) {
    if (contains(arr, value)) {
        return false;
    } //else
    arr.push(value);
    return true;
}

SchemaDoc.prototype.learnKeyValue = function (pathelms, value) {
    var fd = this.fieldDoc(pathelms), type, len = String(value).length;

    // count use and emptyness
    fd.count.used += 1;
    fd.updated = RUNTIME;

    if (value === undefined || value === null || String(value).trim().length === 0) {
        fd.count.empty += 1;
        fd.nullable = true;
        return;
    }

    if (fd.type === "integer" || fd.type === "number") {
        value = Number(value);
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
    if (fd.learnable) { // ok no sweat - this is new stuff we don't know anything about
        fd.type = type;
        fd.minlen = (fd.minlen < len) ? fd.minlen : len;
        fd.maxlen = (fd.maxlen > len) ? fd.maxlen : len;
        fd.min = (fd.min < value) ? fd.min : value; //written like this will bootstrap if isNaN(fd.min) (like when undefined)
        fd.max = (fd.max > value) ? fd.max : value;
    } else if (fd.type !== type) { // oh-oh
        this.count.errors += 1;
        fd.type_errors = fd.type_errors || [];
        fd.type_errors.push(value);
    } else if (fd.list && !contains(fd.list, value)) {
        this.count.errors += 1;
        fd.new_values = fd.new_values || [];
        fd.new_values.push(value);
    } else if (fd.minlen > len || fd.maxlen > len || fd.min < value || fd.max > value) {
        this.count.errors += 1;
        fd.boundary_errors = fd.boundary_errors || [];
        fd.boundary_errors.push(value);
    }

    if (fd.isReferenceToKey || fd.isReferenceable) {
        // store unique values and track if all are unique
        fd.unique = fd.unique && !isNewValueAdd(fd.values, value);
    }
};

SchemaDoc.prototype.report = function (report) {
    var me = this;

    this.refKeys.forEach(function (refKey) {
        var refFd = this.base[refKey],
            tgtKey = refFd.isReferenceToKey,
            tgtFd,
            refValues,
            tgtValues;

        refFd.reference_errors = refFd.reference_errors || [];
        function ref_err(err) {
            me.count.errors += 1;
            refFd.reference_errors.push(err);
        }

        if (isEmpty(tgtKey)) {
            return ref_err("unknown tgt key");
        }
        tgtFd = this.base[tgtKey];
        if (isEmpty(tgtFd)) {
            return ref_err("unknown tgt field definition");
        }

        refValues = refFd.values || [];
        tgtValues = tgtFd.values;

        if (isEmpty(tgtValues) || tgtValues.length < refValues.length) {
            return ref_err("less available tgtvalues then used refvalues");
        }

        refValues.some(function (ref) {
            if (!contains(tgtValues, ref)) {
                ref_err("unkown tgtValue : " + ref);
                return true;
            }
            return false;
        });
    });

    Object.keys(this.base).forEach(function (key) {
        var fd = me.base[key];
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
        files.forEach(function (f) {
            sd.learn(f);
        });
        sd.report(report);
    });
}


module.exports.process = run;
module.exports.SchemaDoc = SchemaDoc;
