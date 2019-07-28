/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const util = require('util');
const grpc = require('grpc');
const protoLoader = require('@grpc/proto-loader');
const GrpcClient = require('./grpc/client');
const resolve = require('path').resolve;
const logger = require('log4js').getLogger('HelmClient');

const protoPath = resolve(__dirname, 'protos');
const tillerProto = protoPath + '/hapi/services/tiller.proto';

// const tiller = grpc.load({
//     file: '/hapi/services/tiller.proto',
//     root: protoPath
// }).hapi.services.tiller;

// Suggested options for similarity to existing grpc.load behavior
var packageDefinition = protoLoader.loadSync(tillerProto, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
    includeDirs: [protoPath]
});
var protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
// The protoDescriptor object has the full package hierarchy
var tiller = protoDescriptor.hapi.services.tiller;

var metaData = new grpc.Metadata();
metaData.add('x-helm-api-client', 'v2.13.0');

var HelmClient = class extends GrpcClient {
    /**
     * @param {string} url - The URL with format of "grpc(s)://host:port".
     * @param {ConnectionOpts} opts - The options for the connection to the peer.
     * @returns {Chart} The Chart instance.
     */
    constructor(url, opts) {
        super(url, opts);

        logger.debug('Helm - url: %s timeout: %s name:%s', url, this._request_timeout, this.getName());
        this._helmClient = new tiller.ReleaseService(this._endpoint.addr, this._endpoint.creds, this._options);
    }

    /**
     * @param {ListReleasesRequest} request - A protobuf encoded byte array of type
     * @param {Number} timeout - A number indicating milliseconds to wait on the
     *        response before rejecting the promise with a timeout error. This
     *        overrides the default timeout of the Peer instance and the global
     *        timeout in the config settings.
     * @returns {Promise} A Promise for a {@link ProposalResponse}
     */
    listReleases(request, timeout) {
        const method = 'ListReleases';
        logger.debug('%s Start %s %s', method, this.getName(), this.getUrl());
        const self = this;
        let rto = self._request_timeout;
        if (typeof timeout === 'number') {
            rto = timeout;
        }
        if (!request) {
            return Promise.reject(new Error('Invalid request for ' + method));
        }

        return this.waitForReady(this._helmClient).then(() => {
            return new Promise(function (resolve, reject) {
                const sendTimeout = setTimeout(function () {
                    logger.error('%s - timed out after:%s', method, rto);
                    return reject(new Error('REQUEST_TIMEOUT'));
                }, rto);

                // handle server-side stream from the client
                var callback = self._helmClient.listReleases(request, metaData);
                self._streamCallBack(resolve, reject, callback, method, self._url, sendTimeout);
            });
        });
    }

    /**
     * @param {GetVersionRequest} request - A protobuf encoded byte array of type
     * @param {Number} timeout - A number indicating milliseconds to wait on the
     *        response before rejecting the promise with a timeout error. This
     *        overrides the default timeout of the Peer instance and the global
     *        timeout in the config settings.
     * @returns {Promise} A Promise for a {@link ProposalResponse}
     */
    installRelease(request, timeout) {
        const method = 'InstallRelease';
        logger.debug('%s Start %s %s', method, this.getName(), this.getUrl());
        const self = this;
        let rto = self._request_timeout;
        if (typeof timeout === 'number') {
            rto = timeout;
        }
        if (!request) {
            return Promise.reject(new Error('Invalid request for ' + method));
        }

        return this.waitForReady(this._helmClient).then(() => {
            return new Promise(function (resolve, reject) {
                const sendTimeout = setTimeout(function () {
                    logger.error('%s - timed out after:%s', method, rto);
                    return reject(new Error('REQUEST_TIMEOUT'));
                }, rto);

                self._helmClient.installRelease(request, metaData, (err, response) => {
                    self._simpleCallBack(resolve, reject, err, response, method, self._url, sendTimeout);
                });
            });
        });
    }

    /**
     * @param {GetVersionRequest} request - A protobuf encoded byte array of type
     * @param {Number} timeout - A number indicating milliseconds to wait on the
     *        response before rejecting the promise with a timeout error. This
     *        overrides the default timeout of the Peer instance and the global
     *        timeout in the config settings.
     * @returns {Promise} A Promise for a {@link ProposalResponse}
     */
    getVersion(request, timeout) {
        const method = 'GetVersion';
        logger.debug('%s Start %s %s', method, this.getName(), this.getUrl());
        const self = this;
        let rto = self._request_timeout;
        if (typeof timeout === 'number') {
            rto = timeout;
        }
        if (!request) {
            return Promise.reject(new Error('Invalid request for ' + method));
        }

        return this.waitForReady(this._helmClient).then(() => {
            return new Promise((resolve, reject) => {
                const sendTimeout = setTimeout(() => {
                    logger.error('%s - timed out after:%s', method, rto);
                    reject(new Error('REQUEST_TIMEOUT'));
                }, rto);

                self._helmClient.getVersion(request, metaData, (err, response) => {
                    self._simpleCallBack(resolve, reject, err, response, method, self._url, sendTimeout);
                });
            });
        });
    }

    /**
     * handle simple grpc callback
     */
    _simpleCallBack(resolve, reject, err, response, method, url, sendTimeout) {
        clearTimeout(sendTimeout);
        if (err) {
            logger.debug('%s - Received response from: %s, error: %s', method, url, err);
            if (err instanceof Error) {
                reject(err);
            } else {
                reject(new Error(err));
            }
        } else {
            if (response) {
                logger.debug('%s - Received response from url "%s", response: %s', method, url, response);
                resolve(response);
            } else {
                logger.error('GRPC client got a null or undefined response from the server "%s".', url);
                reject(new Error(util.format('GRPC client got a null or undefined response from the server "%s".', url)));
            }
        }
    }

    /**
     * handle server-side stream from the client
     */
    _streamCallBack(resolve, reject, callback, method, url, sendTimeout) {
        callback.on('data', function (response) {
            clearTimeout(sendTimeout);
            if (response) {
                logger.debug('%s - Received response from url "%s", response: %s', method, url, response);
                resolve(response);
            } else {
                logger.error('GRPC client got a null or undefined response from the server "%s".', url);
                reject(new Error(util.format('GRPC client got a null or undefined response from the server "%s".', url)));
            }
        });
        callback.on('error', function (err) {
            // An error has occurred and the stream has been closed.
            logger.debug('%s - Received response from: %s, error: %s', method, url, err);
            if (err instanceof Error) {
                reject(err);
            } else {
                reject(new Error(err));
            }
        });
        callback.on('end', function () {
            // The server has finished sending
        });
        callback.on('status', function (status) {
            // process status
        });
    }

    /**
     * Close the service connections.
     */
    close() {
        if (this._helmClient) {
            logger.debug('close - closing helm client connection ' + this._endpoint.addr);
            this._helmClient.close();
        }
    }

    /**
     * return a printable representation of this object
     */
    toString() {
        return 'Helm:{' + 'url:' + this._url + '}';
    }
};

module.exports = HelmClient;
