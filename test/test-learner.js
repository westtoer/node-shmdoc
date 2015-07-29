/*jslint node: true */
/*jslint nomen: true */
/*global describe*/
/*global it*/
/*global before*/

"use strict";

var assert    = require('chai').assert,
    path      = require('path'),
    SchemaDoc = require('../lib/shmdoc').SchemaDoc;

describe('data learning', function () {

    function loadAndTest(ext, done) {
        var sd = new SchemaDoc(), fpath = path.join(__dirname, "data." + ext),
            testKeys = ["*.@boolean", "*.integer", "*.datetime", "*.text"],
            base = {};

        testKeys.forEach(function (k) {
            var t = k.replace(/\W/g, "");
            base[k] = { type: t};
        });

        sd.setBase(base);
        sd.learn(fpath, function () {
            assert.deepEqual(Object.keys(base), testKeys, "mismatch in keys");
            testKeys.forEach(function (k) {
                var fd = sd.base[k];
                assert.ok(!fd.learnable, "all keys (also " + k + ") should not be learnable");
                assert.ok(fd.errors, "all keys (also " + k + ") should have errors");
                assert.equal(fd.count.used, 2, "all keys (also " + k + ") should be used twice");
            });

            assert.deepEqual(sd.base["*.@boolean"].errors, {type: ["error"]}, "mismatch in expected boolean errors");
            assert.deepEqual(sd.base["*.integer"].errors, {type: [2.3]}, "mismatch in expected integer errors");
            assert.deepEqual(sd.base["*.datetime"].errors, {type: ["eergisteren"]}, "mismatch in expected datetime errors");
            assert.deepEqual(sd.base["*.text"].errors, {text: ["\" Ik ben behoorlijk vrolijk \""]}, "mismatch in expected text errors");
            done();
        });
    }

    it('should be able to read json', function (done) {
        loadAndTest("json", done);
    });

    it('should be able to read csv', function (done) {
        loadAndTest("csv", done);
    });

    it('should be able to read xml', function (done) {
        loadAndTest("xml", done);
    });

});
