/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright 2016 Joyent, Inc.
 */

'use strict';

/*
 * Basic parameter validation engine.
 */

var errors = require('./errors');
var constants = require('./constants');
var validators = require('./validators');
var assert = require('assert-plus');
var fmt = require('util').format;
var restify = require('restify');
var verror = require('verror');
var vasync = require('vasync');

/*
 * Calls callback with the appropriate error depending on the contents of errs
 */
function errResult(errs, validated, callback) {
    var invalid = false;

    if (errs.length !== 0) {
        var realErrs = [];
        var sortedErrs = errs.filter(function (e) {
            if (!e.hasOwnProperty('field')) {
                realErrs.push(e);
                return false;
            }
            if (!invalid && e.hasOwnProperty('code') &&
                e.code !== 'MissingParameter') {
                invalid = true;
            }

            return true;
        }).sort(function (a, b) { return (a.field > b.field) ? 1 : -1; });

        if (realErrs.length !== 0) {
            callback(new restify.InternalError(
                realErrs.length === 1 ? realErrs[0] :
                    new verror.MultiError(realErrs),
                'Internal error'));
            return;
        }

        callback(new errors.InvalidParamsError(
            invalid ? constants.msg.INVALID_PARAMS : 'Missing parameters',
            sortedErrs));
        return;
    }

    callback(null, validated);
}



/*
 * Exports
 * =======
 */


/*
 * Check for any uknown parameters if strict mode is engaged.
 */
function validateUnknowns(params, req, opt) {
    var field;
    var unknowns = [];

    for (field in params) {
        if (!params.hasOwnProperty(field)) {
            continue;
        }
        if ((req && req.hasOwnProperty(field)) ||
           (opt && opt.hasOwnProperty(field))) {
            continue;
        }

        unknowns.push(field);
    }

    if (unknowns.length === 0) {
        return null;
    }

    return new errors.unknownParams(unknowns);
}


/*
 * Validate parameters on an object.
 *
 * @param opts {Object}: Options for validating the input object
 * - `strict` {Boolean}: Fail if there are extra, unknown fields on the object
 * - `required` {Object}: A map of validation functions for each required field
 * - `optional` {Object}: A map of validation functions for each optional field
 * @param arg {Any}: A value to pass as the first argument to each validation
 *     function. Usually an object containing configuration information or a
 *     database handle.
 * @param params {Object}: Object to validate
 * @param callback {Function}: Callback with (err, validated) where validated
 *     is an object with only validated fields or fields added by the
 *     validation functions.
 */

function validateParams(opts, arg, params, callback) {
    var errs = [];
    var field;
    var validatedParams = {};

    assert.object(opts, 'opts');
    assert.optionalBool(opts.strict, 'opts.strict');
    assert.optionalObject(opts.required, 'opts.required');
    assert.optionalObject(opts.optional, 'opts.optional');
    assert.func(callback);

    if (!params || typeof (params) !== 'object' || Array.isArray(params)) {
        errs.push(errors.invalidParam('parameters',
            constants.msg.PARAMETERS_ARE_OBJECTS));
        errResult(errs, validatedParams, callback);
        return;
    }

    var toValidate = [];

    if (opts.required) {
        for (field in opts.required) {
            assert.func(opts.required[field],
                fmt('opts.required[%s]', field));

            if (params.hasOwnProperty(field)) {
                toValidate.push({
                    field: field,
                    fn: opts.required[field],
                    val: params[field]
                });
            } else {
                errs.push(errors.missingParam(field));
            }
        }
    }

    for (field in opts.optional) {
        assert.func(opts.optional[field],
            fmt('opts.optional[%s]', field));

        if (params.hasOwnProperty(field)) {
            toValidate.push({
                field: field,
                fn: opts.optional[field],
                val: params[field]
            });
        }
    }

    vasync.forEachParallel({
        inputs: toValidate,
        func: function _callValidateFn(val, cb) {
            /*
             * TODO: allow specifying an array of validation functions, and
             * bail after the first failure
             */

            val.fn(arg, val.field, val.val, function (e, validated, multi) {
                if (e) {
                    errs.push(e);
                }

                if (typeof (validated) !== 'undefined') {
                    validatedParams[val.field] = validated;
                }
                if (typeof (multi) !== 'undefined' &&
                    typeof (multi) === 'object') {

                    for (var v in multi) {
                        validatedParams[v] = multi[v];
                    }
                }

                return cb();
            });
        }
    }, function after() {
        if (opts.strict) {
            var err = validateUnknowns(params, opts.required,
                opts.optional);
            if (err !== null) {
                errs.push(err);
            }
        }

        if (opts.hasOwnProperty('after') && errs.length === 0) {
            if (!Array.isArray(opts.after)) {
                opts.after = [opts.after];
            }
            return crossValidate(errs, arg, params, validatedParams,
                opts.after, callback);
        }
        return errResult(errs, validatedParams, callback);
    });
}

/*
 * Used by validate.params to call an array of 'after' functions, which have
 * access to all the raw and validated parameters. This is typically used to
 * validate conditions between parameters, e.g., nicTag/network MTUs.
 */
function crossValidate(errs, arg, raw, validated, afterFuncs, callback) {
    vasync.forEachPipeline({
        inputs: afterFuncs,
        func: function _validate(func, cb) {
            func(arg, raw, validated, function (err) {
                if (err) {
                    if (Array.isArray(err)) {
                        errs = errs.concat(err);
                    } else {
                        errs.push(err);
                    }
                }
                return cb();
            });
        }
    }, function (_err, _results) {
        return errResult(errs, validated, callback);
    });
}

module.exports = {
    params: validateParams,
    fieldsArray: validators.fieldsArray,
    IParray: validators.IParray,
    IP: validators.IP,
    subnet: validators.subnet,
    subnetArray: validators.subnetArray,
    UUID: validators.UUID,
    isUUID: validators.isUUID,
    UUIDarray: validators.UUIDarray,
    isNotInteger: validators.isNotInteger,
    offset: validators.offset,
    limit: validators.limit
};
