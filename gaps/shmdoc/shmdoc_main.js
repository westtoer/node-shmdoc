/*global PropertiesService, SpreadsheetApp, HtmlService, UrlFetchApp */
"use strict";

/**
 * @OnlyCurrentDoc  Limits the script to only accessing the current spreadsheet.
 */

function isArray(a) {
    return Object.prototype.toString.call(a) === '[object Array]';
}
function isEmpty(v) {
    return v === undefined || v === null || (v.hasOwnProperty('length') && v.length === 0);
}
function isAllSet() {
    var args = Array.prototype.slice.call(arguments);
    return args.every(function (i) { return (!isEmpty(i)); });
}

function getDocProps() {
    return PropertiesService.getDocumentProperties();
}

function getDocProp(key) {
    var json = getDocProps().getProperty(key);
    if (!json) {
        return;
    } //else
    return JSON.parse(json);
}

function setDocProp(key, val) {
    return getDocProps().setProperty(key, JSON.stringify(val));
}

function getSheetId() {
    SpreadsheetApp.getActiveSheet().getSheetId();
}

function getSheetProp(key) {
    return getDocProp(getSheetId() + "." + key);
}

function setSheetProp(key, val) {
    return setDocProp(getSheetId() + "." + key, val);
}

/**
 * Adds a custom menu with items to show the config-sidebar and one to perform a direct sync
 *
 * @param {Object} e The event parameter for a simple onOpen trigger.
 */
function onOpen(e) {
    SpreadsheetApp.getUi()
        .createAddonMenu()
        .addItem('sync & merge', 'syncMerge')
        .addItem('change settings', 'showConfig')
        .addToUi();
}

/**
 * Opens the config sidebar. The sidebar structure is described in the ConfigSidebar.html
 */
function showConfig() {
    var ui = HtmlService.createTemplateFromFile('ConfigSidebar')
        .evaluate()
        .setTitle('shmdoc settings');
    SpreadsheetApp.getUi().showSidebar(ui);
}

/**
 * Runs when the add-on is installed; calls onOpen() to ensure menu creation and
 * any other initializion work is done immediately.
 *
 * @param {Object} e The event parameter for a simple onInstall trigger.
 */
function onInstall(e) {
    onOpen(e);
    showConfig();
}

function mergeData(base, uri) {
    var LIMIT = 1024, // never make this bigger then 5000 --> that is the hard limit in google spreadsheets
        DEFAULTCOLS = [
          "key", "type", "type-counts", "format", "example-value", "min-value", "max-value", "min-len", "max-len",
          "use-count", "nullable", "created", "updated",
          "newvalue-errors", "boundary-errors", "type-errors", "reference-errors", "text-errors",
          "isReferenceToKey", "value-list",
          "value-list-semantics", "missing-semantics", "null-semantics",
          "description", "recommended use", "user reference", "remarks", "rdf"
        ],
        result = {},
        keys,
        currentKeys,
        currentKeyToRow = {},
        currentFields,
        currentFieldToCol = {},
        currentDataRange,
        cursor;

    result.origin = uri || "unknown";

    // the main work
    currentDataRange = SpreadsheetApp.getActiveSheet().getDataRange();
    //TODO handle the case of new empty sheet --> empty datarange
    if ( currentDataRange.getNumColumns() === 1 && currentDataRange.getNumRows() === 1 && currentDataRange.getValue() === "") {
        // there is no data in the sheet, so let's make some
        currentDataRange = currentDataRange.offset(0, 0, 1, DEFAULTCOLS.length);
        currentDataRange.setValues([DEFAULTCOLS]);
    };


    // read the first line
    cursor = currentDataRange.offset(0, 0, 1, currentDataRange.getNumColumns()); // first row
    currentFields = cursor.getValues()[0];
    // --> find the important columns back in the spreadsheet --> by name to col-offset-nr
    currentFieldToCol = currentFields.reduce(function (s, el, i) {  s[el] = i; return s; }, {});
    result.foundcols = Object.keys(currentFieldToCol).length;

    // check the existence of a key column.
    if (!currentFieldToCol.hasOwnProperty('key')) {
        throw "there should at least be a column labeled 'key'";
    }

    // TODO check for other absolutely required columns: type

    // read the key column
    if (currentDataRange.getNumRows() > 1) {
        cursor = currentDataRange.offset(currentFieldToCol.key, 0, currentDataRange.getNumRows() - 1, 1); // first col without first row
        currentKeys = cursor.getValues().map(function (el) { return el[0]; });
        // --> find all the known keys --> by key to row-number
        currentKeyToRow = currentKeys.reduce(function (s, el, i) {  s[el] = i; return s; }, {});
    }
    result.foundkeys = Object.keys(currentKeyToRow).length;

    // prepare some helper functions
    function setVal(row, colname, val) {
        val = val || "";
        if (val.length > LIMIT) {
            val = val.slice(0, LIMIT);
        }
        row[currentFieldToCol[colname]] = val;
    }
    function joinedIfPresent(obj, pathelms, delim) {
        delim = delim || "|";
        var tgt = pathelms.reduce(function (o, name) { return o.hasOwnProperty(name) ? o[name] : []; }, obj);
        tgt = isArray(tgt) ? tgt : [];
        return tgt.join("|");
    }

    keys = Object.keys(base);
    result.totalkeys = keys.length;
    result.mergedkeys = 0;
    result.newkeys = 0;
    // process all the keys in the base
    keys.forEach(function (key) {
        var fd = base[key], rownum = currentKeyToRow[key], rowvalues;
        fd.count = fd.count || {};

        if (rownum !== undefined) {
        // --> merge new information for known keys
            // read current row
            cursor = currentDataRange.offset(rownum, 0, 1, currentDataRange.getNumColumns());
            rowvalues = cursor.getValues()[0];
            // merge in learned information - only the errors, a new example, the counts and the updated-ts

            // newvalue-errors	boundary-errors	type-errors	reference-errors
            setVal(rowvalues, "newvalue-errors",  joinedIfPresent(fd, ['errors', 'newval']));
            setVal(rowvalues, "boundary-errors",  joinedIfPresent(fd, ['errors', 'boundary']));
            setVal(rowvalues, "type-errors",      joinedIfPresent(fd, ['errors', 'type']));
            setVal(rowvalues, "reference-errors", joinedIfPresent(fd, ['errors', 'reference']));
            setVal(rowvalues, "text-errors",      joinedIfPresent(fd, ['errors', 'text']));

            setVal(rowvalues, "example-value",    fd.example);
            setVal(rowvalues, "type-counts",      JSON.stringify(fd.count.bytype));
            setVal(rowvalues, "use-count",        fd.count.used);
            setVal(rowvalues, "nullable",         (fd.count.empty > 0));
            setVal(rowvalues, "created",          fd.created);
            setVal(rowvalues, "updated",          fd.updated);

            // unless the type was unknown - then add some more
            if (isEmpty(rowvalues[currentFieldToCol.type])) {
                setVal(rowvalues, "type",         fd.type);
                setVal(rowvalues, "min-value",    fd.min);
                setVal(rowvalues, "max-value",    fd.max);
                setVal(rowvalues, "min-len",      fd.minlen);
                setVal(rowvalues, "max-len",      fd.maxlen);
            }

            // write
            cursor.setValues([rowvalues]);
            result.mergedkeys += 1;

        } else {
        // --> add rows for new keys
            rowvalues = Array.apply(null, Array(currentDataRange.getNumColumns())).map(String.prototype.valueOf, ""); // correct length, filled with empty values ""
            // assemble new row-value --> add at end
            // key	type	type-counts	format	example-value	min-value	max-value	min-len	max-len	use-count	nullable	created	updated
            setVal(rowvalues, "key",              fd.key);
            setVal(rowvalues, "type",             fd.type);
            setVal(rowvalues, "type-counts",      JSON.stringify(fd.count.bytype));
            //format?
            setVal(rowvalues, "example-value",    fd.example);
            setVal(rowvalues, "min-value",        fd.min);
            setVal(rowvalues, "max-value",        fd.max);
            setVal(rowvalues, "min-len",          fd.minlen);
            setVal(rowvalues, "max-len",          fd.maxlen);
            setVal(rowvalues, "use-count",        fd.count.used);
            setVal(rowvalues, "nullable",         (fd.count.empty > 0));
            setVal(rowvalues, "created",          fd.created);
            setVal(rowvalues, "updated",          fd.updated);

            // newvalue-errors	boundary-errors	type-errors	reference-errors
            // isReferenceToKey	isReferenceable	value-list
            // value-list-semantics	missing-semantics	null-semantics	description	recommended use	user reference	remarks	rdf
            SpreadsheetApp.getActiveSheet().appendRow(rowvalues);
            result.newkeys += 1;
        }
    });

    return result;
}

function mergeFromJSON(json, uri) {
    var base = JSON.parse(json);
    return mergeData(base, uri);
}

function saveLinkProps(uri, headers) {
    setSheetProp("shmdoc.link", {uri: uri, headers: headers});
}

/**
 * merges the spreadsheet with data from the URI.
 *
 * @return {String} the actions performed.
 */
function mergeFromURI(uri, headers, keep) {
    keep = keep || false;

    if (keep) {
        saveLinkProps(uri, headers);
    }

    var params = {"method": "GET", "headers": headers},
        resp = UrlFetchApp.fetch(uri, params),
        code = resp.getResponseCode(),
        json = resp.getContentText();

    if (code !== 200) {
        throw "failed to fetch data - response [" + code + "]";
    }
    return mergeFromJSON(json, uri);
}

function syncMerge() {
    var linkArgs = getSheetProp("shmdoc.link"), result;
    if (!linkArgs || !linkArgs.uri) {
        showConfig();
        throw "there are no saved settings to automatically sync the shmdoc --> use the settings pannel first.";

    } //else

    result = mergeFromURI(linkArgs.uri, linkArgs.headers, false);
    Browser.msgBox("Sync & Merge completed: " + JSON.stringify(result, undefined, 4));
}
