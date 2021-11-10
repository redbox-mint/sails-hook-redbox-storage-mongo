"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.APIObjectActionResponse = void 0;
class APIObjectActionResponse {
    constructor(oid, message = 'Request processed successfully', details = '') {
        this.oid = oid;
        this.message = message;
        this.details = details;
    }
}
exports.APIObjectActionResponse = APIObjectActionResponse;
