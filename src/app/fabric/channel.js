'use strict';

const common = require('../../libraries/common');
const logger = require('../../libraries/log4js');
const ChannelService = require('../../services/fabric/channel');
const DbService = require('../../services/db/dao');
const router = require('koa-router')({prefix: '/channel'});

router.get('/', async ctx => {
    try {
        let channels = await DbService.getChannels();
        ctx.body = common.success(channels, common.SUCCESS);
    } catch (err) {
        logger.error(err);
        ctx.status = 400;
        ctx.body = common.error([], err.message);
    }
});

router.get('/:id', async ctx => {
    let id = ctx.params.id;
    try {
        let channel = await DbService.getChannelById(id);
        ctx.body = common.success(channel, common.SUCCESS);
    } catch (err) {
        logger.error(err);
        ctx.status = 400;
        ctx.body = common.error({}, err.message);
    }
});

/**
 * fn: add the new channel into fabric network
 * parameters: genesis block
 *
 */
router.post('/', async ctx => {
    let parameters = ctx.request.body;
    try {
        let consortiumId = parameters.consortiumId;
        let channelName = parameters.name;
        let profile = parameters.profile;
        let channelService = await ChannelService.getInstance(consortiumId, channelName);
        await channelService.createChannel(profile);
        let channel = await DbService.addChannel({
            name: parameters.name,
            consortiumId: parameters.consortiumId
        });
        ctx.body = common.success(channel, common.SUCCESS);
    } catch (err) {
        logger.error(err.stack ? err.stack : err);
        ctx.status = 400;
        ctx.body = common.error({}, err.message);
    }
});

/**
 * fn: update existing channel's configuration
 * parameters: configuration
 *
 */
router.put('/:id', async ctx => {
    let id = ctx.params.id;
    let params = ctx.request.body;
    try {
        let channel = await DbService.getChannelById(id);
        if (channel) {
            let channelService = await ChannelService.getInstance(channel.consortium_id, channel.name);
            await channelService.updateChannel(params.orgName);
            ctx.body = common.success({id: id}, common.SUCCESS);
        } else {
            logger.error('The channelId does not exist.');
            ctx.status = 400;
            ctx.body = common.error({}, 'The channelId does not exist.');
        }
    } catch (err) {
        logger.error(err);
        ctx.status = 400;
        ctx.body = common.error({}, err.message);
    }
});


module.exports = router;