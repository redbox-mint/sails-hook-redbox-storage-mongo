'use strict';

const { Transform } = require('stream');
import { DateTime } from 'luxon';
declare var require: any;
declare var module: any;
declare let sails, _;

class ExportJSONTransformer extends Transform {
    first:boolean = true;
    constructor(recordtype:string, modifiedBefore:string, modifiedAfter:string) {
        super();
    this.push(`{ "recordType": "${recordtype}",\n "dateGenerated": "${DateTime.now().toISO()}",\n`)
        if(!_.isEmpty(modifiedBefore) || !_.isEmpty(modifiedAfter)) {
            this.push(`"dateModifiedRange": ${this.getDateModifiedRangeObject(modifiedBefore, modifiedAfter)},\n`);
        }
        this.push(`"records":[ `)
        
    }


    private getDateModifiedRangeObject(modifiedBefore,modifiedAfter) {
        let rangeObject = {};
        if(!_.isEmpty(modifiedAfter)) {
            rangeObject["from"] = modifiedAfter;
        } else {
            rangeObject["from"] = "";
        }
        if(!_.isEmpty(modifiedBefore)) {
            rangeObject["to"] = modifiedBefore;
        } else {
            rangeObject["to"] = "";
        }
        return JSON.stringify(rangeObject)
    }

    /**
     * Main function that send data to the parse to be processed.
     *
     * @param {Buffer} chunk Incoming data
     * @param {String} encoding Encoding of the incoming data. Defaults to 'utf8'
     * @param {Function} done Called when the proceesing of the supplied chunk is done
     */
    _transform(chunk:object, encoding, done) {
        
        let data = chunk.toString();
        
        if(!this.first) {
            this.push(",\n");
                
        } else {
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