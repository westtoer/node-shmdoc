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
            tobj.number = "15.2";
            tobj.integer = "15.0";
            tobj.text = "foobar";

            return Object.keys(tobj).reduce(function (types, type) {types[type] = type; return types; }, {});
        });
    });

    it('should count use and empty correctly', function () {
        var sd = new SchemaDoc(), tobj = [{x: 1, y: 1}, {x: 1, y: ""}, {x: 1} ],
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

    it('should report errors of new-values correctly');

    it('should report errors of boundaries correctly');

    it('should report errors of type correctly');

    it('should report errors of references correctly');

});
