'use strict';

const mongoose = require('mongoose');
const chaincodeSchema = new mongoose.Schema({
    uuid: String,
    name: String,
    path: String,
    version: String,
    language: String,
    peers: String,
    date: {
        type: Date,
        default: Date.now()
    }
});

module.exports = mongoose.model('Chaincode', chaincodeSchema, 'chaincode');