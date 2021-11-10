"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageServiceResponse = void 0;
class StorageServiceResponse {
    constructor() {
    }
    isSuccessful() {
        return this.success === true;
    }
}
exports.StorageServiceResponse = StorageServiceResponse;
exports.default = StorageServiceResponse;
