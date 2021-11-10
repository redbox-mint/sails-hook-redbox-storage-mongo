"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListAPISummary = exports.ListAPIResponse = void 0;
class ListAPIResponse {
    constructor() {
        this.summary = new ListAPISummary();
    }
}
exports.ListAPIResponse = ListAPIResponse;
class ListAPISummary {
    constructor() {
        this.numFound = 0;
        this.page = 1;
        this.start = 0;
    }
}
exports.ListAPISummary = ListAPISummary;
