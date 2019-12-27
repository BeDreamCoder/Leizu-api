/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

module.exports = {
    'name': 'example',
    'type': 'fabric',
    'version': '1.4',
    'db': 'leveldb',
    'mode': 'bare',
    'consensus': 'solo',
    'ordererOrg': {
        'name': 'orderer',
        'ca': {
            'name': 'ca0',
            'ip': '127.0.0.1'
        },
        'orderer': [{
            'name': 'orderer0',
            'ip': '127.0.0.1'
        }]
    },
    'peerOrgs': [{
        'name': 'org1',
        'ca': {
            'name': 'ca1',
            'ip': '127.0.0.1'
        },
        'peers': [{
            'name': 'peer0',
            'ip': '127.0.0.1'
        }]
    }],
    'channel': {
        'name': 'mychannel',
        'orgs': ['org1']
    }
};
