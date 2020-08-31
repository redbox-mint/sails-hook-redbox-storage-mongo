var Sails = require('sails').Sails;

 describe('Bootstrap tests ::', function() {
     // Var to hold a running sails app instance
     var _sails;
     var appPath = '/opt/redbox-portal'

     // Before running any tests, attempt to lift Sails
     before(function (done) {

         // Hook will timeout in 10 seconds
         this.timeout(11000);

         // Attempt to lift sails
         Sails().lift({
           appPath: appPath,
           models: {
            migrate: 'drop'
           },
           datastores: {
             mongodb: {
               adapter: require(appPath+'/node_modules/sails-mongo'),
               url: "mongodb://mongodb:27017/redbox-portal"
             },
             redboxStorage: {
              adapter: require(appPath+'/node_modules/sails-mongo'),
              url: 'mongodb://mongodb:27017/redbox-storage'
            }
           },
           globals: {
             sails: true,
             _: require('lodash'),
             async: require('async'),
             models: true,
             services: true
           },
           hooks: {
             // Skip grunt (unless your hook uses it)
             "grunt": false
           },
           log: {level: "verbose"}
         },function (err, __sails) {
           if (err) return done(err);
           _sails = __sails;
           return done();
         });
     });

     // After tests are complete, lower Sails
     after(function (done) {

         // Lower Sails (if it successfully lifted)
         if (_sails) {
             return _sails.lower(done);
         }
         // Otherwise just return
         return done();
     });

     // Test that Sails can lift with the hook in place
     it ('sails does not crash', function() {
         return true;
     });

 });
