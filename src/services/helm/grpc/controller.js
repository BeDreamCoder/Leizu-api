/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const HelmClient = require('./client');

var HelmController = class {
    constructor(url, opts) {
        this._client = new HelmClient(url, opts);
    }

    async listReleases(params) {
        // const {limit, offset, sortBy, filter, sortOrder, status, namespace} = params;
        let request = {
            limit: 100,
            offset: '',
            sort_by: 1,
            filter: '',
            sort_order: 0,
            status_codes: '',
            namespace: ''
        };
        try {
            let response = await this._client.listReleases(request);
            let releaseLsit = [];
            if (response && response.releases) {
                releaseLsit = response.releases.map(release => {
                    return {
                        name: release.name,
                        version: release.version,
                        firstDeployed: release.info.first_deployed,
                        lastDeployed: release.info.last_deployed,
                        status: release.info.status.code,
                        chart: `${release.chart.metadata.name}-${release.chart.metadata.version}`,
                        appVersion: release.chart.metadata.appVersion,
                        namespace: release.namespace
                    };
                });
            }
            return releaseLsit;
        } catch (err) {
            throw err;
        }
    }

    async getVersion() {
        return this._client.getVersion({});
    }
};

module.exports = HelmController;
