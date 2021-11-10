"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Datastream = void 0;
class Datastream {
    constructor(data = undefined) {
        if (data) {
            this.fileId = data['fileId'];
            this.metadata = data;
        }
    }
}
exports.Datastream = Datastream;
exports.default = Datastream;
