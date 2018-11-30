module.exports = {
    network: {
      peer: {
          tls: false,
          availableImages:[
              'hyperledger/fabric-ca-peer',
          ]
      },
      orderer: {
          tls: false,
          availableImages:[
              'hyperledger/fabric-ca-orderer',
          ]
      }
    },
    koaLogger: true,
    jwt: {
        secret: '`yGE[RniLYCX6rCni>DKG_(3#si&zvA$WPmgrb2P',
        expiresIn: 36000
    },
    database: {
        url: 'mongodb://127.0.0.1:27017/zigdb',
        debug: false
    },
    ssh: {
        port: 22
    },
    prometheus: {
        url: 'http://47.94.200.47:9090'
    },
    configtxlator: {
        url: 'http://59.110.164.211:7059',
        dataPath: '/tmp/configtxlator/data',
        connectionOptions: {
            mode: 'ssh',
            host: '59.110.164.211',
            username: 'root',
            password: '***REMOVED***',
            port: 22
        }
    },
    cryptoConfig: {
        name: 'configtx.yaml',
        path: '/tmp/crypto-config'
    }
};
