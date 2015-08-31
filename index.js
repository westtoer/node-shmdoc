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
    .example('$0  -b ./.schmdoc.json datafile1 [datafile2 ...]', 'Reads the current base schema-doc file, checks and augments with data found in the datafiles and writes a ./.schmdoc-report.json in the current working dir.')

    .describe('base', 'base-file containing the managed schema-documentation - can be uri - can be csv format')
    .alias('b', 'base')
    .default('base', './.shmdoc.json')

    .describe('report', 'location where to put the resulting report.')
    .alias('r', 'report')
    .default('report', './.shmdoc-report.json')

    .describe('level', 'number of root-levels to hide from the keys')
    .alias('l', 'level')
    .default('level', 0)

    .demand(1)

    .argv;

sd.process(settings._, settings.level, settings.base, settings.report);
