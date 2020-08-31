#! /bin/sh
HOOK_VERSION=1.0.0
cd /tmp
npm pack /opt/sails-hook-redbox-storage-mongo
cd /opt/redbox-portal
npm i /tmp/researchdatabox-sails-hook-redbox-storage-mongo-$HOOK_VERSION.tgz
ls -l /opt/redbox-portal/node_modules/@researchdatabox
# ln -s /opt/redbox-portal/api/core /opt/redbox-portal/node_modules/@researchdatabox/sails-hook-redbox-pdfgen/api/core
cd /opt/redbox-portal/node_modules/@researchdatabox/sails-hook-redbox-storage-mongo
npm i mocha -g
npm run test
if [ $? -eq 0 ]
then
  echo "Mocha Tests passed"
else
  echo "Mocha Tests failed"
  exit 1
fi
