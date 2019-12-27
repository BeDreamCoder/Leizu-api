'use strict';

const BaseClient = require('./base-client');
const FabricClient = require('fabric-client');
const {HFCAIdentityAttributes, HFCAIdentityType} = require('fabric-ca-client/lib/IdentityService');

var CaClient = class extends BaseClient {
    constructor(opts) {
        super();
        this.setUrl(opts.url);
        if (typeof opts.tlsOptions === 'undefined' || opts.tlsOptions === null) {
            this.setTlsOptions([], false);
        }
        this.setCaName(opts.caName);
        if (typeof opts.cryptoSuite === 'undefined' || opts.cryptoSuite === null) {
            this.setCryptoSuite(FabricClient.newCryptoSuite());
        }
        this._registrar = null;
        this._fabricClient = new FabricClient();
    }

    async setRegistrar(username, mspid, enrollment) {
        this._registrar = await this._fabricClient.createUser({
            username,
            mspid,
            cryptoContent: {privateKeyPEM: enrollment.key.toBytes(), signedCertPEM: enrollment.certificate},
            skipPersistence: true
        });
    }

    /**
     * @param {string} enrollmentID. Note: CSR.CN=enrollmentID.
     * @param {string} profile The profile name.  Specify the 'tls' profile for a TLS certificate.
     */
    async enroll(enrollmentID, enrollmentSecret, profile) {
        return this.getInstance().enroll({
            enrollmentID,
            enrollmentSecret,
            profile,
            // attr_reqs: attrs
        });
    }

    async registerAffiliationMgr(username, password, affiliation, customAttrs) {
        let req = {
            enrollmentID: username,
            enrollmentSecret: password,
            role: HFCAIdentityType.CLIENT,
            affiliation: affiliation,
            maxEnrollments: 0,
            attrs: [
                {name: HFCAIdentityAttributes.HFREGISTRARROLES, value: '*'},
                {name: HFCAIdentityAttributes.HFREGISTRARDELEGATEROLES, value: '*'},
                {name: HFCAIdentityAttributes.HFREGISTRARATTRIBUTES, value: '*'},
                {name: HFCAIdentityAttributes.HFINTERMEDIATECA, value: 'true'},
                {name: HFCAIdentityAttributes.HFREVOKER, value: 'true'},
                {name: HFCAIdentityAttributes.HFAFFILIATIONMGR, value: 'true'},
                {name: HFCAIdentityAttributes.HFGENCRL, value: 'true'},
                {name: 'role', value: 'admin:ecert'},
                {name: 'admin', value: 'true:ecert'},
                {name: 'abac.init', value: 'true:ecert'},
            ].concat(customAttrs),
        };

        return this.getInstance().register(req, this._registrar);
    }

    async registerRole(username, password, role, affiliation, customAttrs) {
        let roles, delegateRoles;
        if (role === HFCAIdentityType.PEER) {
            roles = 'peer,user';
            delegateRoles = 'user';
        } else if (role === HFCAIdentityType.ORDERER) {
            roles = 'orderer,user';
            delegateRoles = 'user';
        } else if (role === HFCAIdentityType.USER) {
            roles = 'user';
            delegateRoles = 'user';
        }
        let req = {
            enrollmentID: username,
            enrollmentSecret: password,
            role: role,
            affiliation: affiliation,
            maxEnrollments: 0,
            attrs: [
                {name: HFCAIdentityAttributes.HFREGISTRARROLES, value: roles},
                {name: HFCAIdentityAttributes.HFREGISTRARDELEGATEROLES, value: delegateRoles},
                {name: HFCAIdentityAttributes.HFREGISTRARATTRIBUTES, value: '*'},
                {name: HFCAIdentityAttributes.HFINTERMEDIATECA, value: 'true'},
                {name: HFCAIdentityAttributes.HFREVOKER, value: 'true'},
                {name: HFCAIdentityAttributes.HFAFFILIATIONMGR, value: 'false'},
                {name: HFCAIdentityAttributes.HFGENCRL, value: 'true'},
            ].concat(customAttrs),
        };

        return this.getInstance().register(req, this._registrar);
    }

    // mgr invoke
    async addAffiliation(name) {
        let affiliationService = this.getInstance().newAffiliationService();
        return affiliationService.create({name}, this._registrar);
    }

    // mgr invoke
    async removeAffiliation(name, force) {
        let affiliationService = this.getInstance().newAffiliationService();
        return affiliationService.delete({name, force}, this._registrar);
    }

    async deleteDefaultAffiliation() {
        await this.removeAffiliation('org1', true);
        await this.removeAffiliation('org2', true);
    }
};

module.exports = CaClient;
