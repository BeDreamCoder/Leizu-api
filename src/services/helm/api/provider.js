/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const request = require('request');

const Provider = class {
    constructor(url) {
        this._url = url;
    }

    get(router) {
        return new Promise((resolve, reject) => {
            request({
                url: this._url.concat(router),
                method: 'GET'
            }, (err, res, body) => {
                if (!err && res.statusCode === 200) {
                    resolve(JSON.parse(body));
                } else if (err) {
                    reject(err);
                } else {
                    reject(res.body);
                }
            });
        });
    }

    post(router, message) {
        return new Promise((resolve, reject) => {
            request({
                url: this._url.concat(router),
                method: 'POST',
                body: JSON.stringify(message),
                headers: [
                    {
                        name: 'content-type',
                        value: 'application/json'
                    }
                ]
            }, (err, res, body) => {
                if (!err && res.statusCode === 200) {
                    resolve(JSON.parse(body));
                } else if (err) {
                    reject(err);
                } else {
                    reject(res.body);
                }
            });
        });
    }

    delete(router) {
        return new Promise((resolve, reject) => {
            request({
                url: this._url.concat(router),
                method: 'DELETE'
            }, (err, res, body) => {
                if (!err && res.statusCode === 200) {
                    resolve(JSON.parse(body));
                } else if (err) {
                    reject(err);
                } else {
                    reject(res.body);
                }
            });
        });
    }
};

module.exports = Provider;
