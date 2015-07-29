/*jslint node: true */
/*jslint nomen: true */
/*global describe*/
/*global it*/
/*global before*/

"use strict";

var assert    = require('chai').assert,
    SchemaDoc = require('../lib/shmdoc').SchemaDoc;

describe('value analyzer', function () {
    function assertKeys(builder) {
        var sd = new SchemaDoc(), tobj = {},
            baseKeys, expectKeys = builder(tobj);

        sd.setHideLevels(0);
        sd.traverseValue([], tobj);
        assert.isNotNull(sd.base,
                         "internal base should exist");
        baseKeys = Object.keys(sd.base);
        assert.equal(baseKeys.length, expectKeys.length,
                     "number of keys don't match base=" + baseKeys + " - expect = " + expectKeys);
        assert.deepEqual(baseKeys.sort(), expectKeys.sort(), "keys don't match");
    }

    it('should find all the object keys', function () {
        assertKeys(function (tobj) {
            var i, CNT = 5, k, keys = [];
            for (i = 0; i < CNT; i += 1) {
                k = "x" + i;
                tobj[k] = "a";
                keys.push(k);
            }
            return keys;
        });
    });

    it('should find all nested keys', function () {
        assertKeys(function (tobj) {
            var i, CNT = 5, k, keys = [];
            for (i = 0; i < CNT; i += 1) {
                k = "x" + i;
                tobj["x" + i] = [{a: "b"}];
                keys.push(k + ".*.a");
            }
            return keys;
        });
    });

    function assertTypes(builder) {
        var sd = new SchemaDoc(), tobj = {},
            expectTypes = builder(tobj),
            baseKeys, expectKeys = Object.keys(expectTypes);

        sd.traverseValue([], tobj);
        assert.isNotNull(sd.base,
                         "internal base should exist");
        baseKeys = Object.keys(sd.base);
        assert.equal(baseKeys.length, expectKeys.length,
                     "number of keys don't match base=" + baseKeys + " - expect = " + expectKeys);
        assert.deepEqual(baseKeys.sort(), expectKeys.sort(), "keys don't match");

        baseKeys.forEach(function (k) {
            var fd = sd.base[k];
            assert.equal(fd.type, expectTypes[k]);
            assert.equal();
        });
    }

    it('should derive types correctly', function () {
        assertTypes(function (tobj) {
            tobj.datetime =  "2015-07-15T10:28:32Z";
            tobj.date = "2015-07-15";
            tobj.time = "08:30:15+02:00";
            tobj.number = 15.2;
            tobj.integer = 2.0;
            tobj.text = "foobar";

            return Object.keys(tobj).reduce(function (types, type) {types[type] = type; return types; }, {});
        });
    });

    it('should count use and empty correctly', function () {
        var sd = new SchemaDoc(), tobj = [{x: 2, y: 2}, {x: 2, y: ""}, {x: 2} ],
            baseKeys;

        sd.traverseValue([], tobj);
        assert.isNotNull(sd.base,
                         "internal base should exist");
        baseKeys = Object.keys(sd.base);
        assert.equal(baseKeys.length, 2,
                     "number of keys don't match base=" + baseKeys + " - expect = 2");
        assert.deepEqual(baseKeys.sort(), ["*.x", "*.y"], "keys don't match ['*.x,''*.y']");

        assert.deepEqual(
            sd.base["*.x"].count,
            {used: 3, empty: 0, bytype: {integer: 3}},
            "unexpected usage/empty count for *.x"
        );
        assert.deepEqual(
            sd.base["*.y"].count,
            {used: 2, empty: 1, bytype: {integer: 1}},
            "unexpected usage/empty count for *.y"
        );
    });

    it('should determine min-max correctly', function () {
        var sd = new SchemaDoc(), tobj = [{x: 1, y: 10}, {x: 2, y: 20}, {x: 3} ],
            baseKeys;

        sd.traverseValue([], tobj);
        assert.isNotNull(sd.base,
                         "internal base should exist");
        baseKeys = Object.keys(sd.base);

        assert.ok(sd.base["*.x"].learnable, "learnable mode for *.x");
        assert.equal(sd.base["*.x"].min, 1, "min for *.x");
        assert.equal(sd.base["*.x"].max, 3, "max for *.x");

        assert.ok(sd.base["*.y"].learnable, "learnable mode for *.y");
        assert.equal(sd.base["*.y"].min, 10, "min for *.y");
        assert.equal(sd.base["*.y"].max, 20, "max for *.y");

    });

    it('should determine min-max-length correctly', function () {
        var sd = new SchemaDoc(), tobj = [{x: "xxx", y: "yyyyy"}, {x: "xx", y: "yy"}, {x: "x"} ],
            baseKeys;

        sd.traverseValue([], tobj);
        assert.isNotNull(sd.base,
                         "internal base should exist");
        baseKeys = Object.keys(sd.base);

        assert.ok(sd.base["*.x"].learnable, "learnable mode for *.x");
        assert.equal(sd.base["*.x"].minlen, 1, "min for *.x");
        assert.equal(sd.base["*.x"].maxlen, 3, "max for *.x");

        assert.ok(sd.base["*.y"].learnable, "learnable mode for *.y");
        assert.equal(sd.base["*.y"].minlen, 2, "min for *.y");
        assert.equal(sd.base["*.y"].maxlen, 5, "max for *.y");
    });

    it('should report errors of new-values correctly', function () {
        var sd = new SchemaDoc(), tobj = [{x: "a"}, {x: "b"}, {x: "x"} ];

        sd.setBase({"*.x": {"type": "text", "list": ["a", "b"]}});
        assert.isNotNull(sd.base["*.x"], "key to check should be set");
        assert.ok(!sd.base["*.x"].learnable, "learnable mode for *.x");

        sd.traverseValue([], tobj);
        assert.isNotNull(sd.base,
                         "internal base should exist");

        assert.ok(!sd.base["*.x"].learnable, "learnable mode for *.x");
        assert.deepEqual(
            sd.base["*.x"].count,
            {used: 3, empty: 0, bytype: {text: 3}},
            "unexpected usage/empty count for *.x"
        );
        assert.deepEqual(
            sd.base["*.x"].errors,
            {newval: ["x"]},
            "unexpected error-report for *.x"
        );
    });

    it('should report errors of boundaries correctly', function () {
        var sd = new SchemaDoc(), tobj = [{x: -1}, {x: 2}, {x: 10} ];

        sd.setBase({"*.x": {"type": "integer", "min": 2, "max": 5}});
        assert.isNotNull(sd.base["*.x"], "key to check should be set");
        assert.ok(!sd.base["*.x"].learnable, "learnable mode for *.x");

        sd.traverseValue([], tobj);
        assert.isNotNull(sd.base,
                         "internal base should exist");

        assert.ok(!sd.base["*.x"].learnable, "learnable mode for *.x");
        assert.deepEqual(
            sd.base["*.x"].count,
            {used: 3, empty: 0, bytype: {integer: 3}},
            "unexpected usage/empty count for *.x"
        );
        assert.deepEqual(
            sd.base["*.x"].errors,
            {boundary: [-1, 10]},
            "unexpected error-report for *.x"
        );
    });

    it('should report errors of type correctly', function () {
        var sd = new SchemaDoc(), tobj = [{x: 0}, {x: 2}, {x: "bla"} ];

        sd.setBase({"*.x": {"type": "boolean"}});
        assert.isNotNull(sd.base["*.x"], "key to check should be set");
        assert.ok(!sd.base["*.x"].learnable, "learnable mode for *.x");

        sd.traverseValue([], tobj);
        assert.isNotNull(sd.base,
                         "internal base should exist");

        assert.ok(!sd.base["*.x"].learnable, "learnable mode for *.x");
        assert.deepEqual(
            sd.base["*.x"].count,
            {used: 3, empty: 0, bytype: {boolean: 1, integer: 1, text: 1}},
            "unexpected usage/empty count for *.x"
        );
        assert.deepEqual(
            sd.base["*.x"].errors,
            {type: [2, "bla"]},
            "unexpected error-report for *.x"
        );
    });

    it('should report errors of references correctly', function () {
        var sd = new SchemaDoc(), tobj = [{id: 101}, {id: 102, ref: 101}, {id: 103, ref: 1000} ];

        sd.setBase({
            "*.id": {},
            "*.ref": {"type": "integer", "isReferenceToKey": "*.id"}
        });
        assert.isNotNull(sd.base["*.id"], "key to check should be set");
        assert.isNotNull(sd.base["*.ref"], "key to check should be set");
        assert.ok(sd.base["*.id"].learnable, "learnable mode for *.id before traversal");
        assert.ok(sd.base["*.id"].isReferenceable, "referenceable mode for *.id");
        assert.ok(!sd.base["*.ref"].learnable, "learnable mode for *.ref before traversal");

        sd.traverseValue([], tobj);
        assert.ok(sd.base["*.id"].learnable, "learnable mode for *.id after traversal");
        assert.ok(!sd.base["*.ref"].learnable, "learnable mode for *.ref after traversal");
        assert.isNotNull(sd.base,
                         "internal base should exist");

        //only in the report phase the refe errors are assembled
        sd.report();

        assert.deepEqual(
            sd.base["*.id"].count,
            {used: 3, empty: 0, bytype: {integer: 3}},
            "unexpected usage/empty count for *.id"
        );
        assert.deepEqual(
            sd.base["*.ref"].count,
            {used: 2, empty: 0, bytype: {integer: 2}},
            "unexpected usage/empty count for *.ref"
        );
        assert.isUndefined(sd.base["*.id"].errors, "should be no errors in the target.");
        assert.deepEqual(
            sd.base["*.ref"].errors,
            {reference: ["1st unmatched ref value: " + 1000]},
            "unexpected error-report for *.ref"
        );
    });

});
