#!/usr/bin/env bash

set -euo pipefail
set -o xtrace

BASE_PATH=/opt/redbox-portal/node_modules/@researchdatabox/sails-hook-redbox-storage-mongo

cd "${BASE_PATH}"
npm install --ignore-scripts

cd /opt/redbox-portal
# This is breaking CI but we also shouldn't need to run the install again on a built base image so commenting it out
# npm install --ignore-scripts

exec node \
  /opt/redbox-portal/node_modules/.bin/mocha \
  --exit --no-package \
  --config ${BASE_PATH}/test/unit/.mocharc.js \
  ${BASE_PATH}/test/unit/bootstrap.js \
  ${BASE_PATH}/test/unit/**/*.test.js
