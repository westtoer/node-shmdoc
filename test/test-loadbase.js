/*jslint node: true */
/*jslint nomen: true */
/*global describe*/
/*global it*/
/*global before*/

"use strict";

var assert    = require('chai').assert,
    path      = require('path'),
    SchemaDoc = require('../lib/shmdoc').SchemaDoc;

describe('base loader', function () {

    function loadAndTest(ext, done) {
        var sd = new SchemaDoc(), bpath = path.join(__dirname, "shmdoc-base." + ext);

        sd.loadBase(bpath, function () {
            assert.ok(sd.base, "base should be loaded");
            assert.ok(sd.base.testkey, "base should have at least this key");
            // remove the unknown/empty elements
            delete sd.base.testkey.created;
            delete sd.base.testkey.format;
            delete sd.base.testkey.isReferenceToKey;
            delete sd.base.testkey.isReferenceable;
            delete sd.base.testkey.learnable;
            delete sd.base.testkey.list;
            delete sd.base.testkey.updated;

            //test the remainder
            assert.deepEqual(
                sd.base,
                {
                    testkey: {
                        key: 'testkey',
                        type: 'text',
                        min: 'a',
                        max: 'z',
                        minlen: '1',
                        maxlen: '100'
                    }
                }
            );
            done();
        });
    }

    it('should load from json', function (done) {
        loadAndTest("json", done);
    });

    it('should load from csv', function (done) {
        loadAndTest("csv", done);
    });

});
