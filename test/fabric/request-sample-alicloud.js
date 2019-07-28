/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

module.exports = {
    'name': 'SampleConsortium',
    'type': 'fabric',
    'version': '1.3',
    'db': 'leveldb',
    'mode': 'cloud', // bare
    'network': 'classics', // vpc
    'normalInstanceLimit': 20,
    'highInstanceLimit': 20,
    'consensus': 'kafka',
    'kafka': [{
        'name': 'kafka1',
        'type': 'normal', // high
        'cloud': 'aliyun'
    }, {
        'name': 'kafka2',
        'type': 'normal',
        'cloud': 'aliyun'
    }, {
        'name': 'kafka3',
        'type': 'normal',
        'cloud': 'aliyun'
    }, {
        'name': 'kafka4',
        'type': 'normal',
        'cloud': 'aliyun'
    }],
    'zookeeper': [{
        'name': 'zookeeper1',
        'type': 'normal',
        'cloud': 'aliyun'
    }, {
        'name': 'zookeeper2',
        'type': 'normal',
        'cloud': 'aliyun'
    }, {
        'name': 'zookeeper3',
        'type': 'normal',
        'cloud': 'aliyun'
    }],
    'ordererOrg': {
        'name': 'orderer-org',
        'ca': {
            'name': 'ca-1',
            'type': 'normal',
            'cloud': 'aliyun'
        },
        'orderer': [{
            'name': 'orderer1',
            'type': 'normal',
            'cloud': 'aliyun'
        }]
    },
    'peerOrgs': [{
        'name': 'peer-org1',
        'ca': {
            'name': 'ca-2',
            'type': 'normal',
            'cloud': 'aliyun'
        },
        'peers': [{
            'name': 'peer1',
            'type': 'normal',
            'cloud': 'aliyun'
        }]
    }],
    'channel': {
        'name': 'mychannel',
        'orgs': ['peer-org1']
    }
};