"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i;
    function verb(n) { if (g[n]) i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Services = void 0;
const Rx_1 = require("rxjs/Rx");
const uuid_1 = require("uuid");
const moment = require("moment");
const mongodb = require("mongodb");
const util = require("util");
const stream = require("stream");
const fs = require("fs");
const json2csv_1 = require("json2csv");
const redbox_core_types_1 = require("@researchdatabox/redbox-core-types");
const { transforms: { unwind, flatten } } = require('json2csv');
const ExportJSONTransformer = require('../../transformer/ExportJSONTransformer');
const pipeline = util.promisify(stream.pipeline);
var Services;
(function (Services) {
    class MongoStorageService extends redbox_core_types_1.Services.Core.Service {
        constructor() {
            super();
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
                'addDatastreams',
                'updateDatastream',
                'removeDatastream',
                'addDatastream',
                'addAndRemoveDatastreams',
                'getDatastream',
                'listDatastreams',
                'createRecordAudit'
            ];
            this.logHeader = 'MongoStorageService::';
            let that = this;
            sails.on('ready', function () {
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
                    const collectionInfo = yield this.db.collection(Record.tableName, { strict: true });
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
                this.recordCol = yield this.db.collection(Record.tableName);
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
        create(brand, record, recordType, user) {
            return __awaiter(this, void 0, void 0, function* () {
                sails.log.verbose(`${this.logHeader} create() -> Begin`);
                let response = new redbox_core_types_1.StorageServiceResponse();
                record.redboxOid = this.getUuid();
                response.oid = record.redboxOid;
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
                sails.log.verbose(JSON.stringify(response));
                sails.log.verbose(`${this.logHeader} create() -> End`);
                return response;
            });
        }
        updateMeta(brand, oid, record, user) {
            return __awaiter(this, void 0, void 0, function* () {
                let response = new redbox_core_types_1.StorageServiceResponse();
                response.oid = oid;
                try {
                    _.unset(record, 'dateCreated');
                    _.unset(record, 'lastSaveDate');
                    yield Record.updateOne({ redboxOid: oid }).set(record);
                    response.success = true;
                }
                catch (err) {
                    sails.log.error(`${this.logHeader} Failed to save update to MongoDB:`);
                    sails.log.error(JSON.stringify(err));
                    response.success = false;
                    response.message = err;
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
                const response = new redbox_core_types_1.StorageServiceResponse();
                response.message = "";
                let failFlag = false;
                _.each(data, (dataItem) => __awaiter(this, void 0, void 0, function* () {
                    dataItem.harvestId = _.get(dataItem, harvestIdFldName, '');
                    _.set(dataItem, 'metaMetadata.type', type);
                    try {
                        yield this.create(null, dataItem, null, null);
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
                        'processedRelationships': [recordTypeName],
                        'relatedObjects': {}
                    };
                    mappingContext.relatedObjects[recordTypeName] = [record];
                }
                let relatedTo = recordType['relatedTo'];
                if (_.isArray(relatedTo) && _.size(relatedTo) > 0) {
                    for (let relationship of relatedTo) {
                        sails.log.verbose(`${this.logHeader} Processing relationship:`);
                        sails.log.verbose(JSON.stringify(relationship));
                        const targetRecordType = relationship['recordType'];
                        const criteria = {};
                        criteria['metaMetadata.type'] = targetRecordType;
                        criteria[relationship['foreignField']] = oid;
                        sails.log.verbose(`${this.logHeader} Finding related records criteria:`);
                        sails.log.verbose(JSON.stringify(criteria));
                        const relatedRecords = yield Record.find(criteria).meta({ enableExperimentalDeepTargets: true });
                        sails.log.verbose(`${this.logHeader} Got related records:`);
                        sails.log.verbose(JSON.stringify(relatedRecords));
                        if (_.size(relatedRecords) > 0) {
                            if (_.isEmpty(mappingContext.relatedObjects[targetRecordType])) {
                                mappingContext.relatedObjects[targetRecordType] = relatedRecords;
                            }
                            else {
                                mappingContext.relatedObjects[targetRecordType] = mappingContext.relatedObjects[targetRecordType].concat(relatedRecords);
                            }
                            for (let j = 0; j < relatedRecords.length; j++) {
                                let recordRelationship = relatedRecords[j];
                                mappingContext = yield this.getRelatedRecords(recordRelationship.redboxOid, brand, null, mappingContext);
                            }
                        }
                        if (!_.includes(mappingContext.processedRelationships, targetRecordType)) {
                            mappingContext.processedRelationships.push(targetRecordType);
                        }
                    }
                }
                else {
                    sails.log.verbose(`${this.logHeader} RecordType has no relationships: ${recordTypeName}`);
                }
                sails.log.verbose(`${this.logHeader} Current mapping context:`);
                sails.log.verbose(JSON.stringify(mappingContext));
                return mappingContext;
            });
        }
        delete(oid) {
            return __awaiter(this, void 0, void 0, function* () {
                const response = new redbox_core_types_1.StorageServiceResponse();
                try {
                    yield Record.destroyOne({ redboxOid: oid });
                    const datastreams = yield this.listDatastreams(oid, null);
                    if (_.size(datastreams) > 0) {
                        _.each(datastreams, (file) => {
                            sails.log.verbose(`Deleting:`);
                            sails.log.verbose(JSON.stringify(file));
                            this.gridFsBucket.delete(file['_id'], (err, res) => {
                                if (err) {
                                    sails.log.error(`Error deleting: ${file['_id']}`);
                                    sails.log.error(JSON.stringify(err));
                                }
                            });
                        });
                    }
                    response.success = true;
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
                            const response = yield this.updateMeta(null, oid, record, null);
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
        getRecords(workflowState, recordType = undefined, start, rows = 10, username, roles, brand, editAccessOnly = undefined, packageType = undefined, sort = undefined, filterFields = undefined, filterString = undefined) {
            return __awaiter(this, void 0, void 0, function* () {
                let query = {
                    "metaMetadata.brandId": brand.id
                };
                const options = {
                    limit: _.toNumber(rows),
                    skip: _.toNumber(start)
                };
                if (_.isEmpty(sort)) {
                    sort = '{"lastSaveDate": -1}';
                }
                sails.log.verbose(`Sort is: ${sort}`);
                if (_.indexOf(`${sort}`, '1') == -1) {
                    sort = `{"${sort}":-1}`;
                }
                else {
                    try {
                        options['sort'] = JSON.parse(sort);
                    }
                    catch (error) {
                        options['sort'] = {};
                        options['sort'][`${sort.substring(0, sort.indexOf(':'))}`] = _.toNumber(sort.substring(sort.indexOf(':') + 1));
                    }
                }
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
                        typeArray.push({ "metaMetadata.packageType": rType });
                    });
                    let types = { "$or": typeArray };
                    andArray.push(types);
                }
                if (workflowState != undefined) {
                    query["workflow.stage"] = workflowState;
                }
                if (!_.isEmpty(filterString) && !_.isEmpty(filterFields)) {
                    let escapedFilterString = this.escapeRegExp(filterString);
                    for (let filterField of filterFields) {
                        let filterQuery = {};
                        filterQuery[filterField] = new RegExp(`.*${filterString}.*`);
                        andArray.push(filterQuery);
                    }
                }
                query['$and'] = andArray;
                sails.log.verbose(`Query: ${JSON.stringify(query)}`);
                sails.log.verbose(`Options: ${JSON.stringify(options)}`);
                const { items, totalItems } = yield this.runRecordQuery(Record.tableName, query, options);
                const response = new redbox_core_types_1.StorageServiceResponse();
                response.success = true;
                response.items = items;
                response.totalItems = totalItems;
                return response;
            });
        }
        escapeRegExp(string) {
            return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }
        runRecordQuery(colName, query, options) {
            return __awaiter(this, void 0, void 0, function* () {
                return { items: yield this.recordCol.find(query, options).toArray(), totalItems: yield this.recordCol.count(query) };
            });
        }
        fetchAllRecords(query, options, stringifyJSON = false) {
            return __asyncGenerator(this, arguments, function* fetchAllRecords_1() {
                let skip = 0;
                let limit = options.limit;
                options.skip = skip;
                sails.log.error(JSON.stringify(query));
                sails.log.error(JSON.stringify(options));
                let result = yield __await(this.recordCol.find(query, options).toArray());
                sails.log.error(result);
                while (result.length > 0) {
                    for (let record of result) {
                        if (stringifyJSON) {
                            yield yield __await(JSON.stringify(record));
                        }
                        else {
                            yield yield __await(record);
                        }
                    }
                    skip = skip + limit;
                    options.skip = skip;
                    result = yield __await(this.recordCol.find(query, options).toArray());
                }
            });
        }
        exportAllPlans(username, roles, brand, format, modBefore, modAfter, recType) {
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
                limit: 2,
                sort: {
                    lastSaveDate: -1
                }
            };
            if (!_.isEmpty(modAfter)) {
                andArray.push({
                    lastSaveDate: {
                        '$gte': `${modAfter}`
                    }
                });
            }
            if (!_.isEmpty(modBefore)) {
                let modBeforeString = moment(modBefore, 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD');
                andArray.push({
                    lastSaveDate: {
                        '$lte': `${modBeforeString}`
                    }
                });
            }
            query['$and'] = andArray;
            sails.log.verbose(`Query: ${JSON.stringify(query)}`);
            sails.log.verbose(`Options: ${JSON.stringify(options)}`);
            if (format == 'csv') {
                const opts = { transforms: [flatten()] };
                const transformOpts = { objectMode: true };
                const json2csv = new json2csv_1.Transform(opts, transformOpts);
                return stream.Readable.from(this.fetchAllRecords(query, options)).pipe(json2csv);
            }
            const jsonTransformer = new ExportJSONTransformer(recType, modBefore, modAfter);
            return stream.Readable.from(this.fetchAllRecords(query, options, true)).pipe(jsonTransformer);
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
                const response = new redbox_core_types_1.DatastreamServiceResponse();
                response.message = '';
                let hasFailure = false;
                for (const fileId of fileIds) {
                    try {
                        yield this.addDatastream(oid, fileId);
                        const successMessage = `Successfully uploaded: ${JSON.stringify(fileId)}`;
                        response.message = _.isEmpty(response.message) ? successMessage : `${response.message}\n${successMessage}`;
                    }
                    catch (err) {
                        hasFailure = true;
                        const failureMessage = `Failed to upload: ${JSON.stringify(fileId)}, error is:\n${JSON.stringify(err)}`;
                        response.message = _.isEmpty(response.message) ? failureMessage : `${response.message}\n${failureMessage}`;
                    }
                }
                response.success = !hasFailure;
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
                                removeIds.push(new redbox_core_types_1.Datastream(removeAtt));
                            }
                        });
                    }
                    if (!_.isUndefined(newAttachments) && !_.isNull(newAttachments)) {
                        const toAdd = _.differenceBy(newAttachments, oldAttachments, 'fileId');
                        _.each(toAdd, (addAtt) => {
                            if (addAtt.type == 'attachment') {
                                fileIdsAdded.push(new redbox_core_types_1.Datastream(addAtt));
                            }
                        });
                    }
                    reqs.push(this.addAndRemoveDatastreams(oid, fileIdsAdded, removeIds));
                }));
                if (_.isEmpty(reqs)) {
                    reqs.push(Rx_1.Observable.of({ "request": "dummy" }));
                }
                return Rx_1.Observable.of(reqs);
            });
        }
        removeDatastream(oid, datastream) {
            return __awaiter(this, void 0, void 0, function* () {
                const fileId = datastream.fileId;
                const fileName = `${oid}/${fileId}`;
                const fileRes = yield this.getFileWithName(fileName).toArray();
                if (!_.isEmpty(fileRes)) {
                    const fileDoc = fileRes[0];
                    sails.log.verbose(`${this.logHeader} removeDatastream() -> Deleting:`);
                    sails.log.verbose(JSON.stringify(fileDoc));
                    this.gridFsBucket.delete(fileDoc['_id'], (err, res) => {
                        if (err) {
                            sails.log.error(`Error deleting: ${fileDoc['_id']}`);
                            sails.log.error(JSON.stringify(err));
                        }
                    });
                    sails.log.verbose(`${this.logHeader} removeDatastream() -> Delete successful.`);
                }
                else {
                    sails.log.verbose(`${this.logHeader} removeDatastream() -> File not found: ${fileName}`);
                }
            });
        }
        addDatastream(oid, datastream) {
            return __awaiter(this, void 0, void 0, function* () {
                const fileId = datastream.fileId;
                sails.log.verbose(`${this.logHeader} addDatastream() -> Meta: ${fileId}`);
                sails.log.verbose(JSON.stringify(datastream));
                const metadata = _.merge(datastream.metadata, { redboxOid: oid });
                const fpath = `${sails.config.record.attachments.stageDir}/${fileId}`;
                const fileName = `${oid}/${fileId}`;
                sails.log.verbose(`${this.logHeader} addDatastream() -> Adding: ${fileName}`);
                yield pipeline(fs.createReadStream(fpath), this.gridFsBucket.openUploadStream(fileName, { metadata: metadata }));
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
            const response = new redbox_core_types_1.Attachment();
            response.readstream = this.gridFsBucket.openDownloadStreamByName(fileName);
            return Rx_1.Observable.of(response);
        }
        listDatastreams(oid, fileId) {
            return __awaiter(this, void 0, void 0, function* () {
                let query = { "metadata.redboxOid": oid };
                if (!_.isEmpty(fileId)) {
                    const fileName = `${oid}/${fileId}`;
                    query = { filename: fileName };
                }
                sails.log.verbose(`${this.logHeader} listDatastreams() -> Listing attachments of oid: ${oid}`);
                sails.log.verbose(JSON.stringify(query));
                return this.gridFsBucket.find(query, {}).toArray();
            });
        }
        createRecordAudit(recordAudit) {
            return __awaiter(this, void 0, void 0, function* () {
                let response = new redbox_core_types_1.StorageServiceResponse();
                try {
                    sails.log.verbose(`${this.logHeader} Saving to DB...`);
                    yield RecordAudit.create(recordAudit);
                    let savedRecordAudit = recordAudit;
                    response.oid = savedRecordAudit._id;
                    response.success = true;
                    sails.log.verbose(`${this.logHeader} Record Audit created...`);
                }
                catch (err) {
                    sails.log.error(`${this.logHeader} Failed to create Record Audit:`);
                    sails.log.error(JSON.stringify(err));
                    response.success = false;
                    response.message = err.message;
                    return response;
                }
                sails.log.verbose(JSON.stringify(response));
                sails.log.verbose(`${this.logHeader} create() -> End`);
                return response;
            });
        }
        getFileWithName(fileName, options = { limit: 1 }) {
            return this.gridFsBucket.find({ filename: fileName }, options);
        }
    }
    Services.MongoStorageService = MongoStorageService;
})(Services = exports.Services || (exports.Services = {}));
module.exports = new Services.MongoStorageService().exports();
