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
 * Default error classes and helpers.
 */

var assert = require('assert-plus');
var constants = require('./constants');
var restify = require('restify');
var util = require('util');



/*
 * Globals
 * =======
 */



var MSG = {
    duplicate: 'Already exists',
    internal: 'Internal error',
    missingParam: 'Missing parameter',
    missingParams: 'Missing parameters'
};



/*
 * Error Classes
 * =============
 */



/*
 * Base class for invalid / missing parameters
 */
function InvalidParamsError(message, errors) {
    assert.string(message, 'message');
    assert.arrayOfObject(errors, 'errors');

    restify.RestError.call(this, {
        restCode: 'InvalidParameters',
        statusCode: 422,
        message: message,
        body: {
            code: 'InvalidParameters',
            message: message,
            errors: errors
        }
    });

    this.name = 'InvalidParamsError';
}

util.inherits(InvalidParamsError, restify.RestError);



/*
 * Functions for building elements in a response's errors array
 *
 * Response-Errors Functions
 * =========================
 */



/*
 * Error response for invalid parameters
 */
function invalidParam(field, message) {
    assert.string(field, 'field');

    var param = {
        field: field,
        code: 'InvalidParameter',
        message: message || constants.msg.INVALID_PARAMS
    };

    return param;
}

/*
 * Error response for unknown parameters
 */
function unknownParams(params, message) {
    var msg;

    assert.arrayOfString(params, 'params');
    assert.optionalString(message, 'message');

    msg = message || constants.msg.UNKNOWN_PARAMS;
    msg += ': ' + params.join(', ');

    var param = {
        field: params,
        code: 'UnknownParameters',
        message: msg
    };

    return param;
}


/*
 * Error response for missing parameters
 */
function missingParam(field, message) {
    assert.string(field, 'field');

    return {
        field: field,
        code: 'MissingParameter',
        message: message || MSG.missingParam
    };
}



module.exports = {
    invalidParam: invalidParam,
    InvalidParamsError: InvalidParamsError,
    missingParam: missingParam,
    msg: MSG,
    unknownParams: unknownParams
};
