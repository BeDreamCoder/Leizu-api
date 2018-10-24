'use strict';

var util = require('util');
var Client = require('fabric-client');
var log4js = require('log4js');
var logger = log4js.getLogger('Join-Channel');
logger.level = 'debug';

/*
 * Have an organization join a channel
 */
var joinChannel = async function (channel_name, config) {
    logger.debug('\n\n============ Join Channel start ============\n');
    var error_message = null;
    var all_eventhubs = [];
    try {
        // first setup the client for this org
        let client = new Client();
        client.setAdminSigningIdentity(config.org.adminKey, config.org.adminCert, config.org.mspid);
        let channel = client.newChannel(channel_name);
        let orderer = client.newOrderer(config.orderConfig.url, {
            'pem': config.orderConfig.pem,
            'ssl-target-name-override': config.orderConfig['server-hostname']
        });
        channel.addOrderer(orderer);

        // next step is to get the genesis_block from the orderer,
        // the starting point for the channel that we want to join
        let request = {
            txId: client.newTransactionID(true) //get an admin based transactionID
        };
        let genesis_block = await channel.getGenesisBlock(request);

        let targets = null;
        if (config.org) {
            targets = [];
            for (let unit of config.org.peers) {
                let peer = client.newPeer(unit.url, {
                    'pem': config.org.tlscacerts,
                    'ssl-target-name-override': unit.name,
                    name: unit.name
                });
                targets.push(peer);
                channel.addPeer(peer);
            }
        }

        // tell each peer to join and wait 10 seconds
        // for the channel to be created on each peer
        var promises = [];
        // promises.push(new Promise(resolve => setTimeout(resolve, 10000)));

        let join_request = {
            targets: targets, //using the peer names which only is allowed when a connection profile is loaded
            txId: client.newTransactionID(true), //get an admin based transactionID
            block: genesis_block
        };
        let join_promise = channel.joinChannel(join_request);
        promises.push(join_promise);
        let results = await Promise.all(promises);
        logger.debug(util.format('Join channel response: %j', results));

        // lets check the results of sending to the peers which is
        // last in the results array
        let peers_results = results.pop();
        // then each peer results
        for (let i in peers_results) {
            let peer_result = peers_results[i];
            if (peer_result.response && peer_result.response.status === 200) {
                logger.info('Successfully joined peer to the channel %s', channel_name);
            } else {
                let message = util.format('Failed to joined peer to the channel %s', channel_name);
                error_message = message;
                logger.error(message);
            }
        }
    } catch (error) {
        logger.error('Failed to join channel due to error: ' + error.stack ? error.stack : error);
        error_message = error.toString();
    }

    // need to shutdown open event streams
    all_eventhubs.forEach((eh) => {
        eh.disconnect();
    });

    if (!error_message) {
        let message = util.format(
            'Successfully joined peers in organization  to the channel:%s', channel_name);
        logger.info(message);
        // build a response to send back to the REST caller
        let response = {
            success: true,
            message: message
        };
        return response;
    } else {
        let message = util.format('Failed to join all peers to channel. cause:%s', error_message);
        logger.error(message);
        throw new Error(message);
    }
};

exports.joinChannel = joinChannel;