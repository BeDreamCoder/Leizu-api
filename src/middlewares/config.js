/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/
const common = require('../libraries/common');
const DbService = require('../services/db/dao');

module.exports = async (ctx, next) => {
    let { id, channel: channelName } = ctx.params;
    try {
        let consortium = await DbService.getConsortiumById(id);
        if (consortium) {
            let channel = await DbService.getChannelByFilter({
                consortium_id: consortium._id,
                name: channelName,
            });
            if (channel) {
                let organizations = await DbService.findOrganizationByFilter({
                    consortium_id: consortium._id,
                    type: common.PEER_TYPE_PEER,
                });
                if (organizations && organizations.length) {
                    let organization = organizations[0];
                    let peer = await DbService.findPeerByFilter({
                        consortium_id: consortium._id,
                        org_id: organization._id,
                        type: common.PEER_TYPE_PEER,
                    });
                    if (peer) {
                        let caConfig = await DbService.getCaByOrgId(organization._id);
                        let peerConfig = {
                            adminKey: organization.admin_key,
                            adminCert: organization.admin_cert,
                            mspid: organization.msp_id,
                            'server-hostname': `${peer.name}.${organization.domain_name}`,
                            url: `grpc://${peer.location}`,
                        };
                        ctx.channel = channel;
                        ctx.peerConfig = peerConfig;
                        ctx.caConfig = caConfig;
                        await next();
                    } else {
                        ctx.status = 404;
                        ctx.body = common.error({}, 'Peer not exist');
                    }
                } else {
                    ctx.status = 404;
                    ctx.body = common.error({}, 'Organization not exist');
                }
            } else {
                ctx.status = 404;
                ctx.body = common.error({}, 'Channel not exist');
            }
        } else {
            ctx.status = 404;
            ctx.body = common.error({}, 'Consortium not exist');
        }
    } catch (err) {
        ctx.status = 400;
        ctx.body = common.error([], err.message);
    }
};
