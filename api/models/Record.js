/**
 * Record.js
 *
 * @description :: The Record Model for ReDBox
 * @docs        :: http://sailsjs.org/documentation/concepts/models-and-orm/models
 */

module.exports = {
  attributes: {
    redboxOid: {
      type: 'string',
      unique: true
    },
    harvestId: {
      type: 'string'
    },
    metaMetadata: {
      type: 'json'
    },
    metadata: {
      type: 'json'
    },
    workflow: {
      type: 'json'
    },
    authorization: {
      type: 'json'
    },
    createdAt: false,
    updatedAt: false,
    dateCreated: {
      type: 'ref',
      columnType: 'Date',
      autoCreatedAt: true
    },
    lastSaveDate: {
      type: 'ref',
      columnType: 'Date',
      autoUpdatedAt: true
    }
  },
  datastore: 'redboxStorage'
};
