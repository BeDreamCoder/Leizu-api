'use strict';

const FabricCAClient = require('fabric-ca-client');

var BaseClient = class {
    constructor() {
        this._client = null;
        this._url = '';
        this._tlsOptions = null;
        this._caName = '';
        this._cryptoSuite = null;
    }

    setUrl(url) {
        this._url = url;
    }

    setTlsOptions(trustedRoots, verify) {
        this._tlsOptions = {trustedRoots, verify};
    }

    setCaName(name) {
        this._caName = name;
    }

    setCryptoSuite(suite) {
        this._cryptoSuite = suite;
    }

    getInstance() {
        if (this._client == null) {
            this._client = new FabricCAClient(this._url, this._tlsOptions, this._caName, this._cryptoSuite);
        }
        return this._client;
    }
};

module.exports = BaseClient;
