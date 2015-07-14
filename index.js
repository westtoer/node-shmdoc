/*jslint node: true */
/*jslint es5: true */
/*jslint nomen: true */

"use strict";

var sd = require('./lib/shmdoc'),
    fs = require('fs'),
    path = require('path'),
    argv = require('yargs'),
    settings;


settings = argv
    .usage('Guards the schema-documentation of a given data-set.\nUsage: $0')
    .example('$0  -f _schmdoc.json secret datafile1 [datafile2 ...]', 'Produces a _schmdoc_new.json next to the -f file location.')

    .describe('file', 'file containing the managed schema-documentation')
    .alias('f', 'file')
    .default('file', '_shmdoc.json')

    .demand(1)

    .argv;

sd.process(settings._, settings.file);
