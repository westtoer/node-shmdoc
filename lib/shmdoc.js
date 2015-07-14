/*jslint node: true */
/*jslint es5: true */
/*jslint nomen: true */

"use strict";

var fs = require('fs'),
    path = require('path'),
    moment = require('moment'),
    TYPES = ['date', 'time', 'datetime', 'integer', 'number', 'text'],
    TYPENDX = TYPES.reduce(function (s, t, i) { s[t] = i; return s; }, {});

function isEmpty(obj) {
    return (obj === null || obj === undefined || (obj.hasOwnProperty('length') && obj.length === 0));
}

function SchemaDoc(b) {
    this.basePath = b;
    this.tryLoadExisting();
}

SchemaDoc.prototype.tryLoadExisting = function () {
    try {
        this.base = require(this.basePath);
    } catch (err) {
        this.base = {};
        if (err.code === 'MODULE_NOT_FOUND') {
            console.error("base schema-documentation not found - missing file [%s]", this.basePath);
        }
    }

    //todo - assert that loaded fields should not be learnable
};

SchemaDoc.prototype.rebase = function () {
    console.log("todo write new base to derivative of %s", this.basePath);
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
        console.log(SchemaDoc.learners);
        return;
    }

    learner.call(this, fPath);

    // allow parallel processing of files
    // use different learner for json / csv / xml
    // emit error if format not recognised
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

    //TODO have some way to strip some levels from the start (e.g. for XML)
    var key = pathelms.join('.'), fd;
    if (!this.base.hasOwnProperty(key)) {
        fd = {
            learnable: true,
            count: {
                used: 0,
                empty: 0,
                bytype : {}
            }
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

SchemaDoc.prototype.learnKeyValue = function (pathelms, value) {
    var fd = this.fieldDoc(pathelms), type;

    // count use and emptyness
    fd.count.used += 1;
    if (value === undefined || value === null || String(value).trim().length === 0) {
        fd.count.empty += 1;
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
    if (fd.learnable) { // ok no sweat
        fd.type = type;
    } else if (fd.type !== type) { // oh-oh
        fd.type_errors = fd.type_errors || [];
        fd.type_errors.push(value);
    }


    // fd.min, fd.max// histogram?
    // register min max, length - natives and converted representations
    // check foreign key relations!!!
    //    if (fd.isRef) {
    //    }

};

SchemaDoc.prototype.report = function () {
    var me = this;
    console.error("todo write what was learned - if anything");

    Object.keys(this.base).sort().forEach(function (key) {
        var fd = me.base[key];
        delete fd.learnable;
        console.log("%s,%s,%d,%d,%s", key, fd.type, fd.count.used, fd.count.empty, fd.example);
    });

    //todo serialize .shmdoc_new.json
};

function run(files, base) {
    if (isEmpty(files) || !Array.isArray(files)) {
        throw "can't learn anything from unexisting data input";
    }

    if (isEmpty(base)) {
        throw "can't run if no basePath is specified.";
    }

    var sd = new SchemaDoc(base);
    files.forEach(function (f) {
        sd.learn(f);
    });
    sd.rebase();
    sd.report();
}


module.exports.process = run;
module.exports.SchemaDoc = SchemaDoc;
