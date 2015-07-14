/*jslint node: true */
/*jslint nomen: true */
/*global describe*/
/*global it*/
/*global before*/

"use strict";

var assert    = require('chai').assert,
    SchemaDoc = require('../lib/shmdoc').SchemaDoc;

describe('value analyzer', function () {
    function assertKeys(build) {
        var sd = new SchemaDoc(), tobj = {},
            baseKeys, expectKeys = build(tobj);

        sd.traverseValue([], tobj);
        assert.isNotNull(sd.base,
                         "internal base should exist");
        baseKeys = Object.keys(sd.base);
        assert.equal(baseKeys.length, expectKeys.length,
                     "number of keys don't match");
        assert.deepEqual(baseKeys.sort(), expectKeys.sort(), "keys don't match");
    }

    it('should find all the object keys', function (done) {
        assertKeys(function (tobj) {
            var i, CNT = 5, k, keys = [];
            for (i = 0; i < CNT; i += 1) {
                k = "x" + i;
                tobj[k] = "a";
                keys.push(k);
            }
            return keys;
        });
        done();
    });

    it('should find all nested keys', function (done) {
        assertKeys(function (tobj) {
            var i, CNT = 5, k, keys = [];
            for (i = 0; i < CNT; i += 1) {
                k = "x" + i;
                tobj["x" + i] = [{a: "b"}];
                keys.push(k + ".*.a");
            }
            return keys;
        });
        done();
    });

    it('should derive types correctly');
    it('should count use and empty correctly');
    it('should determine min-max correctly');

});
