'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const { Transform } = require('stream');
const moment = require("moment");
class ExportJSONTransformer extends Transform {
    constructor(recordtype, modifiedBefore, modifiedAfter) {
        super();
        this.first = true;
        this.push(`{ "recordType": "${recordtype}",\n "dateGenerated": "${moment().toISOString()}",\n`);
        if (!_.isEmpty(modifiedBefore) || !_.isEmpty(modifiedAfter)) {
            this.push(`"dateModifiedRange": ${this.getDateModifiedRangeObject(modifiedBefore, modifiedAfter)},\n`);
        }
        this.push(`"records":[ `);
    }
    getDateModifiedRangeObject(modifiedBefore, modifiedAfter) {
        let rangeObject = {};
        if (!_.isEmpty(modifiedAfter)) {
            rangeObject["from"] = modifiedAfter;
        }
        else {
            rangeObject["from"] = "";
        }
        if (!_.isEmpty(modifiedBefore)) {
            rangeObject["to"] = modifiedBefore;
        }
        else {
            rangeObject["to"] = "";
        }
        return JSON.stringify(rangeObject);
    }
    _transform(chunk, encoding, done) {
        let data = chunk.toString();
        if (!this.first) {
            this.push(",\n");
        }
        else {
            this.first = false;
        }
        this.push(data);
        done();
    }
    _flush(done) {
        this.push("]\n }");
        done();
    }
}
module.exports = ExportJSONTransformer;
