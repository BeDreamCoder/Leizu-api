'use strict';

const router = require("koa-router")();
const logger = require("../../libraries/log4js");
const Consortium = require("../../models/consortium");
const syncService = require("../../services/fabric/synchronize");
const common = require("../../libraries/common");

router.post("/fabric/sync/:id", async ctx => {
    let consortiumId = ctx.params.id;
    logger.debug("The consortium id is %d",consortiumId);
    try{
        Consortium.findById(consortiumId, (err,doc) => {
            if(err){
                ctx.body = common.error([],err.message);
            }else{
                let result = syncService.syncFabric(doc.network_config);
                ctx.body = common.success(result,common.SYNC_SUCCESS);                
            }
        });
    }catch(err){
        ctx.body = common.error([],err.message);
    }
});

module.exports = router;