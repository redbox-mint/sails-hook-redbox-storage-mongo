module.exports = {
  attributes: {
      user: {
          type: 'json'
      },
      record: {
          type: 'json'
      },
      dateCreated: {
          type: 'string',
          autoCreatedAt: true
      }
  },
  datastore: 'redboxStorage'
}