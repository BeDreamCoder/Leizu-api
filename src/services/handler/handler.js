'use strict';


module.exports = class HttpHandler{

    constructor(ctx){
        this.ctx = ctx;
    }

    async handle(ctx){
        await this.preRequest(ctx);
        await this.handlerRequest(ctx);
        await this.postRequest(ctx);
    }

    async preRequest(ctx){

    }

    async handlerRequest(ctx){

    }

    async postRequest(ctx){

    }

};