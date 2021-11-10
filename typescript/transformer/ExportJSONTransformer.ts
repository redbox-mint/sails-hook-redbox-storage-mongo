'use strict';

const {
    Transform
} = require('stream');
import moment = require('moment');
declare let sails, _;

class ExportJSONTransformer extends Transform {
    first:boolean = true;
    constructor(recordtype:string, modifiedBefore:string, modifiedAfter:string) {
        super();
        this.push(`{ "recordType": "${recordtype}",\n "dateGenerated": "${moment().toISOString()}",\n`)
        if(!_.isEmpty(modifiedBefore) || !_.isEmpty(modifiedAfter)) {
            this.push(`"dateModifiedRange": {\n`);
            if(!_.isEmpty(modifiedAfter)) {
                this.push(`"from": "${modifiedAfter}",\n`);
            } else {
                this.push(`"from": "",\n`);
            }
            if(!_.isEmpty(modifiedBefore)) {
                this.push(`"to": "${modifiedBefore}",\n`);
            } else {
                this.push(`"to": "",\n`);
            }
            this.push(`},\n`);
        }
        this.push(`"records":[ `)
        
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