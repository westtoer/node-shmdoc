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

    it('should count use and empty correctly');

    it('should determine min-max correctly');

    it('should determine min-max-length correctly');

    it('should check references correctly');

});
