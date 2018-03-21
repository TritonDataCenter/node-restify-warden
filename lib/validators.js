/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http:mozilla.org/MPL/2.0/.
 */

/*
 * Copyright 2017 Joyent, Inc.
 */

'use strict';

/*
 * Some stock validators that consumers of this module may want to use. For
 * example UUIDs, standard subnets, standard IPs, etc. But they are just as
 * welcome to write their own (for example NAPI will want to use its own subnet
 * validator to support its own legacy subnet formats). The validators here
 * come in 2 variants. The first is a return-based variant that returns a
 * boolean that indicates if the input has been validated. The second is a
 * callback-based variant that uses the callback error object to indicate
 * validation failure. This second variant is usually implemented in terms of
 * the first variant.
 *
 * This allows users to use the first variant in code that has to validate some
 * string, but for some reason can't do it through the validation engine (for
 * example we may want to validate some string we fetched from Moray, but isn't
 * passed to us an HTTP param).
 */

var errors = require('./errors');
var util_common = require('./common');
var constants = require('./constants');
var assert = require('assert-plus');
var fmt = require('util').format;
var net = require('net');
var ipaddr = require('ip6addr');

/*
 * Globals
 * =======
 */

var UUID_RE = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
var STR_RE = /\s/g;

/*
 * Validates an array of (one or more) IP addresses
 */
function validateIParray(_, name, arr, callback) {
    var errs = [];
    var ips = [];

    if (!Array.isArray(arr) && typeof (arr) !== 'string') {
        callback(new errors.invalidParam(name, constants.msg.STR));
        return;
    }

    var ip_array = util_common.arrayify(arr);
    if (ip_array.length === 0) {
        errs.push('Empty string');
    } else {
        /*
         * UFDS will return a scalar if there's only one IP. Also allow
         * comma-separated IPs from the commandline tools
         */
        ip_array.forEach(function (i) {
            var ip = i.replace(/\s+/, '');
            var ipAddr = net.isIP(ip);

            if (!ipAddr) {
                errs.push(ip);
            } else {
                ips.push(ipAddr);
            }
        });
    }

    if (errs.length !== 0) {
        var ipErr = errors.invalidParam(name,
            fmt('invalid IP%s', errs.length === 1 ? '' : 's'));
        ipErr.invalid = errs.sort();
        callback(ipErr);
        return;
    }

    callback(null, ips);
}


function _validateIP(addr) {
    if (net.isIP(addr) !== 0) {
        return false;
    }

    return true;
}

/*
 * Validates only 1 IP address.
 */
function validateIP(_, name, addr, callback) {
    var invalid = _validateIP(addr);
    if (invalid) {
        callback(errors.invalidParam(name, 'invalid IP address'));
        return;
    }
    callback(null, addr);
}


function _validateSubnet(subnetTxt) {
    var params = {};

    if (typeof (subnetTxt) !== 'string') {
        return true;
    }

    var subnet = subnetTxt.split('/');

    function validIPv4SubnetBits(obj) {
        return obj.subnet_start.kind() === 'ipv4' &&
          obj.subnet_bits >= constants.SUBNET_MIN_IPV4 &&
          obj.subnet_bits <= 32;
    }

    function validIPv6SubnetBits(obj) {
        return obj.subnet_start.kind() === 'ipv6' &&
          obj.subnet_bits >= constants.SUBNET_MIN_IPV6 &&
          obj.subnet_bits <= 128;
    }

    if (subnet.length !== 2) {
        return true;
    }

    function toIPAddr(addr) {
        if (/^[0-9]+$/.test(addr)) {
            addr = Number(addr);
        }

        try {
            return ipaddr.parse(addr);
        } catch (_) {
            return null;
        }
    }

    var ip = toIPAddr(subnet[0]);
    if (!ip) {
        return true;
    }

    params.subnet_start = ip;
    params.subnet_bits = Number(subnet[1]);

    if (isNaN(params.subnet_bits) ||
        (!validIPv4SubnetBits(params) && !validIPv6SubnetBits(params))) {
        return true;
    }

    var cidr = ipaddr.createCIDR(ip, params.subnet_bits);

    if (cidr.address().compare(ip) !== 0) {
        return true;
    }

    return false;
}

function validateSubnetArray(_, name, arr, callback) {
    var errs = [];
    var sns = [];

    if (!Array.isArray(arr) && typeof (arr) !== 'string') {
        callback(new errors.invalidParam(name, constants.msg.STR));
        return;
    }

    var sn_array = util_common.arrayify(arr);
    if (sn_array.length === 0) {
        errs.push('Empty string');
    } else {
        /*
         * UFDS will return a scalar if there's only one IP. Also allow
         * comma-separated IPs from the commandline tools
         */
        sn_array.forEach(function (i) {
            var sn = i.replace(/\s+/, '');
            var inval = _validateSubnet(sn);

            if (inval) {
                errs.push(sn);
            } else {
                sns.push(sn);
            }
        });
    }

    if (errs.length !== 0) {
        var snErr = errors.invalidParam(name, constants.msg.CIDR_SUBNET);
        snErr.invalid = errs.sort();
        callback(snErr);
        return;
    }

    callback(null, sns);
}

function validateSubnet(_, name, subnet, callback) {
    var invalid = _validateSubnet(subnet);
    if (invalid) {
        callback(errors.invalidParam(name, constants.msg.CIDR_SUBNET));
        return;
    }
    callback(null, subnet);
}



function _validateUUID(uuid) {
    if (!UUID_RE.test(uuid)) {
        return true;
    }
    return false;
}

/*
 * Validates a UUID
 */
function validateUUID(_, name, uuid, callback) {
    var invalid = _validateUUID(uuid);

    if (invalid) {
        callback(new errors.invalidParam(name,
                constants.msg.INVALID_UUID));
        return;
    }
    callback(null, uuid);
}

function isValidUUID(uuid) {
    if (typeof (uuid) !== 'string' || !UUID_RE.test(uuid)) {
        return false;
    }
    return true;
}


/*
 * Validates an array of UUIDs
 */
function validateUUIDarray(_, name, val, callback) {
    var invalid = {};
    var valid = {};

    if (!Array.isArray(val) && typeof (val) !== 'string') {
        callback(new errors.invalidParam(name, constants.msg.ARRAY_OF_STR));
        return;
    }

    /* Dedup the list and find invalid UUIDs */
    var arr = util_common.arrayify(val);
    arr.forEach(function (uuid) {
        if (UUID_RE.test(uuid)) {
            valid[uuid] = 1;
        } else {
            invalid[uuid] = 1;
        }
    });

    if (!util_common.hashEmpty(invalid)) {
        var err = new errors.invalidParam(name, 'invalid UUID');
        err.invalid = Object.keys(invalid).sort();
        callback(err);
        return;
    }

    callback(null, Object.keys(valid).sort());
}

/*
 * Verifies that the query string either contains only 1 `*` character at the
 * end of the string, or none at all.
 *
 * The goal here is to validate requests that try match UUIDs by prefix, like:
 * deadbeef*. However, we also wish to disallow matching UUIDs by suffix, infix,
 * or circumfix. This is meant to be used in places like sdc-napi, which allows
 * the user to request networks by uuid-prefix.
 */
function validateUUIDPrefix(_, name, str, callback) {
    if (typeof (str) !== 'string') {
        callback(new errors.invalidParam(name, constants.msg.STR));
        return;
    }

    if (str.length > constants.MAX_STR_LEN) {
        callback(new errors.invalidParam(name,
            fmt('must not be longer than %d characters',
                constants.MAX_STR_LEN)));
        return;
    }

    if (str.replace(STR_RE, '') === '') {
        callback(new errors.invalidParam(name, 'must not be empty'));
        return;
    }

    /* JSSTYLED */
    var nstars = (str.match(/\*/g) || []).length;
    if (nstars > 1) {
        callback(new errors.invalidParam(name, constants.msg.UUID_WILDCARD));
        return;
    }

    if (nstars > 0 && str.slice(-1) !== '*') {
        callback(new errors.invalidParam(name, constants.msg.UUID_PREF));
        return;
    }

    if (nstars > 0 && !str.match(/^[0-9a-f*-]+$/)) {

        callback(new errors.invalidParam(name, constants.msg.UUID_PREF_CHAR));
        return;
    }

    if (nstars === 0 && !isValidUUID(str)) {
        callback(new errors.invalidParam('Invalid UUID'));
        return;
    }

    callback(null, str);
}


function isNotInteger(val, id) {
    assert.string(val);
    return (val === '' || val.trim() !== val || isNaN(id) ||
        Math.floor(id) !== id);
}

/*
 * Checks for valid limits and offsets which are integers greater than or equal
 * to zero. val usually is a string as it comes in from an HTTP query parameter.
 */
function validateOffset(_, name, val, callback) {
    var id = Number(val);

    if (typeof (val) !== 'number') {
        if (isNotInteger(val, id)) {
            callback(new errors.invalidParam(name,
                constants.msg.OFFSET));
            return;
        }
    }

    if (isNaN(id) || id < constants.MIN_OFFSET) {
        callback(new errors.invalidParam(name, constants.msg.OFFSET));
        return;
    }

    callback(null, id);
}


/*
 * Checks for valid limits which are integers in the range (0, 1000]. val is
 * usually a string as it comes in from an HTTP query parameter.
 */
function validateLimit(_, name, val, callback) {
    var id = Number(val);

    if (typeof (val) !== 'number') {
        if (isNotInteger(val, id)) {
            callback(new errors.invalidParam(name,
                constants.msg.LIMIT));
            return;
        }
    }

    if (isNaN(id) || id < constants.MIN_LIMIT || id > constants.MAX_LIMIT) {
        callback(new errors.invalidParam(name, constants.msg.LIMIT));
        return;
    }

    callback(null, id);
}

/*
 * Validates a string: ensures it's not empty
 */
function validateString(_, name, str, callback) {
    if (typeof (str) !== 'string') {
        callback(new errors.invalidParam(name, constants.msg.STR));
        return;
    }

    if (str.length > constants.MAX_STR_LEN) {
        callback(new errors.invalidParam(name,
            fmt('must not be longer than %d characters',
                constants.MAX_STR_LEN)));
        return;
    }

    if (str.replace(STR_RE, '') === '') {
        callback(new errors.invalidParam(name, constants.msg.STR_EMPTY));
        return;
    }

    callback(null, str);
}

/*
 * Validates something is either a string or an array of strings.
 */
function validateStringOrArray(_, name, val, callback) {
    validateString(null, name, val, function (err, vals) {
        if (err) {
            validateStringArray(null, name, val, callback);
            return;
        } else {
            callback(null, vals);
            return;
        }
    });
}

function validateStringArray(_, name, vals, callback) {
    if (!Array.isArray(vals)) {
        callback(new errors.invalidParam(name,
            constants.msg.ARRAY_OF_STR));
        return;
    }

    if (vals.length === 0) {
        callback(new errors.invalidParam(name,
            constants.msg.ARRAY_EMPTY));
        return;
    }

    for (var i = 0; i < vals.length; i++) {
        var v = vals[i];
        if (typeof (v) !== 'string') {
            callback(new errors.invalidParam(name,
                constants.msg.ARRAY_OF_STR));
            return;
        }
        if (v.replace(STR_RE, '') === '') {
            callback(new errors.invalidParam(name, constants.msg.STR_EMPTY));
            return;
        }
    }

    callback(null, vals);
}

/*
 * Validates a "fields" array - an array of strings specifying which of an
 * object's fields to return in a response.  `fields` is the list of allowed
 * fields that can be in the array.
 */
function validateFieldsArray(fields) {
    assert.arrayOfString(fields, 'fields');
    return function _validateFieldsArray(_, name, arr, callback) {
        if (!Array.isArray(arr)) {
            callback(new errors.invalidParam(name,
                    constants.msg.ARRAY_OF_STR));
            return;
        }

        if (arr.length === 0) {
            callback(new errors.invalidParam(name,
                    constants.msg.ARRAY_EMPTY));
            return;
        }

        if (arr.length > fields.length) {
            callback(new errors.invalidParam(name,
                fmt('can only specify a maximum of %d fields',
                fields.length)));
            return;
        }

        for (var a in arr) {
            if (typeof (arr[a]) !== 'string') {
                callback(new errors.invalidParam(name,
                        constants.msg.ARRAY_OF_STR));
                return;
            }

            if (fields.indexOf(arr[a]) === -1) {
                callback(new errors.invalidParam(name,
                    'unknown field specified'));
                return;
            }
        }

        callback(null, arr);
    };
}

function validateBoolean(_, name, val, callback) {
    if (typeof (val) === 'boolean') {
        callback(null, val);
        return;
    }

    if (val === 'true' || val === 'false') {
        callback(null, val === 'true');
        return;
    }

    callback(new errors.invalidParam(name, 'must be a boolean value'));
}

/*
 * Validates that a value is one of the values present in an array that
 * enumerates all allowed values.
 */
function validateEnum(values) {
    assert.array(values, 'values');
    return function _validateEnum(_, name, value, callback) {
        if (values.indexOf(value) === -1) {
            callback(new errors.invalidParam(name,
                'must be one of: ' + values.map(JSON.stringify).join(', ')));
            return;
        }

        callback(null, value);
    };
}


module.exports = {
    fieldsArray: validateFieldsArray,
    IParray: validateIParray,
    IP: validateIP,
    subnet: validateSubnet,
    subnetArray: validateSubnetArray,
    stringArray: validateStringArray,
    string: validateString,
    stringOrArray: validateStringOrArray,
    uuidPrefix: validateUUIDPrefix,
    UUID: validateUUID,
    isUUID: isValidUUID,
    UUIDarray: validateUUIDarray,
    isNotInteger: isNotInteger,
    offset: validateOffset,
    limit: validateLimit,
    boolean: validateBoolean,
    enum: validateEnum
};
