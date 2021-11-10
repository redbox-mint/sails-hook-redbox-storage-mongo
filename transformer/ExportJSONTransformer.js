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
            this.push(`"dateModifiedRange": {\n`);
            if (!_.isEmpty(modifiedAfter)) {
                this.push(`"from": "${modifiedAfter}",\n`);
            }
            else {
                this.push(`"from": "",\n`);
            }
            if (!_.isEmpty(modifiedBefore)) {
                this.push(`"to": "${modifiedBefore}",\n`);
            }
            else {
                this.push(`"to": "",\n`);
            }
            this.push(`},\n`);
        }
        this.push(`"records":[ `);
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
