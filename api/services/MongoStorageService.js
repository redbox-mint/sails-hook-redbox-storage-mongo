"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const Rx_1 = require("rxjs/Rx");
const services = require("../core/CoreService.js");
const StorageServiceResponse_js_1 = require("../core/StorageServiceResponse.js");
const uuid_1 = require("uuid");
const moment = require("moment");
const Attachment_1 = require("../core/Attachment");
const DatastreamServiceResponse_1 = require("../core/DatastreamServiceResponse");
const mongodb = require("mongodb");
const util = require("util");
const stream = require("stream");
const fs = require("fs");
const pipeline = util.promisify(stream.pipeline);
var Services;
(function (Services) {
    class MongoStorageService extends services.Services.Core.Service {
        constructor() {
            super();
            this.recordsService = null;
            this.logHeader = 'MongoStorageService::';
            this._exportedMethods = [
                'create',
                'updateMeta',
                'getMeta',
                'createBatch',
                'provideUserAccessAndRemovePendingAccess',
                'getRelatedRecords',
                'delete',
                'updateNotificationLog',
                'getRecords',
                'exportAllPlans',
                'getAttachments',
                'addDatastreams',
                'updateDatastream',
                'removeDatastream',
                'addDatastream',
                'addAndRemoveDatastreams',
                'getDatastream',
                'listDatastreams'
            ];
            let that = this;
            sails.on('ready', function () {
                that.recordsService = RecordsService;
                that.init();
            });
        }
        getUuid() {
            return uuid_1.v1().replace(/-/g, '');
        }
        init() {
            return __awaiter(this, void 0, void 0, function* () {
                this.db = Record.getDatastore().manager;
                try {
                    const collectionInfo = yield db.collection(Record.tableName, { strict: true });
                    sails.log.verbose(`${this.logHeader} Collection '${Record.tableName}' info:`);
                    sails.log.verbose(JSON.stringify(collectionInfo));
                }
                catch (err) {
                    sails.log.verbose(`Collection doesn't exist, creating: ${Record.tableName}`);
                    const uuid = this.getUuid();
                    const initRec = { redboxOid: uuid };
                    yield Record.create(initRec);
                    yield Record.destroyOne({ redboxOid: uuid });
                }
                this.gridFsBucket = new mongodb.GridFSBucket(this.db);
                yield this.createIndices(this.db);
            });
        }
        createIndices(db) {
            return __awaiter(this, void 0, void 0, function* () {
                sails.log.verbose(`${this.logHeader} Existing indices:`);
                const currentIndices = yield db.collection(Record.tableName).indexes();
                sails.log.verbose(JSON.stringify(currentIndices));
                try {
                    const indices = sails.config.storage.mongodb.indices;
                    if (_.size(indices) > 0) {
                        yield db.collection(Record.tableName).createIndexes(indices);
                    }
                }
                catch (err) {
                    sails.log.error(`Failed to create indices:`);
                    sails.log.error(JSON.stringify(err));
                }
            });
        }
        create(brand, record, recordType, user, triggerPreSaveTriggers, triggerPostSaveTriggers) {
            return __awaiter(this, void 0, void 0, function* () {
                sails.log.verbose(`${this.logHeader} create() -> Begin`);
                let response = new StorageServiceResponse_js_1.StorageServiceResponse();
                record.redboxOid = this.getUuid();
                response.oid = record.redboxOid;
                if (triggerPreSaveTriggers) {
                    sails.log.verbose(`${this.logHeader} Triggering pre-save hook...`);
                    record = yield this.recordsService.triggerPreSaveTriggers(null, record, recordType, "onCreate", user);
                }
                try {
                    sails.log.verbose(`${this.logHeader} Saving to DB...`);
                    yield Record.create(record);
                    response.success = true;
                    sails.log.verbose(`${this.logHeader} Record created...`);
                }
                catch (err) {
                    sails.log.error(`${this.logHeader} Failed to create Record:`);
                    sails.log.error(JSON.stringify(err));
                    response.success = false;
                    response.message = err.message;
                    return response;
                }
                if (triggerPostSaveTriggers) {
                    sails.log.verbose(`${this.logHeader} Triggering post-save...`);
                    try {
                        response = yield this.recordsService.triggerPostSaveSyncTriggers(response['oid'], record, recordType, 'onCreate', user, response);
                    }
                    catch (err) {
                        sails.log.error(`${this.logHeader} Exception while running post save sync hooks when creating:`);
                        sails.log.error(JSON.stringify(err));
                        response.success = false;
                        response.message = err.message;
                        return response;
                    }
                    this.recordsService.triggerPostSaveTriggers(response['oid'], record, recordType, 'onCreate', user);
                }
                sails.log.verbose(JSON.stringify(response));
                sails.log.verbose(`${this.logHeader} create() -> End`);
                return response;
            });
        }
        updateMeta(brand, oid, record, user, triggerPreSaveTriggers, triggerPostSaveTriggers) {
            return __awaiter(this, void 0, void 0, function* () {
                let response = new StorageServiceResponse_js_1.StorageServiceResponse();
                response.oid = oid;
                let recordType = null;
                if (!_.isEmpty(brand) && triggerPreSaveTriggers === true) {
                    try {
                        recordType = yield RecordTypesService.get(brand, record.metaMetadata.type).toPromise();
                        record = yield this.recordsService.triggerPreSaveTriggers(oid, record, recordType, "onUpdate", user);
                    }
                    catch (err) {
                        sails.log.error(`${this.logHeader} Failed to run pre-save hooks when updating..`);
                        sails.log.error(JSON.stringify(err));
                        response.message = err.message;
                        return response;
                    }
                }
                _.unset(record, 'id');
                _.unset(record, 'redboxOid');
                try {
                    yield Record.updateOne({ redboxOid: oid }).set(record);
                    response.success = true;
                }
                catch (err) {
                    sails.log.error(`${this.logHeader} Failed to save update to MongoDB:`);
                    sails.log.error(JSON.stringify(err));
                    response.success = false;
                    response.message = err;
                }
                if (!_.isEmpty(recordType) && triggerPostSaveTriggers === true) {
                    try {
                        response = yield this.recordsService.triggerPostSaveSyncTriggers(response['oid'], record, recordType, 'onCreate', user, response);
                    }
                    catch (err) {
                        sails.log.error(`${this.logHeader} Exception while running post save sync hooks when creating:`);
                        sails.log.error(JSON.stringify(err));
                        response.success = false;
                        response.message = err.message;
                        return response;
                    }
                    this.recordsService.triggerPostSaveTriggers(response['oid'], record, recordType, 'onCreate', user);
                }
                return response;
            });
        }
        getMeta(oid) {
            return __awaiter(this, void 0, void 0, function* () {
                if (_.isEmpty(oid)) {
                    const msg = `${this.logHeader} getMeta() -> refusing to search using an empty OID`;
                    sails.log.error(msg);
                    throw new Error(msg);
                }
                const criteria = { redboxOid: oid };
                sails.log.verbose(`${this.logHeader} finding: `);
                sails.log.verbose(JSON.stringify(criteria));
                return Record.findOne(criteria);
            });
        }
        createBatch(type, data, harvestIdFldName) {
            return __awaiter(this, void 0, void 0, function* () {
                const response = new StorageServiceResponse_js_1.StorageServiceResponse();
                response.message = "";
                let failFlag = false;
                _.each(data, (dataItem) => __awaiter(this, void 0, void 0, function* () {
                    dataItem.harvestId = _.get(dataItem, harvestIdFldName, '');
                    _.set(dataItem, 'metaMetadata.type', type);
                    try {
                        yield this.create(null, dataItem, null, null, false, false);
                    }
                    catch (err) {
                        failFlag = true;
                        sails.log.error(`${this.logHeader} Failed createBatch entry: `);
                        sails.log.error(JSON.stringify(dataItem));
                        sails.log.error(`${this.logHeader} Failed createBatch error: `);
                        sails.log.error(JSON.stringify(err));
                        response.message = `${response.message}, ${err.message}`;
                    }
                }));
                response.success = failFlag === false;
                return response;
            });
        }
        provideUserAccessAndRemovePendingAccess(oid, userid, pendingValue) {
            const batchFn = () => __awaiter(this, void 0, void 0, function* () {
                const metadata = yield this.getMeta(oid);
                var pendingEditArray = metadata['authorization']['editPending'];
                var editArray = metadata['authorization']['edit'];
                for (var i = 0; i < pendingEditArray.length; i++) {
                    if (pendingEditArray[i] == pendingValue) {
                        pendingEditArray = pendingEditArray.filter(e => e !== pendingValue);
                        editArray = editArray.filter(e => e !== userid);
                        editArray.push(userid);
                    }
                }
                metadata['authorization']['editPending'] = pendingEditArray;
                metadata['authorization']['edit'] = editArray;
                var pendingViewArray = metadata['authorization']['viewPending'];
                var viewArray = metadata['authorization']['view'];
                for (var i = 0; i < pendingViewArray.length; i++) {
                    if (pendingViewArray[i] == pendingValue) {
                        pendingViewArray = pendingViewArray.filter(e => e !== pendingValue);
                        viewArray = viewArray.filter(e => e !== userid);
                        viewArray.push(userid);
                    }
                }
                metadata['authorization']['viewPending'] = pendingViewArray;
                metadata['authorization']['view'] = viewArray;
                try {
                    yield this.updateMeta(null, oid, metadata);
                }
                catch (err) {
                    sails.log.error(`${this.logHeader} Failed to update on 'provideUserAccessAndRemovePendingAccess': `);
                    sails.log.error(JSON.stringify(err));
                }
            });
            batchFn();
        }
        getRelatedRecords(oid, brand, recordTypeName = null, mappingContext = null) {
            return __awaiter(this, void 0, void 0, function* () {
                let record = yield this.getMeta(oid);
                if (_.isEmpty(recordTypeName)) {
                    recordTypeName = record['metaMetadata']['type'];
                }
                let recordType = yield RecordTypesService.get(brand, recordTypeName).toPromise();
                if (_.isEmpty(mappingContext)) {
                    mappingContext = {
                        'processedRelationships': [],
                        'relatedObjects': {}
                    };
                }
                let relationships = [];
                let processedRelationships = [];
                processedRelationships.push(recordType.name);
                let relatedTo = recordType['relatedTo'];
                if (_.isArray(relatedTo)) {
                    let relatedRecords = null;
                    _.each(relatedTo, (relationship) => __awaiter(this, void 0, void 0, function* () {
                        sails.log.verbose(`${this.logHeader} Processing relationship:`);
                        sails.log.verbose(JSON.stringify(relationship));
                        relationships.push(relationship);
                        const recordType = relationship['recordType'];
                        const criteria = {};
                        criteria['metaMetadata.type'] = relationship['recordType'];
                        criteria[relationship['foreignField']] = oid;
                        sails.log.verbose(`${this.logHeader} Finding related records criteria:`);
                        sails.log.verbose(JSON.stringify(criteria));
                        const relatedRecords = yield Record.find(criteria);
                        const recordRelationships = relatedRecords[recordType];
                        let newRelatedObjects = {};
                        newRelatedObjects[recordType] = recordRelationships;
                        _.merge(mappingContext, {
                            relatedObjects: newRelatedObjects
                        });
                        if (_.indexOf(mappingContext['processedRelationships'], relationship['recordType']) < 0) {
                            mappingContext['processedRelationships'].push(recordType);
                            for (let j = 0; j < recordRelationships.length; j++) {
                                let recordRelationship = recordRelationships[j];
                                mappingContext = yield this.getRelatedRecords(recordRelationship.redboxOid, brand, relationship['recordType'], mappingContext);
                            }
                        }
                    }));
                    return mappingContext;
                }
                else {
                    sails.log.verbose(`${this.logHeader} RecordType has no relationships: ${recordTypeName}`);
                    return mappingContext;
                }
            });
        }
        delete(oid) {
            return __awaiter(this, void 0, void 0, function* () {
                const response = new StorageServiceResponse_js_1.StorageServiceResponse();
                try {
                    yield Record.destroyOne({ redboxOid: oid });
                }
                catch (err) {
                    sails.log.error(`${this.logHeader} Failed to delete record: ${oid}`);
                    sails.log.error(JSON.stringify(err));
                    response.success = false;
                    response.message = err.message;
                }
                return response;
            });
        }
        updateNotificationLog(oid, record, options) {
            const _super = Object.create(null, {
                metTriggerCondition: { get: () => super.metTriggerCondition }
            });
            return __awaiter(this, void 0, void 0, function* () {
                if (_super.metTriggerCondition.call(this, oid, record, options) == "true") {
                    sails.log.verbose(`${this.logHeader} Updating notification log for oid: ${oid}`);
                    const logName = _.get(options, 'logName', null);
                    if (logName) {
                        let log = _.get(record, logName, null);
                        const entry = { date: moment().format('YYYY-MM-DDTHH:mm:ss') };
                        if (log) {
                            log.push(entry);
                        }
                        else {
                            log = [entry];
                        }
                        _.set(record, logName, log);
                    }
                    const updateFlagName = _.get(options, 'flagName', null);
                    if (updateFlagName) {
                        _.set(record, updateFlagName, _.get(options, 'flagVal', null));
                    }
                    sails.log.verbose(`======== Notification log updates =========`);
                    sails.log.verbose(JSON.stringify(record));
                    sails.log.verbose(`======== End update =========`);
                    if (_.get(options, "saveRecord", false)) {
                        try {
                            const response = yield this.updateMeta(null, oid, record, null, false, false);
                        }
                        catch (err) {
                            sails.log.error(`${this.logHeader} Failed to update notification log of ${oid}:`);
                            sails.log.error(JSON.stringify(err));
                            throw err;
                        }
                    }
                }
                else {
                    sails.log.verbose(`Notification log name: '${options.name}', for oid: ${oid}, not running, condition not met: ${options.triggerCondition}`);
                    sails.log.verbose(JSON.stringify(record));
                }
                return record;
            });
        }
        getRecords(workflowState, recordType = undefined, start, rows = 10, username, roles, brand, editAccessOnly = undefined, packageType = undefined, sort = undefined) {
            return __awaiter(this, void 0, void 0, function* () {
                let query = {
                    "metaMetadata.brandId": brand.id
                };
                const options = {
                    limit: _.toNumber(rows),
                    skip: (start * rows)
                };
                if (_.isEmpty(sort)) {
                    sort = '{"lastSaveDate": -1}';
                }
                if (_.indexOf(`${sort}`, '1') == -1) {
                    sort = `{"${sort}":-1}`;
                }
                else {
                    sort = `{${sort}}`;
                }
                sails.log.verbose(`Sort is: ${sort}`);
                options['sort'] = JSON.parse(sort);
                let roleNames = this.getRoleNames(roles, brand);
                let andArray = [];
                let permissions = {
                    "$or": [{ "authorization.view": username },
                        { "authorization.edit": username },
                        { "authorization.editRoles": { "$in": roleNames } },
                        { "authorization.viewRoles": { "$in": roleNames } }]
                };
                andArray.push(permissions);
                if (!_.isUndefined(recordType) && !_.isEmpty(recordType)) {
                    let typeArray = [];
                    _.each(recordType, rType => {
                        typeArray.push({ "metaMetadata.type": rType });
                    });
                    let types = { "$or": typeArray };
                    andArray.push(types);
                }
                if (!_.isUndefined(packageType) && !_.isEmpty(packageType)) {
                    let typeArray = [];
                    _.each(packageType, rType => {
                        typeArray.push({ "packageType": rType });
                    });
                    let types = { "$or": typeArray };
                    andArray.push(types);
                }
                if (workflowState != undefined) {
                    query["workflow.stage"] = workflowState;
                }
                query['$and'] = andArray;
                sails.log.verbose(`Query: ${JSON.stringify(query)}`);
                sails.log.verbose(`Options: ${JSON.stringify(options)}`);
                const items = yield this.runQuery(Record.tableName, query, options);
                const response = new StorageServiceResponse_js_1.StorageServiceResponse();
                response.success = true;
                response.items = items;
                return response;
            });
        }
        runQuery(colName, query, options) {
            return __awaiter(this, void 0, void 0, function* () {
                var db = Record.getDatastore().manager;
                const col = yield db.collection(colName);
                return col.find(query, options).toArray();
            });
        }
        exportAllPlans(username, roles, brand, format, modBefore, modAfter, recType) {
            return __awaiter(this, void 0, void 0, function* () {
                let andArray = [];
                let query = {
                    "metaMetadata.brandId": brand.id,
                    "metaMetadata.type": recType
                };
                let roleNames = this.getRoleNames(roles, brand);
                let permissions = {
                    "$or": [{ "authorization.view": username },
                        { "authorization.edit": username },
                        { "authorization.editRoles": { "$in": roleNames } },
                        { "authorization.viewRoles": { "$in": roleNames } }]
                };
                andArray.push(permissions);
                const options = {
                    limit: _.toNumber(sails.config.record.export.maxRecords),
                    sort: {
                        lastSaveDate: -1
                    }
                };
                if (!_.isEmpty(modAfter)) {
                    andArray.push({
                        lastSaveDate: {
                            '$gte': new Date(`${modAfter}T00:00:00Z`)
                        }
                    });
                }
                if (!_.isEmpty(modBefore)) {
                    andArray.push({
                        lastSaveDate: {
                            '$lte': new Date(`${modBefore}T23:59:59Z`)
                        }
                    });
                }
                query['$and'] = andArray;
                sails.log.verbose(`Query: ${JSON.stringify(query)}`);
                sails.log.verbose(`Options: ${JSON.stringify(options)}`);
                return "";
            });
        }
        getRoleNames(roles, brand) {
            var roleNames = [];
            for (var i = 0; i < roles.length; i++) {
                var role = roles[i];
                if (role.branding == brand.id) {
                    roleNames.push(roles[i].name);
                }
            }
            return roleNames;
        }
        addDatastreams(oid, fileIds) {
            return __awaiter(this, void 0, void 0, function* () {
                const response = new DatastreamServiceResponse_1.default();
                response.message = '';
                for (const fileId of fileIds) {
                    try {
                        yield this.addDatastream(oid, fileId);
                        const successMessage = `Successfully uploaded: ${fileId}`;
                        response.message = _.isEmpty(response.message) ? successMessage : `${response.message}\n${successMessage}`;
                    }
                    catch (err) {
                        response.success = false;
                        const failureMessage = `Failed to uploead: ${fileId}, error is:\n${JSON.stringify(err)}`;
                        response.message = _.isEmpty(response.message) ? failureMessage : `${response.message}\n${failureMessage}`;
                    }
                }
                return response;
            });
        }
        updateDatastream(oid, record, newMetadata, fileRoot, fileIdsAdded) {
            return FormsService.getFormByName(record.metaMetadata.form, true)
                .flatMap(form => {
                const reqs = [];
                record.metaMetadata.attachmentFields = form.attachmentFields;
                _.each(form.attachmentFields, (attField) => __awaiter(this, void 0, void 0, function* () {
                    const oldAttachments = record.metadata[attField];
                    const newAttachments = newMetadata[attField];
                    const removeIds = [];
                    if (!_.isUndefined(oldAttachments) && !_.isNull(oldAttachments) && !_.isNull(newAttachments)) {
                        const toRemove = _.differenceBy(oldAttachments, newAttachments, 'fileId');
                        _.each(toRemove, (removeAtt) => {
                            if (removeAtt.type == 'attachment') {
                                removeIds.push(removeAtt.fileId);
                            }
                        });
                    }
                    if (!_.isUndefined(newAttachments) && !_.isNull(newAttachments)) {
                        const toAdd = _.differenceBy(newAttachments, oldAttachments, 'fileId');
                        _.each(toAdd, (addAtt) => {
                            if (addAtt.type == 'attachment') {
                                fileIdsAdded.push(addAtt.fileId);
                            }
                        });
                    }
                    reqs.push(this.addAndRemoveDatastreams(oid, fileIdsAdded, removeIds));
                }));
                return Rx_1.Observable.of(reqs);
            });
        }
        removeDatastream(oid, fileId) {
            return __awaiter(this, void 0, void 0, function* () {
                const fileName = `${oid}/${fileId}`;
                const fileRes = yield this.getFileWithName(fileName).toArray();
                if (!_.isEmpty(fileRes)) {
                    const fileDoc = fileRes[0];
                    sails.log.verbose(`${this.logHeader} removeDatastream() -> Deleting:`);
                    sails.log.verbose(JSON.stringify(fileDoc));
                    const gridFsDelete = util.promisify(this.gridFsBucket.delete);
                    yield gridFsDelete(fileDoc['_id']);
                    sails.log.verbose(`${this.logHeader} removeDatastream() -> Delete successful.`);
                }
                else {
                    sails.log.verbose(`${this.logHeader} removeDatastream() -> File not found: ${fileName}`);
                }
            });
        }
        addDatastream(oid, fileId) {
            return __awaiter(this, void 0, void 0, function* () {
                const fpath = `${sails.config.record.attachments.stageDir}/${fileId}`;
                const fileName = `${oid}/${fileId}`;
                sails.log.verbose(`${this.logHeader} addDatastream() -> Adding: ${fileName}`);
                yield pipeline(fs.createReadStream(fpath), this.gridFsBucket.openUploadStream(fileName));
                sails.log.verbose(`${this.logHeader} addDatastream() -> Successfully added: ${fileName}`);
            });
        }
        addAndRemoveDatastreams(oid, addIds, removeIds) {
            return __awaiter(this, void 0, void 0, function* () {
                for (const addId of addIds) {
                    yield this.addDatastream(oid, addId);
                }
                for (const removeId of removeIds) {
                    yield this.removeDatastream(oid, removeId);
                }
            });
        }
        getDatastream(oid, fileId) {
            const fileName = `${oid}/${fileId}`;
            sails.log.verbose(`${this.logHeader} getDatastream() -> Getting: ${fileName}`);
            const response = new Attachment_1.default();
            response.readstream = this.gridFsBucket.openDownloadStreamByName(fileName);
            return Rx_1.Observable.of(response);
        }
        listDatastreams(oid, fileId) {
            return __awaiter(this, void 0, void 0, function* () {
                const fileName = `${oid}/${fileId}`;
                sails.log.verbose(`${this.logHeader} listDatastreams() -> Listing: ${fileName}`);
                return this.gridFsBucket.find({ filename: fileName }, {});
            });
        }
        getFileWithName(fileName, options = { limit: 1 }) {
            return this.gridFsBucket.find({ filename: fileName }, options);
        }
    }
    Services.MongoStorageService = MongoStorageService;
})(Services = exports.Services || (exports.Services = {}));
module.exports = new Services.MongoStorageService().exports();
