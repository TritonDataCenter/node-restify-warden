/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright 2017 Joyent, Inc.
 */

'use strict';

var test = require('tape');
var validate = require('../lib/validate');
var util_const = require('../lib/constants');
var util_common = require('../lib/common');
var util_err = require('../lib/errors');
var fmt = require('util').format;
var restify = require('restify');
var verror = require('verror');

function expErr(message, errors, err, t) {
    var cmp = function (err1, err2) {
        if (err1.code < err2.code) {
            return -1;
        }
        if (err1.code > err2.code) {
            return 1;
        }
        return 0;
    };
    var errExp = new util_err.InvalidParamsError(message, errors.sort(cmp));
    if (err.body.errors) {
        err.body.errors = err.body.errors.sort(cmp);
    }
    t.deepEqual(err, errExp);
}

function expErrInternal(err, t) {
    var errExp = new restify.InternalError('Internal error');

    t.deepEqual(err, errExp);
}

function expVErrInternal(err, errs,  t) {
    var errExp = new restify.InternalError('Internal error');
    errExp.we_cause = new verror.MultiError(errs);

    t.deepEqual(err, errExp);
}

/*
 * Most tests will create an `opts` object which will contain parameters,
 * config information, and the validation callbacks for use with params(). Any
 * parameters may each be known-valid, known-invalid, unknown (shorted to KV,
 * KI, U). We also test these combinations when strictness (S) is turned off.
 *
 * We want to test on mixes which are homogenous (all known-invalid, for
 * example), and heterogenous (contain at least 2 of the 3 possibilities).
 *
 * We run the tests against the stock validators in validators.js
 *
 * This is a) necessary, and b) just as good as running on custom validators
 *
 * Some tests involve calling boolean functions instead of params().
 *
 * We also need to verify that turning strict OFF also works.
 */

test('IP-S-KV', function (t) {
    var opts = {
        strict: true,
        required: {
            ip: validate.IP
        }
    };
    var params = { ip: '8.8.8.8' };
    validate.params(opts, null, params, function (err, res) {
        t.ifErr(err, 'Expecting success');
        t.end();
    });
});

test('GEN-S-MULTI', function (t) {
    var opts = {
        strict: true,
        required: {
            foo: function (_opts, _name, foo, cb) {
                return cb(null, null, {foo: foo, bar: 'bar'});
            }
        }
    };
    var params = { foo: 'foo' };
    validate.params(opts, null, params, function (err, res) {
        t.ifErr(err, 'Expecting success');
        var expRes = {foo: 'foo', bar: 'bar'};
        t.deepEqual(res, expRes, 'Expect res and expRes to be eq');
        t.end();
    });
});

test('Fields-S-KV', function (t) {
    var opts = {
        strict: true,
        required: { name: validate.UUID },
        optional: {
            fields: validate.fieldsArray([ 'name' ])
        }
    };

    var params = { name: 'e9e39136-bb4e-11e6-b107-ef7f99024cc4',
        fields: [ 'name' ] };

    validate.params(opts, null, params, function (err, res) {
        t.ifErr(err, 'Expecting success');
        t.end();
    });
});

test('Params-S-Undef', function (t) {
    var opts = {
        strict: true,
        required: { name: validate.UUID },
        optional: {
            fields: validate.fieldsArray([ 'name' ])
        }
    };

    var params = null;

    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var errors = [ util_err.invalidParam('parameters',
            util_const.msg.PARAMETERS_ARE_OBJECTS) ];
        expErr(msg, errors, err, t);
        t.end();
    });
});

test('Params-S-Arr', function (t) {
    var opts = {
        strict: true,
        required: { name: validate.UUID },
        optional: {
            fields: validate.fieldsArray([ 'name' ])
        }
    };

    var params = ['just', 'an', 'array'];

    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var errors = [ util_err.invalidParam('parameters',
            util_const.msg.PARAMETERS_ARE_OBJECTS) ];
        expErr(msg, errors, err, t);
        t.end();
    });
});

test('Params-S-Num', function (t) {
    var opts = {
        strict: true,
        required: { name: validate.UUID },
        optional: {
            fields: validate.fieldsArray([ 'name' ])
        }
    };

    var params = 42;

    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var errors = [ util_err.invalidParam('parameters',
            util_const.msg.PARAMETERS_ARE_OBJECTS) ];
        expErr(msg, errors, err, t);
        t.end();
    });
});

test('Fields-S-KI-arr-excess', function (t) {
    var opts = {
        strict: true,
        required: { name: validate.UUID },
        optional: {
            fields: validate.fieldsArray([ 'name', 'addr' ])
        }
    };

    var params = { name: 'e9e39136-bb4e-11e6-b107-ef7f99024cc4',
        fields: [ 'name', 'addr', 'excess' ] };

    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var submsg = fmt('can only specify a maximum of %d fields',
            2);
        var errors = [ util_err.invalidParam('fields', submsg) ];
        expErr(msg, errors, err, t);
        t.end();
    });
});

test('Fields-S-KI-notarr', function (t) {
    var opts = {
        strict: true,
        required: { name: validate.UUID },
        optional: {
            fields: validate.fieldsArray([ 'name', 'addr' ])
        }
    };

    var params = { name: 'e9e39136-bb4e-11e6-b107-ef7f99024cc4',
        fields: 'thisisnotanarray' };

    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var errors = [ util_err.invalidParam('fields',
            util_const.msg.ARRAY_OF_STR) ];
        expErr(msg, errors, err, t);
        t.end();
    });
});

test('Fields-S-KI-arr-has-no-str', function (t) {
    var opts = {
        strict: true,
        required: { name: validate.UUID },
        optional: {
            fields: validate.fieldsArray([ 'name', 'addr' ])
        }
    };

    var params = { name: 'e9e39136-bb4e-11e6-b107-ef7f99024cc4',
        fields: [ {num: 42}, {num: 42} ] };

    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var errors = [ util_err.invalidParam('fields',
            util_const.msg.ARRAY_OF_STR) ];
        expErr(msg, errors, err, t);
        t.end();
    });
});

test('Fields-S-KI-arr-bad-name', function (t) {
    var opts = {
        strict: true,
        required: { name: validate.UUID },
        optional: {
            fields: validate.fieldsArray([ 'name', 'addr' ])
        }
    };

    var params = { name: 'e9e39136-bb4e-11e6-b107-ef7f99024cc4',
        fields: [ 'unrecognized' ] };

    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var errors = [ util_err.invalidParam('fields',
            'unknown field specified') ];
        expErr(msg, errors, err, t);
        t.end();
    });
});

test('Fields-S-KI-arr-zero', function (t) {
    var opts = {
        strict: true,
        required: { name: validate.UUID },
        optional: {
            fields: validate.fieldsArray([ 'name', 'addr' ])
        }
    };

    var params = { name: 'e9e39136-bb4e-11e6-b107-ef7f99024cc4',
        fields: [ ] };

    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var errors = [ util_err.invalidParam('fields',
            util_const.msg.ARRAY_EMPTY) ];
        expErr(msg, errors, err, t);
        t.end();
    });
});

test('IP-S-KI', function (t) {
    var opts = {
        strict: true,
        required: {
            ip: validate.IP
        }
    };
    var params = { ip: 'Veni, vidi, vici' };

    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var errors = [ util_err.invalidParam('ip',
            'invalid IP address') ];
        expErr(msg, errors, err, t);
        t.end();
    });
});

test('IP-S-U', function (t) {
    var opts = {
        strict: true,
        required: {
            ip: validate.IP
        }
    };
    var params = { hal: '1000' };
    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var errors = [ util_err.unknownParams(['hal']),
            util_err.missingParam('ip') ];
        expErr(msg, errors, err, t);
        t.end();
    });
});

test('IP-S-KI-U', function (t) {
    var opts = {
        strict: true,
        required: {
            ip: validate.IP
        }
    };
    var params = { ip: 'Et tu, Brute?', hal: '1000' };

    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var errors = [ util_err.unknownParams(['hal']),
            util_err.invalidParam('ip', 'invalid IP address') ];
        expErr(msg, errors, err, t);
        t.end();
    });
});

test('IParray-S-KV-array', function (t) {
    var opts = {
        strict: true,
        required: {
            ip: validate.IParray
        }
    };
    var params = { ip: ['8.8.8.8', '4.4.4.4'] };

    validate.params(opts, null, params, function (err, res) {
        t.ifErr(err, 'Expecting success');
        t.end();
    });
});

test('IParray-S-KV-array-after', function (t) {
    var opts = {
        strict: true,
        required: {
            ip: validate.IParray
        },
        after: function some_no_op(_, _raw, _validated, cb) {
                   return cb();
        }
    };
    var params = { ip: ['8.8.8.8', '4.4.4.4'] };

    validate.params(opts, null, params, function (err, res) {
        t.ifErr(err, 'Expecting success');
        t.end();
    });
});

test('IParray-S-KV-string', function (t) {
    var opts = {
        strict: true,
        required: {
            ip: validate.IParray
        }
    };
    var params = { ip: '8.8.8.8,4.4.4.4' };

    validate.params(opts, null, params, function (err, res) {
        t.ifErr(err, 'Expecting success');
        t.end();
    });
});

test('IParray-S-KV-array-after', function (t) {
    var opts = {
        strict: true,
        required: {
            ip: validate.IParray
        },
        after: function some_no_op(_, _raw, _validated, cb) {
                   return cb({my_err_obj: 42});
        }
    };
    var params = { ip: ['8.8.8.8', '4.4.4.4'] };

    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        expErrInternal(err, t);
        t.end();
    });
});

test('IParray-S-KV-array-after2', function (t) {
    var afterErrs = [ {my_err_obj: 42}, {meo: 43} ];
    var opts = {
        strict: true,
        required: {
            ip: validate.IParray
        },
        after: function some_no_op(_, _raw, _validated, cb) {
            return cb(afterErrs);
        }
    };
    var params = { ip: ['8.8.8.8', '4.4.4.4'] };

    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        expVErrInternal(err, afterErrs, t);
        t.end();
    });
});

test('IParray-S-KI-string-empty', function (t) {
    var opts = {
        strict: true,
        required: {
            ip: validate.IParray
        }
    };
    var params = { ip: '' };

    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var error = util_err.invalidParam('ip', 'invalid IP');
        error.invalid = [ 'Empty string' ];
        var errors = [ error ];
        expErr(msg, errors, err, t);
        t.end();
    });
});

test('IParray-S-KI-string-notArr', function (t) {
    var opts = {
        strict: true,
        required: {
            ip: validate.IParray
        }
    };
    var params = { ip: {obj: 'notanarray', foo: 43 } };

    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var errors = [ util_err.invalidParam('ip',
            util_const.msg.STR) ];
        expErr(msg, errors, err, t);
        t.end();
    });
});

test('subnetArray-S-KI-string-notArr', function (t) {
    var opts = {
        strict: true,
        required: {
            subnet: validate.subnetArray
        }
    };
    var params = { subnet: {obj: 'notanarray', foo: 43 } };

    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var errors = [ util_err.invalidParam('subnet',
            util_const.msg.STR) ];
        expErr(msg, errors, err, t);
        t.end();
    });
});

test('IParray-S-U', function (t) {
    var opts = {
        strict: true,
        required: {
            ip: validate.IParray
        }
    };
    var params = { hotdog: ['frank', 'bun', 'dijon'] };
    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var errors = [ util_err.unknownParams([ 'hotdog' ]),
            util_err.missingParam('ip') ];
        expErr(msg, errors, err, t);
        t.end();
    });
});

function set_err_inv(error, invalid, noproc, sort) {
    var inv_list = [];
    var arr;
    if (typeof (invalid) === 'string') {
        arr = util_common.arrayify(invalid);
        if (invalid === '') {
            error.invalid = [ 'Empty string' ];
            return;
        }
    } else {
        arr = invalid;
        if (noproc) {
            error.invalid = arr.sort();
            return;
        }
    }
    arr.forEach(function (i) {
        var ip = i.replace(/\s+/, '');
        inv_list.push(ip);
    });
    if (sort) {
        error.invalid = inv_list.sort();
    } else {
        error.invalid = inv_list;
    }
}

test('IParray-S-KI-U', function (t) {
    var opts = {
        strict: true,
        required: {
            ip: validate.IParray
        }
    };
    var params = { nirvana: ['in bloom', 'smells like teen spirit'],
        ip: ['By the prickling of my thumbs', 'something wicked',
            'this way comes']
    };

    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var error1 = util_err.invalidParam('ip', 'invalid IPs');
        set_err_inv(error1, params.ip);
        var error2 = util_err.unknownParams([ 'nirvana' ]);
        var errors = [ error1, error2 ];
        expErr(msg, errors, err, t);
        t.end();
    });
});

test('subnet-S-KV', function (t) {
    var opts = {
        strict: true,
        required: {
            subnet: validate.subnet
        }
    };
    var params = { subnet: '8.8.8.0/24' };

    validate.params(opts, null, params, function (err, res) {
        t.ifErr(err, 'Expecting success');
        t.end();
    });
});

test('subnet-S-KI-gibberish', function (t) {
    var opts = {
        strict: true,
        required: {
            subnet: validate.subnet
        }
    };
    var params = { subnet: 'I will force spiders and badgers on the enemy!' };

    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var errors = [ util_err.invalidParam('subnet',
            util_const.msg.CIDR_SUBNET) ];
        expErr(msg, errors, err, t);
        t.end();
    });
});

test('subnet-S-KI-badip', function (t) {
    var opts = {
        strict: true,
        required: {
            subnet: validate.subnet
        }
    };
    var params = { subnet: 'notanip/24' };

    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var errors = [ util_err.invalidParam('subnet',
            util_const.msg.CIDR_SUBNET) ];
        expErr(msg, errors, err, t);
        t.end();
    });
});

test('subnet-S-KI-notstr', function (t) {
    var opts = {
        strict: true,
        required: {
            subnet: validate.subnet
        }
    };
    var params = { subnet: 42 };

    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var errors = [ util_err.invalidParam('subnet',
            util_const.msg.CIDR_SUBNET) ];
        expErr(msg, errors, err, t);
        t.end();
    });
});

test('subnet-S-KI-ipv4-badsub', function (t) {
    var opts = {
        strict: true,
        required: {
            subnet: validate.subnet
        }
    };
    var params = { subnet: '8.8.8.8/99' };
    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var errors = [ util_err.invalidParam('subnet',
            util_const.msg.CIDR_SUBNET) ];
        expErr(msg, errors, err, t);
        t.end();
    });
});

test('subnet-S-KI-ipv4-bad-ip-sub-pair', function (t) {
    var opts = {
        strict: true,
        required: {
            subnet: validate.subnet
        }
    };
    var params = { subnet: '8.8.8.8/24' };
    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var errors = [ util_err.invalidParam('subnet',
            util_const.msg.CIDR_SUBNET) ];
        expErr(msg, errors, err, t);
        t.end();
    });
});

test('subnet-S-KI-ipv4-bad/sub', function (t) {
    var opts = {
        strict: true,
        required: {
            subnet: validate.subnet
        }
    };
    var params = { subnet: '8.8.8.8/99/99' };

    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var errors = [ util_err.invalidParam('subnet',
            util_const.msg.CIDR_SUBNET) ];
        expErr(msg, errors, err, t);
        t.end();
    });
});

test('subnet-S-KI-ipv6-badsub', function (t) {
    var opts = {
        strict: true,
        required: {
            subnet: validate.subnet
        }
    };
    var params = { subnet: '2001:0db8:0a0b:12f0::1/999' };

    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var errors = [ util_err.invalidParam('subnet',
            util_const.msg.CIDR_SUBNET) ];
        expErr(msg, errors, err, t);
        t.end();
    });
});

test('subnet-S-KI-ipv6-badsubNaN', function (t) {
    var opts = {
        strict: true,
        required: {
            subnet: validate.subnet
        }
    };
    var params = { subnet: '2001:0db8:0a0b:12f0::1/^^' };

    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var errors = [ util_err.invalidParam('subnet',
            util_const.msg.CIDR_SUBNET) ];
        expErr(msg, errors, err, t);
        t.end();
    });
});

test('subnet-S-U', function (t) {
    var opts = {
        strict: true,
        required: {
            subnet: validate.subnet
        }
    };
    var params = { konrad: 'zuse' };

    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var errors = [ util_err.unknownParams([ 'konrad' ]),
            util_err.missingParam('subnet') ];
        expErr(msg, errors, err, t);
        t.end();
    });
});

test('subnet-S-KI-U', function (t) {
    var opts = {
        strict: true,
        required: {
            subnet: validate.subnet
        }
    };
    var params = { subnet: 'I want you to stuff the ice-chest!',
        lebowski: 'shut the $#@% up donny!' };
    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var errors = [ util_err.unknownParams([ 'lebowski' ]),
            util_err.invalidParam('subnet', util_const.msg.CIDR_SUBNET)
        ];
        expErr(msg, errors, err, t);
        t.end();
    });
});

test('subnetArray-S-KV', function (t) {
    var opts = {
        strict: true,
        required: {
            subnet: validate.subnetArray
        }
    };
    var params = { subnet: '8.8.8.0/24,4.4.4.0/24' };

    validate.params(opts, null, params, function (err, res) {
        t.ifErr(err, 'Expecting success');
        t.end();
    });
});

test('subnetArray-S-KI-gibberish', function (t) {
    var opts = {
        strict: true,
        required: {
            subnet: validate.subnetArray
        }
    };
    var params = { subnet: 'not,a,subnet,tro,lo,lo' };
    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var error1 = util_err.invalidParam('subnet',
            util_const.msg.CIDR_SUBNET);
        set_err_inv(error1, params.subnet, false, true);
        var errors = [ error1 ];
        expErr(msg, errors, err, t);
        t.end();
    });
});

test('subnetArray-S-KI-emptystring', function (t) {
    var opts = {
        strict: true,
        required: {
            subnet: validate.subnetArray
        }
    };
    var params = { subnet: '' };

    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var error1 = util_err.invalidParam('subnet',
            util_const.msg.CIDR_SUBNET);
        set_err_inv(error1, '');
        var errors = [ error1 ];
        expErr(msg, errors, err, t);
        t.end();
    });
});

test('subnetArray-S-KI-notobject', function (t) {
    var opts = {
        strict: true,
        required: {
            subnet: validate.subnet
        }
    };
    var params = { subnet: { notanarray: 'not', val: 42 } };

    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var errors = [ util_err.invalidParam('subnet',
            util_const.msg.CIDR_SUBNET) ];
        expErr(msg, errors, err, t);
        t.end();
    });
});

test('UUID-S-KV', function (t) {
    var opts = {
        strict: true,
        required: {
            uuid: validate.UUID
        }
    };
    var params = { uuid: '895ef360-aadb-11e6-b917-178ac4f402e3' };
    validate.params(opts, null, params, function (err, res) {
        t.ifErr(err, 'Expecting success');
        t.end();
    });
});

test('UUID-S-KI', function (t) {
    var opts = {
        strict: true,
        required: {
            uuid: validate.UUID
        }
    };
    var params = { uuid: 'Yo mama\'s pudgey. Face it.' };
    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var errors = [ util_err.invalidParam('uuid',
            util_const.msg.INVALID_UUID) ];
        expErr(msg, errors, err, t);
        t.end();
    });
});

test('UUID-S-U', function (t) {
    var opts = {
        strict: true,
        required: {
            uuid: validate.UUID
        }
    };
    var params = { kilroy: 'was here' };
    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var errors = [ util_err.unknownParams([ 'kilroy' ]),
            util_err.missingParam('uuid') ];
        expErr(msg, errors, err, t);
        t.end();
    });
});

test('UUID-S-KI-U', function (t) {
    var opts = {
        strict: true,
        required: {
            uuid: validate.UUID
        }
    };
    var params = { uuid: 'they took my spider-jars into prison',
        czr: 'the die is cast' };
    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var errors = [ util_err.invalidParam('uuid',
            util_const.msg.INVALID_UUID),
            util_err.unknownParams([ 'czr' ]) ];
        expErr(msg, errors, err, t);
        t.end();
    });
});

test('UUIDarray-S-KV: accepts and returns array of UUIDs', function (t) {
    var opts = {
        strict: true,
        required: {
            uuid: validate.UUIDarray
        }
    };

    var ids = [
        'ee985c08-aadb-11e6-a317-bb60373c8455',
        '1719a244-ab78-11e6-bd7e-c71f1a793a36'
    ];
    var sortedIDs = ids.slice().sort();
    var params = { uuid: ids };

    validate.params(opts, null, params, function (err, res) {
        t.ifErr(err, 'Expecting success');
        t.deepEqual(res, { uuid: sortedIDs }, 'Returns UUIDs');
        t.end();
    });
});

test('UUIDarray-S-KV: accepts and converts UUID string', function (t) {
    var opts = {
        strict: true,
        required: {
            uuid: validate.UUIDarray
        }
    };

    var id = 'ee985c08-aadb-11e6-a317-bb60373c8455';
    var params = { uuid: id };

    validate.params(opts, null, params, function (err, res) {
        t.ifErr(err, 'Expecting success');
        t.deepEqual(res, { uuid: [ id ] }, 'String converted to array');
        t.end();
    });
});

test('UUIDarray-S-KI: array containing an invalid UUID', function (t) {
    var opts = {
        strict: true,
        required: {
            uuid: validate.UUIDarray
        }
    };
    var params = { uuid: ['Gotta keep my mind free...',
        '1719a244-ab78-11e6-bd7e-c71f1a793a36'] };
    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var error1 = util_err.invalidParam('uuid',
            util_const.msg.INVALID_UUID);
        set_err_inv(error1, [ 'Gotta keep my mind free...'], true);
        var errors = [ error1 ];
        expErr(msg, errors, err, t);
        t.end();
    });
});

test('UUIDarray-S-KI: not an array (object)', function (t) {
    var opts = {
        strict: true,
        required: {
            uuid: validate.UUIDarray
        }
    };

    var params = { uuid: { } };

    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var error1 = util_err.invalidParam('uuid',
            util_const.msg.ARRAY_OF_STR);
        expErr(msg, [ error1 ], err, t);
        t.end();
    });
});

test('UUIDarray-S-KI: not an array (boolean)', function (t) {
    var opts = {
        strict: true,
        required: {
            uuid: validate.UUIDarray
        }
    };

    var params = { uuid: true };

    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var error1 = util_err.invalidParam('uuid',
            util_const.msg.ARRAY_OF_STR);
        expErr(msg, [ error1 ], err, t);
        t.end();
    });
});

test('UUIDarray-S-U', function (t) {
    var opts = {
        strict: true,
        required: {
            uuid: validate.UUIDarray
        }
    };
    var params = { badcafe: [ '1719a244-ab78-11e6-bd7e-c71f1a793a36'] };
    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var error1 = util_err.missingParam('uuid');
        var error2 = util_err.unknownParams([ 'badcafe' ]);
        var errors = [ error1, error2 ];
        expErr(msg, errors, err, t);
        t.end();
    });
});

test('UUIDarray-S-KI-U', function (t) {
    var opts = {
        strict: true,
        required: {
            uuid: validate.UUIDarray
        }
    };
    var params = { quickcheck: [ 'The way tests were meant', 'to be written'],
        uuid: ['I was happy...', '...then your sister...',
        '...threw a seafish at my TV.'] };
    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var error1 = util_err.invalidParam('uuid',
            util_const.msg.INVALID_UUID);
        set_err_inv(error1, params.uuid, true);
        var error2 = util_err.unknownParams([ 'quickcheck' ]);
        var errors = [ error1, error2 ];
        expErr(msg, errors, err, t);
        t.end();
    });
});

test('limit-S-KV', function (t) {
    var opts = {
        strict: true,
        required: {
            limit: validate.limit
        }
    };
    var params = { limit: util_const.MAX_LIMIT };
    validate.params(opts, null, params, function (err, res) {
        t.ifErr(err, 'Expecting success');
        t.end();
    });
});

test('limit-S-KI-toobig', function (t) {
    var opts = {
        strict: true,
        required: {
            limit: validate.limit
        }
    };
    var params = { limit: (util_const.MAX_LIMIT + 1) };
    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var errors = [ util_err.invalidParam('limit',
            util_const.msg.LIMIT) ];
        expErr(msg, errors, err, t);
        t.end();
    });
});

test('limit-S-KI-toosmall', function (t) {
    var opts = {
        strict: true,
        required: {
            limit: validate.limit
        }
    };
    var params = { limit: (util_const.MIN_LIMIT - 1) };
    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var errors = [ util_err.invalidParam('limit',
            util_const.msg.LIMIT) ];
        expErr(msg, errors, err, t);
        t.end();
    });
});

test('limit-S-KI-NaN', function (t) {
    var opts = {
        strict: true,
        required: {
            limit: validate.limit
        }
    };
    var params = {
        limit: 'I bought 2 zebras & tamed a parrot named Mr. Future'
    };

    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var errors = [ util_err.invalidParam('limit',
            util_const.msg.LIMIT) ];
        expErr(msg, errors, err, t);
        t.end();
    });
});

test('limit-S-U', function (t) {
    var opts = {
        strict: true,
        required: {
            limit: validate.limit
        }
    };
    var params = { lesson: 'Production is a harsh teacher' };
    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var error1 = util_err.missingParam('limit');
        var error2 = util_err.unknownParams([ 'lesson' ]);
        var errors = [ error1, error2 ];
        expErr(msg, errors, err, t);
        t.end();
    });
});

test('limit-S-KI-U', function (t) {
    var opts = {
        strict: true,
        required: {
            limit: validate.limit
        }
    };
    var params = { limit: -1, list: [1, 2, 3, 4] };
    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var error1 = util_err.invalidParam('limit', util_const.msg.LIMIT);
        var error2 = util_err.unknownParams([ 'list' ]);
        var errors = [ error1, error2 ];
        expErr(msg, errors, err, t);
        t.end();
    });
});

test('offset-S-KV', function (t) {
    var opts = {
        strict: true,
        required: {
            offset: validate.offset
        }
    };
    var params = { offset: util_const.MIN_OFFSET };
    validate.params(opts, null, params, function (err, res) {
        t.ifErr(err, 'Expecting success');
        t.end();
    });
});

test('offset-S-KI', function (t) {
    var opts = {
        strict: true,
        required: {
            offset: validate.offset
        }
    };
    var params = { offset: util_const.MIN_OFFSET - 1 };
    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var error1 = util_err.invalidParam('offset', util_const.msg.OFFSET);
        var errors = [ error1 ];
        expErr(msg, errors, err, t);
        t.end();
    });
});

test('offset-S-U', function (t) {
    var opts = {
        strict: true,
        required: {
            offset: validate.offset
        }
    };
    var params = { unknown: util_const.MIN_OFFSET };
    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var error1 = util_err.missingParam('offset');
        var error2 = util_err.unknownParams([ 'unknown' ]);
        var errors = [ error1, error2 ];
        expErr(msg, errors, err, t);
        t.end();
    });
});

test('offset-S-KI-U', function (t) {
    var opts = {
        strict: true,
        required: {
            offset: validate.offset
        }
    };
    var params = { offset: 'the proletariat will rise and overthrow the' +
            ' bourgeoisie',
        hi: util_const.MIN_OFFSET };
    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var error1 = util_err.invalidParam('offset', util_const.msg.OFFSET);
        var error2 = util_err.unknownParams([ 'hi' ]);
        var errors = [ error1, error2 ];
        expErr(msg, errors, err, t);
        t.end();
    });
});

test('boolean-S-KV-str', function (t) {
    var opts = {
        strict: true,
        required: {
            bool: validate.boolean
        }
    };
    var params = { bool: 'true' };
    validate.params(opts, null, params, function (err, res) {
        t.ifErr(err, 'Expecting success');
        t.end();
    });
});

test('boolean-S-KV-bool', function (t) {
    var opts = {
        strict: true,
        required: {
            bool: validate.boolean
        }
    };
    var params = { bool: true };
    validate.params(opts, null, params, function (err, res) {
        t.ifErr(err, 'Expecting success');
        t.end();
    });
});

test('boolean-S-KI', function (t) {
    var opts = {
        strict: true,
        required: {
            bool: validate.boolean
        }
    };

    var params = { bool: 'total-nonsense' };

    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var errors = [
            util_err.invalidParam('bool', 'must be a boolean value')
        ];
        expErr(msg, errors, err, t);
        t.end();
    });
});

test('boolean-S-U', function (t) {
    var opts = {
        strict: true,
        required: {
            bool: validate.boolean
        }
    };
    var params = { qwerty: 'total-nonsense' };
    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var errors = [ util_err.unknownParams(['qwerty']),
                       util_err.missingParam('bool') ];
        expErr(msg, errors, err, t);
        t.end();
    });
});

test('isUUID', function (t) {
    var uuid = '4aafe9a6-ab7d-11e6-93bb-c315b954888f';
    var T = validate.isUUID(uuid);
    t.ok(T === true, 'Expected true');
    var F = validate.isUUID('4aafe9a6ab7d11e693bbc315b954888f');
    t.ok(F === false, 'Expected false');
    F = validate.isUUID(0x4aafe9a6ab7d);
    t.ok(F === false, 'Expected false');
    t.end();
});

test('String-S-KV', function (t) {
    var opts = {
        strict: true,
        required: {
            str: validate.string
        }
    };
    var params = { str: 'MyString' };
    validate.params(opts, null, params, function (err, res) {
        t.ifErr(err, 'Expecting success');
        t.deepEqual(params, res);
        t.end();
    });
});

test('String-S-KI-empty', function (t) {
    var opts = {
        strict: true,
        required: {
            str: validate.string
        }
    };
    var params = { str: '' };
    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var errors = [ util_err.invalidParam('str',
            util_const.msg.STR_EMPTY) ];
        expErr(msg, errors, err, t);
        t.end();
    });
});

test('String-S-KI-type', function (t) {
    var opts = {
        strict: true,
        required: {
            str: validate.string
        }
    };
    var params = { str: 42 };
    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var errors = [ util_err.invalidParam('str',
            util_const.msg.STR) ];
        expErr(msg, errors, err, t);
        t.end();
    });
});

test('String-S-U', function (t) {
    var opts = {
        strict: true,
        required: {
            str: validate.string
        }
    };
    var params = { junk: 'MyString' };
    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var errors = [ util_err.unknownParams([ 'junk' ]),
            util_err.missingParam('str') ];
        expErr(msg, errors, err, t);
        t.end();
    });
});

test('String-S-KI-U', function (t) {
    var opts = {
        strict: true,
        required: {
            str: validate.string
        }
    };
    var params = { junk: 'SomeJunk', str: '' };
    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var errors = [ util_err.invalidParam('str',
            util_const.msg.STR_EMPTY),
            util_err.unknownParams([ 'junk' ]) ];
        expErr(msg, errors, err, t);
        t.end();
    });
});

test('StringArray-S-KV', function (t) {
    var opts = {
        strict: true,
        required: {
            strs: validate.stringArray
        }
    };
    var params = { strs: ['String', 'String', 'String'] };
    validate.params(opts, null, params, function (err, res) {
        t.ifErr(err, 'Expecting success');
        t.deepEqual(params, res);
        t.end();
    });
});

test('StringArray-S-KI-one-empty', function (t) {
    var opts = {
        strict: true,
        required: {
            strs: validate.stringArray
        }
    };
    var params = { strs: ['String', 'String', ''] };
    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var errors = [ util_err.invalidParam('strs',
            util_const.msg.STR_EMPTY) ];
        expErr(msg, errors, err, t);
        t.end();
    });
});

test('StringArray-S-KI-not-array', function (t) {
    var opts = {
        strict: true,
        required: {
            strs: validate.stringArray
        }
    };
    var params = { strs: 'String,With,Commas' };
    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var errors = [ util_err.invalidParam('strs',
            util_const.msg.ARRAY_OF_STR) ];
        expErr(msg, errors, err, t);
        t.end();
    });
});

test('StringArray-S-U', function (t) {
    var opts = {
        strict: true,
        required: {
            strs: validate.stringArray
        }
    };
    var params = { trash: ['MyString'] };
    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var errors = [ util_err.unknownParams([ 'trash' ]),
                       util_err.missingParam('strs') ];
        expErr(msg, errors, err, t);
        t.end();
    });
});

test('StringArray-S-KI-U', function (t) {
    var opts = {
        strict: true,
        required: {
            strs: validate.stringArray
        }
    };
    var params = { trash: ['MyString'], strs: [''] };
    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var errors = [ util_err.invalidParam('strs',
            util_const.msg.STR_EMPTY),
            util_err.unknownParams([ 'trash' ]) ];
        expErr(msg, errors, err, t);
        t.end();
    });
});

test('StringOrArray-S-KV', function (t) {
    var opts = {
        strict: true,
        required: {
            strs: validate.stringOrArray
        }
    };
    var params = { strs: ['MyString'] };
    validate.params(opts, null, params, function (err, res) {
        t.ifErr(err, 'Expecting success');
        t.deepEqual(params, res);
        t.end();
    });
});

test('StringOrArray-S-KI', function (t) {
    var opts = {
        strict: true,
        required: {
            strs: validate.stringOrArray
        }
    };
    var params = { strs: [''] };
    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var errors = [ util_err.invalidParam('strs',
            util_const.msg.STR_EMPTY) ];
        expErr(msg, errors, err, t);
        t.end();
    });
});

test('StringOrArray-S-U', function (t) {
    var opts = {
        strict: true,
        required: {
            strs: validate.stringOrArray
        }
    };
    var params = { trash: ['SomeThing'] };
    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var errors = [ util_err.unknownParams([ 'trash' ]),
                       util_err.missingParam('strs') ];
        expErr(msg, errors, err, t);
        t.end();
    });
});

test('StringOrArray-S-KI-U', function (t) {
    var opts = {
        strict: true,
        required: {
            strs: validate.stringOrArray
        }
    };
    var params = { trash: ['SomeThing'], strs: '' };
    validate.params(opts, null, params, function (err, res) {
        t.ok(err, 'Expecting error');
        var msg = util_const.msg.INVALID_PARAMS;
        var errors = [ util_err.invalidParam('strs',
            util_const.msg.ARRAY_OF_STR),
            util_err.unknownParams([ 'trash' ]) ];
        expErr(msg, errors, err, t);
        t.end();
    });
});

test('isNotInteger', function (t) {
    var val = '';
    var id = 'str';
    var T = validate.isNotInteger(val, id);
    t.ok(T === true, 'Expected true');
    val = '1234';
    id = 42;
    var F = validate.isNotInteger(val, id);
    t.ok(F === false, 'Expected false');
    t.end();
});
