#!/usr/bin/env bash

set -euo pipefail
set -o xtrace

BASE_PATH=/opt/redbox-portal/node_modules/@researchdatabox/sails-hook-redbox-storage-mongo

cd "${BASE_PATH}"
npm install --ignore-scripts

cd /opt/redbox-portal
npm install --ignore-scripts

exec node \
  /opt/redbox-portal/node_modules/.bin/mocha \
  --exit \
  --config ${BASE_PATH}/test/unit/.mocharc.js \
  ${BASE_PATH}/test/unit/bootstrap.js \
  ${BASE_PATH}/test/unit/**/*.test.js
