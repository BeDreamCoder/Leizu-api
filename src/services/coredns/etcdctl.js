/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';
const axios = require('axios');
const logger = require('../../libraries/log4js');
const etcdCluster = require('../../env').etcdCluster;

class EtcdCtl {

    constructor(endpoint) {
        if (endpoint === undefined) {
            endpoint = 'http://localhost:2379';
        }
        logger.debug('Etcd server address: %s', endpoint);

        this.client = axios.create({
            baseURL: endpoint + '/v3beta',
            timeout: 3000,
        });
    }

    async createZone(domain, host) {
        const parts = domain.split('.');
        let key = '/skydns';
        for (let i = parts.length - 1; i >= 0; --i) {
            key += '/' + parts[i];
        }
        return this.client.post('/kv/put', {
            key: Buffer.from(key).toString('base64'),
            value: Buffer.from(JSON.stringify({host})).toString('base64')
        }).then(response => {
            if (response.status === 200) {
                return Promise.resolve(response.data);
            } else {
                return Promise.reject(response);
            }
        }).catch(error => {
            return Promise.reject(error);
        });
    }

};

module.exports = new EtcdCtl(process.env.ETCD_CLUSTER_URI || etcdCluster.url);