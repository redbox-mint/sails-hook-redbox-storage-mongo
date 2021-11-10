"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.APIActionResponse = void 0;
class APIActionResponse {
    constructor(message = 'Request processed successfully', details = '') {
        this.message = message;
        this.details = details;
    }
}
exports.APIActionResponse = APIActionResponse;
