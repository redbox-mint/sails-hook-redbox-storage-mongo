"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecordAuditModel = void 0;
const moment = require("moment");
class RecordAuditModel {
    constructor(oid, record, user) {
        if (!_.isEmpty(user.password)) {
            delete user.password;
        }
        this.redboxOid = oid;
        this.record = record;
        this.user = user;
        this.dateCreated = moment();
    }
}
exports.RecordAuditModel = RecordAuditModel;
