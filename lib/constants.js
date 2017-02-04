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
 * Shared constants
 */

var MESSAGES = {
    INVALID_PARAMS: 'Invalid parameters',
    ARRAY_OF_STR: 'must be an array of strings',
    ARRAY_EMPTY: 'must not be an empty array',
    STR: 'must be a string',
    INVALID_UUID: 'invalid UUID',
    UNKNOWN_PARAMS: 'Unknown parameters',
    PARAMETERS_ARE_OBJECTS: 'Parameters must be objects',
    CIDR_SUBNET: 'Subnet must be in CIDR form',
    OFFSET: 'invalid value, offset must be an integer greater than or ' +
        'equal to 0',
    LIMIT: 'invalid limit, must be an integer greater than 0 or less than or ' +
        'equal to 1000'
};

module.exports = {
    msg: MESSAGES,
    MAX_LIMIT: 1000,
    MAX_STR_LEN: 64,
    SUBNET_MIN_IPV4: 8,
    SUBNET_MIN_IPV6: 8,
    MIN_LIMIT: 1,
    MIN_OFFSET: 0
};
