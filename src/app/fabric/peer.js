'use strict';

const DbService = require('../../services/db/dao');
const PromClient = require('../../services/prometheus/client');
const PeerService = require('../../services/fabric/peer');
const common = require('../../libraries/common');
const router = require('koa-router')({prefix: '/peer'});

router.get('/', async ctx => {
    try {
        const {peers, channels, organizations} = await queryDetails(ctx.query['organizationId']);
        const promClient = new PromClient();
        const cpuMetrics = await promClient.queryCpuUsage();
        const memoryMetrics = await promClient.queryMemoryUsage();

        const peerDetails = peers.map((peer) => {
            const org = organizations.find(org => peer.org_id === org._id);

            let organizationName = org && org.name;
            let channelNames = channels.filter(channel => channel.peers.includes(peer._id))
                .map(channel => channel.name);
            let cpu = cpuMetrics.find(data => peer.location.includes(data.metric.name)).value[1];
            let memory = memoryMetrics.find(data => peer.location.includes(data.metric.name)).value[1];
            return {...peer.toJSON(), organizationName, channelNames, cpu, memory};
        });
        ctx.body = common.success(peerDetails, common.SUCCESS);
    } catch (ex) {
        ctx.body = common.error([], ex);
    }
});

const queryDetails = async (orgId) => {
    let peers, channels, organizations = [];
    if (orgId) {
        peers = await DbService.findPeersByOrgId(orgId);
        organizations = await DbService.findOrganizationById(orgId);
    } else {
        peers = await DbService.findPeers();
        organizations = await DbService.findOrganizations();

    }
    channels = await DbService.getChannels();
    return {peers, channels, organizations};
};

router.get('/:id', async ctx => {
    let id = ctx.params.id;
    try {
        let peer = await DbService.findPeerById(id);
        ctx.body = common.success(peer, common.SUCCESS);
    } catch (err) {
        ctx.status = 400;
        ctx.body = common.error({}, err.message);
    }
});


/**
 * fn: add the peer into channel by join request
 * parameters: to-be-specified
 *
 */
router.put("/:id", async ctx => {
    let id = ctx.params.id;
    let params = ctx.request.body;
    try {
        let peerService = new PeerService();
        await peerService.joinChannel(id, params);
        ctx.body = common.success({id: id}, common.SUCCESS);
    } catch (err) {
        ctx.status = 400;
        ctx.body = common.error({}, err.message);
    }
});

module.exports = router;