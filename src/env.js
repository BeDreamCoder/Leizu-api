/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

module.exports = {
    fabricLogLevel: 'info',
    tlsEnabled: true,
    metricsEnabled: false,
    koaLogger: true,
    runMode: 'standalone', // 'standalone' or 'distributed'
    jwt: {
        secret: '`yGE[RniLYCX6rCni>DKG_(3#si&zvA$WPmgrb2P',
        expiresIn: 36000
    },
    database: {
        url: 'mongodb://127.0.0.1:27017/zigdb',
        debug: false
    },
    ssh: {
        port: 22
    },
    prometheus: {
        host: '127.0.0.1',
        url: 'http://127.0.0.1:9090'
    },
    elasticsearch: {
        host: '127.0.0.1',
        port: 9200
    },
    configtxlator: {
        url: 'http://127.0.0.1:7059',
    },
    etcdCluster: {
        url: 'http://127.0.0.1:2379',
    },
    coredns: '127.0.0.1',
    cryptoConfig: {
        name: 'configtx.yaml',
        path: '/tmp/crypto-config'
    },
    aliCloud: {
        url: 'http://127.0.0.1:8080',
    },
    tillerHost: {
        url: 'http://127.0.0.1:8080',
    }
};
