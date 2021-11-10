"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatastreamServiceResponse = void 0;
class DatastreamServiceResponse {
    constructor() {
    }
    isSuccessful() {
        return this.success === true;
    }
}
exports.DatastreamServiceResponse = DatastreamServiceResponse;
exports.default = DatastreamServiceResponse;
