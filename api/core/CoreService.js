"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Services = void 0;
const Rx_1 = require("rxjs/Rx");
var _ = require('lodash');
var Services;
(function (Services) {
    var Core;
    (function (Core) {
        class Service {
            constructor() {
                this._exportedMethods = [];
                this._defaultExportedMethods = [
                    '_config',
                ];
            }
            getObservable(q, method = 'exec', type = 'node') {
                if (type == 'node')
                    return Rx_1.Observable.bindNodeCallback(q[method].bind(q))();
                else
                    return Rx_1.Observable.bindCallback(q[method].bind(q))();
            }
            exec(q, successFn, errorFn) {
                this.getObservable(q).subscribe(successFn, errorFn);
            }
            exports() {
                var methods = this._defaultExportedMethods.concat(this._exportedMethods);
                var exportedMethods = {};
                for (var i = 0; i < methods.length; i++) {
                    if (typeof this[methods[i]] !== 'undefined') {
                        if (methods[i][0] !== '_' || methods[i] === '_config') {
                            if (_.isFunction(this[methods[i]])) {
                                exportedMethods[methods[i]] = this[methods[i]].bind(this);
                            }
                            else {
                                exportedMethods[methods[i]] = this[methods[i]];
                            }
                        }
                        else {
                            console.error('The method "' + methods[i] + '" is not public and cannot be exported. ' + this);
                        }
                    }
                    else {
                        console.error('The method "' + methods[i] + '" does not exist on the controller ' + this);
                    }
                }
                return exportedMethods;
            }
            metTriggerCondition(oid, record, options) {
                const triggerCondition = _.get(options, "triggerCondition", "");
                const forceRun = _.get(options, "forceRun", false);
                const variables = {
                    imports: {
                        record: record,
                        oid: oid
                    }
                };
                if (!_.isUndefined(triggerCondition) && !_.isEmpty(triggerCondition)) {
                    const compiled = _.template(triggerCondition, variables);
                    return compiled();
                }
                else if (forceRun) {
                    return "true";
                }
                else {
                    return "false";
                }
            }
            sleep(ms) {
                return new Promise(resolve => {
                    setTimeout(resolve, ms);
                });
            }
        }
        Core.Service = Service;
    })(Core = Services.Core || (Services.Core = {}));
})(Services = exports.Services || (exports.Services = {}));
