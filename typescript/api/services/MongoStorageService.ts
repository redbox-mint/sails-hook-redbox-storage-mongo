import services = require('../core/CoreService.js');
import StorageService from '../core/StorageService.js';
import RecordsService from '../core/RecordsService.js';
import {StorageServiceResponse} from '../core/StorageServiceResponse.js';
import { Sails, Model } from "sails";
import { v1 as uuidv1 } from 'uuid';
import moment = require('moment');

declare var sails: Sails;
declare var _;
declare var Record:Model, RecordsService, RecordTypesService;

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
  export class MongoStorageService extends services.Services.Core.Service implements StorageService {
    recordsService: RecordsService = null;
    logHeader: string = 'MongoStorageService::'

    protected _exportedMethods: any = [
      'create',
      'updateMeta',
      'getMeta',
      'createBatch',
      'provideUserAccessAndRemovePendingAccess',
      'getRelatedRecords',
      'delete',
      'updateNotificationLog'
    ];

    constructor() {
      super();
      let that = this;
      sails.on('ready', function() {
        that.recordsService = RecordsService;
        that.init();
      });
    }

    private getUuid():string {
      return uuidv1().replace(/-/g, '');
    }

    private async init() {
      var db = Record.getDatastore().manager;
      // check if the collection exists ...
      try {
        const collectionInfo = await db.collection(Record.tableName, {strict:true});
        sails.log.verbose(`${this.logHeader} Collection '${Record.tableName}' info:`);
        sails.log.verbose(JSON.stringify(collectionInfo));
      } catch (err) {
        sails.log.verbose(`Collection doesn't exist, creating: ${Record.tableName}`);
        const initRec = {redboxOid: this.getUuid()};
        await Record.create(initRec);
        await Record.destroyOne(initRec);
      }
      await this.createIndices(db);
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

    public async create(brand, record, recordType, user?, triggerPreSaveTriggers?: boolean, triggerPostSaveTriggers?: boolean):Promise<any> {
      sails.log.verbose(`${this.logHeader} create() -> Begin`);
      let response = new StorageServiceResponse();
      // Create DB entry
      record.redboxOid = this.getUuid();
      response.oid = record.redboxOid;
      // Pre-Save hooks
      if (triggerPreSaveTriggers) {
        sails.log.verbose(`${this.logHeader} Triggering pre-save hook...`);
        record = await this.recordsService.triggerPreSaveTriggers(null, record, recordType, "onCreate", user);
      }
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
      if (triggerPostSaveTriggers) {
        sails.log.verbose(`${this.logHeader} Triggering post-save...`);
        // Trigger Post-save sync hooks ...
        try {
          response = await this.recordsService.triggerPostSaveSyncTriggers(response['oid'], record, recordType, 'onCreate', user, response);
        } catch (err) {
          sails.log.error(`${this.logHeader} Exception while running post save sync hooks when creating:`);
          sails.log.error(JSON.stringify(err));
          response.success = false;
          response.message = err.message;
          return response;
        }
        // Fire Post-save hooks async ...
        this.recordsService.triggerPostSaveTriggers(response['oid'], record, recordType, 'onCreate', user);
      }
      sails.log.verbose(JSON.stringify(response));
      sails.log.verbose(`${this.logHeader} create() -> End`);
      return response;
    }

    public async updateMeta(brand, oid, record, user?, triggerPreSaveTriggers?: boolean, triggerPostSaveTriggers?: boolean): Promise<any> {
      let response = new StorageServiceResponse();
      response.oid = oid;
      let recordType = null;
      if (!_.isEmpty(brand) && triggerPreSaveTriggers === true) {
        try {
          recordType = await RecordTypesService.get(brand, record.metaMetadata.type);
          record = await this.recordsService.triggerPreSaveTriggers(oid, record, recordType, "onUpdate", user);
        } catch (err) {
          sails.log.error(`${this.logHeader} Failed to run pre-save hooks when updating..`);
          sails.log.error(JSON.stringify(err));
          response.message = err.message;
          return response;
        }
      }
      // unsetting the ID just to be safe
      _.unset(record, 'id');
      _.unset(record, 'redboxOid');
      // updating...
      try {
        await Record.updateOne({redboxOid: oid}).set(record);
        response.success = true;
      } catch (err) {
        sails.log.error(`${this.logHeader} Failed to save update to MongoDB:`);
        sails.log.error(JSON.stringify(err));
        response.success = false;
        response.message = err;
      }
      if (!_.isEmpty(recordType) && triggerPostSaveTriggers === true) {
        // Trigger Post-save sync hooks ...
        try {
          response = await this.recordsService.triggerPostSaveSyncTriggers(response['oid'], record, recordType, 'onCreate', user, response);
        } catch (err) {
          sails.log.error(`${this.logHeader} Exception while running post save sync hooks when creating:`);
          sails.log.error(JSON.stringify(err));
          response.success = false;
          response.message = err.message;
          return response;
        }
        // Fire Post-save hooks async ...
        this.recordsService.triggerPostSaveTriggers(response['oid'], record, recordType, 'onCreate', user);
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
          await this.create(null, dataItem, null, null, false, false);
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

    public async getRelatedRecords(oid, brand, recordTypeName:any = null, mappingContext: any = null): Promise<any> {
      let record = await this.getMeta(oid);
      if (_.isEmpty(recordTypeName)) {
        recordTypeName = record['metaMetadata']['type'];
      }
      let recordType = await RecordTypesService.get(brand, recordTypeName);
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
        _.each(relatedTo, async (relationship) => {
          sails.log.verbose(`${this.logHeader} Processing relationship:`);
          sails.log.verbose(JSON.stringify(relationship));
          relationships.push(relationship);
          const recordType = relationship['recordType'];
          // retrieve the related records from the DB...
          const criteria:any = {};
          criteria['metaMetadata.type'] = relationship['recordType'];
          criteria[relationship['foreignField']] = oid;
          sails.log.verbose(`${this.logHeader} Finding related records criteria:`);
          sails.log.verbose(JSON.stringify(criteria));

          const relatedRecords = await Record.find(criteria);
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
              mappingContext = await this.getRelatedRecords(recordRelationship.redboxOid, brand, relationship['recordType'], mappingContext);
            }
          }
        });

        return mappingContext;
      } else {
        sails.log.verbose(`${this.logHeader} RecordType has no relationships: ${recordTypeName}`);
        return mappingContext;
      }
    }


    public async delete(oid): Promise<any> {
      const response = new StorageServiceResponse();
      try {
        await Record.destroyOne({redboxOid: oid});
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
            const response = await this.updateMeta(null, oid, record, null, false, false);
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


  }

}
module.exports = new Services.MongoStorageService().exports();
