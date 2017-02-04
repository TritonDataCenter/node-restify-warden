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
 * Turn a value into an array, unless it is one already.
 */
function arrayify(obj) {
    if (typeof (obj) === 'object') {
        return obj;
    }

    if (obj === '') {
        return [];
    }

    return obj.split(',');
}


/*
 * Returns true if the hash is empty
 */
function hashEmpty(hash) {
    /* jsl:ignore (for unused variable warning) */
    for (var _k in hash) {
        return false;
    }
    /* jsl:end */

    return true;
}


module.exports = {
    arrayify: arrayify,
    hashEmpty: hashEmpty
};
