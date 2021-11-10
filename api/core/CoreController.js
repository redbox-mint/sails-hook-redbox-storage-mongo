"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Controllers = void 0;
const pathExists = require("path-exists");
const APIErrorResponse_1 = require("./model/APIErrorResponse");
var Controllers;
(function (Controllers) {
    var Core;
    (function (Core) {
        class Controller {
            constructor() {
                this._config = {};
                this._exportedMethods = [];
                this._theme = 'default';
                this._layout = 'default';
                this._layoutRelativePath = '../_layouts/';
                this._defaultExportedMethods = [
                    '_config',
                ];
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
            _handleRequest(req, res, callback, options = {}) {
                callback(req, res, options);
            }
            index(req, res, callback, options = {}) {
                res.notFound();
            }
            _getResolvedView(branding, portal, view) {
                var resolvedView = null;
                var viewToTest = sails.config.appPath + "/views/" + branding + "/" + portal + "/" + view + ".ejs";
                if (pathExists.sync(viewToTest)) {
                    resolvedView = branding + "/" + portal + "/" + view;
                }
                if (resolvedView == null) {
                    viewToTest = sails.config.appPath + "/views/default/" + portal + "/" + view + ".ejs";
                    if (pathExists.sync(viewToTest)) {
                        resolvedView = "default/" + portal + "/" + view;
                    }
                }
                if (resolvedView == null) {
                    viewToTest = sails.config.appPath + "/views/default/default/" + view + ".ejs";
                    if (pathExists.sync(viewToTest)) {
                        resolvedView = "default/default/" + view;
                    }
                }
                return resolvedView;
            }
            _getResolvedLayout(branding, portal) {
                var resolvedLayout = null;
                var layoutToTest = sails.config.appPath + "/views/" + branding + "/" + portal + "/layout/layout.ejs";
                if (pathExists.sync(layoutToTest)) {
                    resolvedLayout = branding + "/" + portal + "/layout";
                }
                if (resolvedLayout == null) {
                    layoutToTest = sails.config.appPath + "/views/default/" + portal + "/layout.ejs";
                    if (pathExists.sync(layoutToTest)) {
                        resolvedLayout = "/default/" + portal + "/layout";
                    }
                }
                if (resolvedLayout == null) {
                    layoutToTest = sails.config.appPath + "/views/default/default/" + "layout.ejs";
                    if (pathExists.sync(layoutToTest)) {
                        resolvedLayout = "default/default/layout";
                    }
                }
                return resolvedLayout;
            }
            sendView(req, res, view, locals = {}) {
                if (req.options.locals == null) {
                    req.options.locals = {};
                }
                var mergedLocal = Object.assign({}, req.options.locals, locals);
                var branding = mergedLocal['branding'];
                var portal = mergedLocal['portal'];
                var resolvedView = this._getResolvedView(branding, portal, view);
                var resolvedLayout = this._getResolvedLayout(branding, portal);
                if (resolvedLayout != null && mergedLocal["layout"] != false) {
                    res.locals.layout = resolvedLayout;
                }
                if (resolvedView == null) {
                    res.notFound(mergedLocal, "404");
                }
                mergedLocal.view = {};
                mergedLocal.view.pathFromApp = resolvedView;
                mergedLocal.view.ext = 'ejs';
                _.merge(mergedLocal, this.getNg2Apps(view));
                let fullViewPath = sails.config.appPath + "/views/" + resolvedView;
                mergedLocal['templateDirectoryLocation'] = fullViewPath.substring(0, fullViewPath.lastIndexOf('/') + 1);
                sails.log.debug("resolvedView");
                sails.log.debug(resolvedView);
                sails.log.debug("mergedLocal");
                sails.log.debug(mergedLocal);
                res.view(resolvedView, mergedLocal);
            }
            respond(req, res, ajaxCb, normalCb, forceAjax = false) {
                if (this.isAjax(req) || forceAjax == true) {
                    return ajaxCb(req, res);
                }
                else {
                    return normalCb(req, res);
                }
            }
            isAjax(req) {
                return req.headers['x-source'] == 'jsclient';
            }
            ajaxOk(req, res, msg = '', data = null, forceAjax = false) {
                if (!data) {
                    data = { status: true, message: msg };
                }
                this.ajaxRespond(req, res, data, forceAjax);
            }
            ajaxFail(req, res, msg = '', data = null, forceAjax = false) {
                if (!data) {
                    data = { status: false, message: msg };
                }
                this.ajaxRespond(req, res, data, forceAjax);
            }
            apiFail(req, res, statusCode = 500, errorResponse = new APIErrorResponse_1.APIErrorResponse()) {
                res.set('Cache-control', 'no-cache');
                res.set('Pragma', 'no-cache');
                res.set('Expires', 0);
                res.status(statusCode);
                return res.json(errorResponse);
            }
            apiRespond(req, res, jsonObj = null, statusCode = 200) {
                var ajaxMsg = "Got ajax request, don't know what do...";
                this.respond(req, res, (req, res) => {
                    sails.log.verbose(ajaxMsg);
                    res.notFound(ajaxMsg);
                }, (req, res) => {
                    res.set('Cache-control', 'no-cache');
                    res.set('Pragma', 'no-cache');
                    res.set('Expires', 0);
                    res.status(statusCode);
                    return res.json(jsonObj);
                });
            }
            ajaxRespond(req, res, jsonObj = null, forceAjax) {
                var notAjaxMsg = "Got non-ajax request, don't know what do...";
                this.respond(req, res, (req, res) => {
                    res.set('Cache-control', 'no-cache');
                    res.set('Pragma', 'no-cache');
                    res.set('Expires', 0);
                    return res.json(jsonObj);
                }, (req, res) => {
                    sails.log.verbose(notAjaxMsg);
                    res.notFound(notAjaxMsg);
                }, forceAjax);
            }
            getNg2Apps(viewPath) {
                if (sails.config.ng2.use_bundled && sails.config.ng2.apps[viewPath]) {
                    return { ng2_apps: sails.config.ng2.apps[viewPath] };
                }
                else {
                    return { ng2_apps: [] };
                }
            }
        }
        Core.Controller = Controller;
    })(Core = Controllers.Core || (Controllers.Core = {}));
})(Controllers = exports.Controllers || (exports.Controllers = {}));
