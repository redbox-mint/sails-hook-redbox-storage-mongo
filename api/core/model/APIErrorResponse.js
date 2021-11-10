"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.APIErrorResponse = void 0;
class APIErrorResponse {
    constructor(message = 'An error has occurred', details = '') {
        this.message = message;
        this.details = details;
    }
}
exports.APIErrorResponse = APIErrorResponse;
