import {
  Observable
} from 'rxjs/Rx';

import { Sails, Model } from "sails";
import { v1 as uuidv1 } from 'uuid';
import moment = require('moment');

import mongodb = require('mongodb');
import util = require('util');
import stream = require('stream');
import * as fs from 'fs';
import { Transform } from 'json2csv';
import { Services as services, DatastreamService, StorageService, StorageServiceResponse, DatastreamServiceResponse, Datastream, Attachment, RecordAuditModel, RecordAuditParams } from '@researchdatabox/redbox-core-types';
const { transforms: { unwind, flatten } } = require('json2csv');
const ExportJSONTransformer = require('../../transformer/ExportJSONTransformer')


const pipeline = util.promisify(stream.pipeline);

declare var sails: Sails;
declare var _;
declare var Record:Model, RecordTypesService, TranslationService, FormsService, RecordAudit;

export module Services {
  /**
   * Stores ReDBox records in MongoDB.
   *
   * Notes:
   * - Primary
   *
   * Author: <a href='https://github.com/shilob' target='_blank'>Shilo Banihit</a>
   *
   */
  export class MongoStorageService extends services.Core.Service implements StorageService, DatastreamService {
    gridFsBucket: any;
    db: any;
    recordCol: any;

    protected _exportedMethods: any = [
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
      'createRecordAudit',
      'getRecordAudit'
    ];

    constructor() {
      super();
      this.logHeader = 'MongoStorageService::';
      let that = this;
      sails.on('ready', function() {
        that.init();
      });
    }

    private getUuid():string {
      return uuidv1().replace(/-/g, '');
    }

    private async init() {
      this.db = Record.getDatastore().manager;
      // check if the collection exists ...
      try {
        const collectionInfo = await this.db.collection(Record.tableName, {strict:true});
        sails.log.verbose(`${this.logHeader} Collection '${Record.tableName}' info:`);
        sails.log.verbose(JSON.stringify(collectionInfo));
      } catch (err) {
        sails.log.verbose(`Collection doesn't exist, creating: ${Record.tableName}`);
        const uuid = this.getUuid();
        const initRec = {redboxOid: uuid};
        await Record.create(initRec);
        await Record.destroyOne({redboxOid: uuid});
      }
      this.gridFsBucket = new mongodb.GridFSBucket(this.db);
      this.recordCol = await this.db.collection(Record.tableName);
      await this.createIndices(this.db);
    }

    private async createIndices(db) {
      sails.log.verbose(`${this.logHeader} Existing indices:`);
      const currentIndices = await db.collection(Record.tableName).indexes();
      sails.log.verbose(JSON.stringify(currentIndices));
      // creating indices...
      // Version as of writing: http://mongodb.github.io/node-mongodb-native/3.6/api/Collection.html#createIndexes
      try {
        const indices = sails.config.storage.mongodb.indices;
        if (_.size(indices) > 0) {
          // TODO: check if indices already exists
          await db.collection(Record.tableName).createIndexes(indices);
        }
      } catch (err) {
        sails.log.error(`Failed to create indices:`);
        sails.log.error(JSON.stringify(err));
      }
    }

    public async create(brand, record, recordType, user?):Promise<any> {
      sails.log.verbose(`${this.logHeader} create() -> Begin`);
      let response = new StorageServiceResponse();
      // Create DB entry
      record.redboxOid = this.getUuid();
      response.oid = record.redboxOid;

      try {
        sails.log.verbose(`${this.logHeader} Saving to DB...`);
        await Record.create(record);
        response.success = true;
        sails.log.verbose(`${this.logHeader} Record created...`);
      } catch (err) {
        sails.log.error(`${this.logHeader} Failed to create Record:`);
        sails.log.error(JSON.stringify(err));
        response.success = false;
        response.message = err.message;
        return response;
      }
      sails.log.verbose(JSON.stringify(response));
      sails.log.verbose(`${this.logHeader} create() -> End`);
      return response;
    }

    public async updateMeta(brand, oid, record, user?): Promise<any> {
      let response = new StorageServiceResponse();
      response.oid = oid;
      try {
        // Fixes: https://github.com/redbox-mint/redbox-portal/issues/800
        _.unset(record, 'dateCreated');
        _.unset(record, 'lastSaveDate');
        await Record.updateOne({redboxOid: oid}).set(record);
        response.success = true;
      } catch (err) {
        sails.log.error(`${this.logHeader} Failed to save update to MongoDB:`);
        sails.log.error(JSON.stringify(err));
        response.success = false;
        response.message = err;
      }
      return response;
    }

    public async getMeta(oid): Promise<any> {
      // let response = new StorageServiceResponse();
      // const rec = await Record.findOne({id: oid});
      // rec.success = true;
      // rec.
      if (_.isEmpty(oid)) {
        const msg = `${this.logHeader} getMeta() -> refusing to search using an empty OID`;
        sails.log.error(msg);
        throw new Error(msg);
      }
      const criteria = {redboxOid: oid};
      sails.log.verbose(`${this.logHeader} finding: `);
      sails.log.verbose(JSON.stringify(criteria));
      return Record.findOne(criteria);
    }

    public async createBatch(type, data, harvestIdFldName): Promise<any> {
      const response = new StorageServiceResponse();
      response.message = "";
      let failFlag = false;
      _.each(data, async (dataItem) => {
        dataItem.harvestId = _.get(dataItem, harvestIdFldName, '');
        _.set(dataItem, 'metaMetadata.type', type);
        try {
          await this.create(null, dataItem, null, null);
        } catch (err) {
          failFlag = true;
          sails.log.error(`${this.logHeader} Failed createBatch entry: `);
          sails.log.error(JSON.stringify(dataItem));
          sails.log.error(`${this.logHeader} Failed createBatch error: `);
          sails.log.error(JSON.stringify(err));
          response.message = `${response.message}, ${err.message}`;
        }
      });
      response.success = failFlag === false;
      return response;
    }

    public provideUserAccessAndRemovePendingAccess(oid, userid, pendingValue): void {
      const batchFn = async ()=> {
        const metadata = await this.getMeta(oid);
        // remove pending edit access and add real edit access with userid
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
          await this.updateMeta(null, oid, metadata);
        } catch (err) {
          sails.log.error(`${this.logHeader} Failed to update on 'provideUserAccessAndRemovePendingAccess': `);
          sails.log.error(JSON.stringify(err));
        }
      };
      batchFn();
    }

    public async getRelatedRecords(oid, brand, recordTypeName:any = null, mappingContext: any = null) {
      let record = await this.getMeta(oid);
      if (_.isEmpty(recordTypeName)) {
        recordTypeName = record['metaMetadata']['type'];
      }
      let recordType = await RecordTypesService.get(brand, recordTypeName).toPromise();
      if (_.isEmpty(mappingContext)) {
        mappingContext = {
          'processedRelationships': [recordTypeName],
          'relatedObjects': {}
        };
        // add this records so it can be updated too!
        mappingContext.relatedObjects[recordTypeName] = [record];
      }
      let relatedTo = recordType['relatedTo'];
      if (_.isArray(relatedTo) && _.size(relatedTo) > 0) {
        for (let relationship of relatedTo) {
          sails.log.verbose(`${this.logHeader} Processing relationship:`);
          sails.log.verbose(JSON.stringify(relationship));
          const targetRecordType = relationship['recordType'];
          // retrieve the related records from the DB...
          const criteria:any = {};
          criteria['metaMetadata.type'] = targetRecordType;
          criteria[relationship['foreignField']] = oid;
          sails.log.verbose(`${this.logHeader} Finding related records criteria:`);
          sails.log.verbose(JSON.stringify(criteria));

          const relatedRecords = await Record.find(criteria).meta({enableExperimentalDeepTargets:true});
          sails.log.verbose(`${this.logHeader} Got related records:`);
          sails.log.verbose(JSON.stringify(relatedRecords));
          if (_.size(relatedRecords) > 0) {
            if (_.isEmpty(mappingContext.relatedObjects[targetRecordType])) {
              mappingContext.relatedObjects[targetRecordType] = relatedRecords;
            } else {
              mappingContext.relatedObjects[targetRecordType] = mappingContext.relatedObjects[targetRecordType].concat(relatedRecords);
            }
            for (let j = 0; j < relatedRecords.length; j++) {
              let recordRelationship = relatedRecords[j];
              mappingContext = await this.getRelatedRecords(recordRelationship.redboxOid, brand, null, mappingContext);
            }
          }
          if (!_.includes(mappingContext.processedRelationships, targetRecordType)) {
            mappingContext.processedRelationships.push(targetRecordType);
          }
        }
      } else {
        sails.log.verbose(`${this.logHeader} RecordType has no relationships: ${recordTypeName}`);
      }
      sails.log.verbose(`${this.logHeader} Current mapping context:`);
      sails.log.verbose(JSON.stringify(mappingContext));
      return mappingContext;
    }


    public async delete(oid) {
      const response = new StorageServiceResponse();
      try {
        await Record.destroyOne({redboxOid: oid});
        const datastreams = await this.listDatastreams(oid, null);
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
      } catch (err) {
        sails.log.error(`${this.logHeader} Failed to delete record: ${oid}`);
        sails.log.error(JSON.stringify(err));
        response.success = false;
        response.message = err.message;
      }
      return response;
    }

    public async updateNotificationLog(oid, record, options): Promise<any> {
      if (super.metTriggerCondition(oid, record, options) == "true") {
        sails.log.verbose(`${this.logHeader} Updating notification log for oid: ${oid}`);
        const logName = _.get(options, 'logName', null);
        if (logName) {
          let log = _.get(record, logName, null);
          const entry = { date: moment().format('YYYY-MM-DDTHH:mm:ss') };
          if (log) {
            log.push(entry);
          } else {
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
        // ready to update
        if (_.get(options, "saveRecord", false)) {
          try {
            const response = await this.updateMeta(null, oid, record, null);
          } catch (err) {
            sails.log.error(`${this.logHeader} Failed to update notification log of ${oid}:`);
            sails.log.error(JSON.stringify(err));
            throw err;
          }
        }
      } else {
        sails.log.verbose(`Notification log name: '${options.name}', for oid: ${oid}, not running, condition not met: ${options.triggerCondition}`);
        sails.log.verbose(JSON.stringify(record));
      }
      // no updates or condition not met ... just return the record
      return record;
    }

    public async getRecords(workflowState, recordType = undefined, start, rows = 10, username, roles, brand, editAccessOnly = undefined, packageType = undefined, sort=undefined, filterFields = undefined, filterString = undefined) {
      // BrandId ...
      let query = {
        "metaMetadata.brandId": brand.id
      };
      // Paginate ...
      const options = {
        limit: _.toNumber(rows),
        skip: _.toNumber(start)
      }
      // Sort ...defaults to lastSaveDate
      if (_.isEmpty(sort)) {
        sort = '{"lastSaveDate": -1}';
      }
      sails.log.verbose(`Sort is: ${sort}`);
      if (_.indexOf(`${sort}`, '1') == -1) {
        // if only the field is specified, default to descending...
        sort = `{"${sort}":-1}`;
      } else {
        try {
          options['sort'] = JSON.parse(sort);
        } catch (error) {
          // trying to massage this to valid JSON
          options['sort'] = {};
          options['sort'][`${sort.substring(0, sort.indexOf(':'))}`] = _.toNumber(sort.substring(sort.indexOf(':') + 1));
        }
      }
      // Authorization ...
      let roleNames = this.getRoleNames(roles, brand);
      let andArray = [];
      let permissions = {
        "$or": [{ "authorization.view": username },
        { "authorization.edit": username },
        { "authorization.editRoles": { "$in": roleNames } },
        { "authorization.viewRoles": { "$in": roleNames } }]
      };
      andArray.push(permissions);
      // Metadata type...
      if (!_.isUndefined(recordType) && !_.isEmpty(recordType)) {
        let typeArray = [];
        _.each(recordType, rType => {
          typeArray.push({ "metaMetadata.type": rType });
        });
        let types = { "$or": typeArray };
        andArray.push(types);
      }
      // Package type...
      if (!_.isUndefined(packageType) && !_.isEmpty(packageType)) {
        let typeArray = [];
        _.each(packageType, rType => {
          typeArray.push({ "metaMetadata.packageType": rType });
        });
        let types = { "$or": typeArray };
        andArray.push(types);
      }
      // Workflow ...
      if (workflowState != undefined) {
        query["workflow.stage"] = workflowState;
      }
      if (!_.isEmpty(filterString) && !_.isEmpty(filterFields)) {
        let escapedFilterString = this.escapeRegExp(filterString)
        for (let filterField of filterFields) {
            let filterQuery = {};
            filterQuery[filterField] = new RegExp(`.*${filterString}.*`);
            andArray.push(filterQuery);
        }
    }

      query['$and'] = andArray;

      sails.log.verbose(`Query: ${JSON.stringify(query)}`);
      sails.log.verbose(`Options: ${JSON.stringify(options)}`);
      const {items, totalItems} = await this.runRecordQuery(Record.tableName, query, options);
      const response = new StorageServiceResponse();
      response.success = true;
      response.items = items;
      response.totalItems = totalItems;
      return response;
    }

    private escapeRegExp(string) {
      return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    protected async runRecordQuery(colName, query, options) {
      return { items: await this.recordCol.find(query, options).toArray(), totalItems: await this.recordCol.count(query) } ;
    }

    private async * fetchAllRecords(query, options, stringifyJSON:boolean = false) {
      let skip = 0;
      let limit = options.limit;
      options.skip = skip;
      let result =  await this.recordCol.find(query, options).toArray();

      while(result.length > 0) {
        for(let record of result) {
          if(stringifyJSON) {
            yield JSON.stringify(record);
          } else {
            yield record;
          }
        }
        skip = skip + limit;
        options.skip = skip;
        result =  await this.recordCol.find(query, options).toArray();

      }
    }

    public exportAllPlans(username, roles, brand, format, modBefore, modAfter, recType): stream.Readable {
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
            '$gte': `${modAfter}`
          }
        });
      }
      if (!_.isEmpty(modBefore)) {
        let modBeforeString = moment(modBefore, 'YYYY-MM-DD' ).add(1,'days').format('YYYY-MM-DD')
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
        const opts = {transforms: [flatten()]};
        const transformOpts = { objectMode: true };
        const json2csv = new Transform(opts, transformOpts);
        return stream.Readable.from(this.fetchAllRecords(query, options)).pipe(json2csv);
      }

      //TODO: incorporate object mode so that JSON.stringify is handled in the Transformer rather than fetch
      const jsonTransformer = new ExportJSONTransformer(recType,modBefore,modAfter);
      return stream.Readable.from(this.fetchAllRecords(query, options, true)).pipe(jsonTransformer);
    }

    protected getRoleNames(roles, brand) {
      var roleNames = [];

      for (var i = 0; i < roles.length; i++) {
        var role = roles[i]
        if (role.branding == brand.id) {
          roleNames.push(roles[i].name);
        }
      }

      return roleNames;
    }


    public async addDatastreams(oid: string, fileIds: Datastream[]): Promise<DatastreamServiceResponse> {
      const response = new DatastreamServiceResponse();
      response.message = '';
      let hasFailure = false;
      for (const fileId of fileIds) {
        try {
          await this.addDatastream(oid, fileId);
          const successMessage = `Successfully uploaded: ${JSON.stringify(fileId)}`;
          response.message = _.isEmpty(response.message) ? successMessage :  `${response.message}\n${successMessage}`;
        } catch (err) {
          hasFailure = true;
          const failureMessage = `Failed to upload: ${JSON.stringify(fileId)}, error is:\n${JSON.stringify(err)}`;
          response.message = _.isEmpty(response.message) ? failureMessage :  `${response.message}\n${failureMessage}`;
        }
      }
      response.success = !hasFailure;
      return response;
    }

    public updateDatastream(oid: string, record, newMetadata, fileRoot, fileIdsAdded): any {
      // loop thru the attachment fields and determine if we need to add or remove
      return FormsService.getFormByName(record.metaMetadata.form, true)
      .flatMap(form => {
        const reqs = [];
        record.metaMetadata.attachmentFields = form.attachmentFields;
        _.each(form.attachmentFields, async (attField) => {
          const oldAttachments = record.metadata[attField];
          const newAttachments = newMetadata[attField];
          const removeIds = [];
          // process removals
          if (!_.isUndefined(oldAttachments) && !_.isNull(oldAttachments) && !_.isNull(newAttachments)) {
            const toRemove = _.differenceBy(oldAttachments, newAttachments, 'fileId');
            _.each(toRemove, (removeAtt) => {
              if (removeAtt.type == 'attachment') {
                removeIds.push(new Datastream(removeAtt));
              }
            });
          }
          // process additions
          if (!_.isUndefined(newAttachments) && !_.isNull(newAttachments)) {
            const toAdd = _.differenceBy(newAttachments, oldAttachments, 'fileId');
            _.each(toAdd, (addAtt) => {
              if (addAtt.type == 'attachment') {
                fileIdsAdded.push(new Datastream(addAtt));
              }
            });
          }
          reqs.push(this.addAndRemoveDatastreams(oid, fileIdsAdded, removeIds));
        });
        if (_.isEmpty(reqs)) {
          reqs.push(Observable.of({"request": "dummy"}));
        }
        return Observable.of(reqs);
      });
    }

    public async removeDatastream(oid, datastream: Datastream) {
      const fileId = datastream.fileId;
      const fileName = `${oid}/${fileId}`;
      const fileRes = await this.getFileWithName(fileName).toArray();
      if (!_.isEmpty(fileRes)) {
        const fileDoc = fileRes[0];
        sails.log.verbose(`${this.logHeader} removeDatastream() -> Deleting:`);
        sails.log.verbose(JSON.stringify(fileDoc));
        this.gridFsBucket.delete(fileDoc['_id'], (err, res)=> {
          if (err) {
            sails.log.error(`Error deleting: ${fileDoc['_id']}`);
            sails.log.error(JSON.stringify(err));
          }
        });
        sails.log.verbose(`${this.logHeader} removeDatastream() -> Delete successful.`);
      } else {
        sails.log.verbose(`${this.logHeader} removeDatastream() -> File not found: ${fileName}`);
      }
    }

    public async addDatastream(oid, datastream:Datastream) {
      const fileId = datastream.fileId;
      sails.log.verbose(`${this.logHeader} addDatastream() -> Meta: ${fileId}`);
      sails.log.verbose(JSON.stringify(datastream));
      const metadata = _.merge(datastream.metadata, {redboxOid: oid});
      const fpath = `${sails.config.record.attachments.stageDir}/${fileId}`;
      const fileName = `${oid}/${fileId}`;
      sails.log.verbose(`${this.logHeader} addDatastream() -> Adding: ${fileName}`);
      await pipeline(
        fs.createReadStream(fpath),
        this.gridFsBucket.openUploadStream(fileName, {metadata: metadata})
      );
      sails.log.verbose(`${this.logHeader} addDatastream() -> Successfully added: ${fileName}`);
    }

    public async addAndRemoveDatastreams(oid, addIds: any[], removeIds: any[]) {
      for (const addId of addIds) {
        await this.addDatastream(oid, addId);
      }
      for (const removeId of removeIds) {
        await this.removeDatastream(oid, removeId);
      }
    }

    public getDatastream(oid, fileId): any {
      return Observable.fromPromise(this.getDatastreamAsync(oid,fileId));
    }

    private async getDatastreamAsync(oid, fileId): Promise<any> {
      const fileName = `${oid}/${fileId}`;
      const fileRes = await this.getFileWithName(fileName).toArray();
      if (_.isArray(fileRes) && fileRes.length === 0) {
        throw new Error (TranslationService.t('attachment-not-found'))
      }
      const response = new Attachment();
      response.readstream = this.gridFsBucket.openDownloadStreamByName(fileName)
      return response;
    }

    public async listDatastreams(oid, fileId) {
      let query:any = {"metadata.redboxOid": oid};
      if (!_.isEmpty(fileId)) {
        const fileName = `${oid}/${fileId}`;
        query = {filename: fileName};
      }
      sails.log.verbose(`${this.logHeader} listDatastreams() -> Listing attachments of oid: ${oid}`);
      sails.log.verbose(JSON.stringify(query));
      return this.gridFsBucket.find(query, {}).toArray();
    }

    public async createRecordAudit(recordAudit:RecordAuditModel): Promise<any> {
      let response = new StorageServiceResponse();
      try {
        sails.log.verbose(`${this.logHeader} Saving to DB...`);
         await RecordAudit.create(recordAudit);
         //TODO: fix type model to have the _id attribute
         let savedRecordAudit:any = recordAudit;
        response.oid = savedRecordAudit._id;
        response.success = true;
        sails.log.verbose(`${this.logHeader} Record Audit created...`);
      } catch (err) {
        sails.log.error(`${this.logHeader} Failed to create Record Audit:`);
        sails.log.error(JSON.stringify(err));
        response.success = false;
        response.message = err.message;
        return response;
      }
      sails.log.verbose(JSON.stringify(response));
      sails.log.verbose(`${this.logHeader} create() -> End`);
      return response;
    }

    public async getRecordAudit(params: RecordAuditParams): Promise<any> {

            const oid = params['oid'];
            const dateFrom = params['dateFrom'];
            const dateTo = params['dateTo'];

            if (_.isEmpty(oid)) {
              const msg = `${this.logHeader} getMeta() -> refusing to search using an empty OID`;
              sails.log.error(msg);
              throw new Error(msg);
            }

            var criteria = { "redboxOid": oid };

            if(_.isDate(dateFrom)) {
                criteria['createdAt'] = {['>='] : dateFrom };
            }

            if(_.isDate(dateTo)) {
                if(_.isUndefined(criteria['createdAt'])) {
                    criteria['createdAt'] = {};
                }
                criteria['createdAt']['<='] = dateTo;
                sails.log.verbose(criteria);
            }

          sails.log.verbose(`${this.logHeader} finding: `);
          sails.log.verbose(JSON.stringify(criteria));
          return RecordAudit.find(criteria);
  }

    /**
     * Returns a MongoDB cursor
     * @author <a target='_' href='https://github.com/shilob'>Shilo Banihit</a>
     * @param  fileName
     * @param  options
     * @return
     */
    protected getFileWithName(fileName:string, options: any = {limit: 1}) {
      return this.gridFsBucket.find({filename: fileName}, options);
    }


  }

}
module.exports = new Services.MongoStorageService().exports();
