/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

module.exports = {
    'name': 'SampleConsortium',
    'type': 'fabric',
    'version': '1.4',
    'db': 'leveldb',
    'mode': 'bare',
    'consensus': 'solo',
    'kafka': [],
    'zookeeper': [],
    'ordererOrg': {
        'name': 'orderer-org',
        'ca': {
            'name': 'ca-1',
            'ip': '47.112.20.32',
            'ssh_username': 'root',
            'ssh_password': ''
        },
        'orderer': [{
            'name': 'orderer1',
            'ip': '47.112.20.32',
            'ssh_username': 'root',
            'ssh_password': ''
        }]
    },
    'peerOrgs': [{
        'name': 'peer-org1',
        'ca': {
            'name': 'ca-2',
            'ip': '47.112.15.8',
            'ssh_username': 'root',
            'ssh_password': ''
        },
        'peers': [{
            'name': 'peer0',
            'ip': '47.112.15.8',
            'ssh_username': 'root',
            'ssh_password': ''
        }]
    }],
    'channel': {
        'name': 'mychannel',
        'orgs': ['peer-org1']
    }
};
