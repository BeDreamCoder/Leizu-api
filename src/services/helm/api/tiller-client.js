/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const Provider = require('./provider');
var host = require('../../../env').tillerHost;

const TillerClient = class extends Provider {
    constructor() {
        super(process.env.TILLER_URI || host.url);
    }

    async installReleases(releaseName, chartName, namespace) {
        let body = {
            releaseName: releaseName,
            chartName: chartName,
            namespace: namespace,
            verify: false,
        };
        try {
            let response = await this.post('/v1/releases', body);
            return response;
        } catch (err) {
            throw err;
        }
    }

    async listReleases() {
        try {
            let response = await this.get('/v1/releases');
            return response;
        } catch (err) {
            throw err;
        }
    }

    async getReleases(releaseName) {
        try {
            let response = await this.get(`/v1/releases/${releaseName}`);
            return response;
        } catch (err) {
            throw err;
        }
    }

    async deleteReleases(releaseName) {
        try {
            let response = await this.delete(`/v1/releases/${releaseName}`);
            return response;
        } catch (err) {
            throw err;
        }
    }

    async addRepo(name, url) {
        let body = {
            name: name,
            url: url,
        };
        try {
            let response = await this.post('/v1/repos', body);
            return response;
        } catch (err) {
            throw err;
        }
    }

    async removeRepo(repoName) {
        try {
            let response = await this.delete(`/v1/repos/${repoName}`);
            return response;
        } catch (err) {
            throw err;
        }
    }

    async listRepos() {
        try {
            let response = await this.get('/v1/repos');
            return response;
        } catch (err) {
            throw err;
        }
    }
};

module.exports = TillerClient;
