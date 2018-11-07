'use strict';

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const stringUtil = require('../../libraries/string-util');

module.exports.CERT_PATHS = {
    cacerts: "cacerts",
    admincerts: "admincerts",
    signcerts: "signcerts",
    keystore: "keystore",
    tlscacerts: "tlscacerts"
};

module.exports.CredentialHelper = class CredentialHelper {

    constructor(mspId){
        this.mspId = mspId;
        this.dirName = path.join(__dirname,mspId);
        this.archiveFileName = path.join(this.dirName,this.mspId + ".zip");
    }

    writeCaCerts(caCert){
        let dirName = path.join(this.dirName,exports.CERT_PATHS.cacerts);
        if(this.isDirExists(dirName)){
            this.removeDir(dirName);
        }
        this.createDir(dirName);
        let filePath = path.join(dirName,"ca-cert.pem");
        this.writeFile(filePath,caCert);
    }

    writeTlsCaCerts(caCert){
        let dirName = path.join(this.dirName,exports.CERT_PATHS.tlscacerts);
        if(this.isDirExists(dirName)){
            this.removeDir(dirName);
        }
        this.createDir(dirName);
        let filePath = path.join(dirName,"cert.pem");
        this.writeFile(filePath,caCert);
    }

    writeAdminCerts(adminCert){
        let dirName = path.join(this.dirName,exports.CERT_PATHS.admincerts);
        if(this.isDirExists(dirName)){
            this.removeDir(dirName);
        }
        this.createDir(dirName);
        let filePath = path.join(dirName,"admin-cert.pem");
        this.writeFile(filePath,adminCert);
    }

    writeSignCerts(signCert){
        let dirName = path.join(this.dirName,exports.CERT_PATHS.signcerts);
        if(this.isDirExists(dirName)){
            this.removeDir(dirName);
        }
        this.createDir(dirName);
        let filePath = path.join(dirName,"sign-cert.pem");
        this.writeFile(filePath,signCert);
    }

    writeTlsCert(tls){
        let dirName = path.join(this.dirName,'tls');
        if(this.isDirExists(dirName)){
            this.removeDir(dirName);
        }
        this.createDir(dirName);
        let filePath = path.join(dirName,"cert.pem");
        this.writeFile(filePath,tls.cert);
        let keyPath = path.join(dirName,"key.pem");
        this.writeFile(keyPath,tls.key);
    }

    writeKey(key){
        let dirName = path.join(this.dirName,exports.CERT_PATHS.keystore);
        if(this.isDirExists(dirName)){
            this.removeDir(dirName);
        }
        this.createDir(dirName);
        let filePath = path.join(dirName,stringUtil.hash(key)+ ".pem");
        this.writeFile(filePath,key);
    }

    isDirExists(dirName){
        return fs.existsSync(dirName);
    }

    removeDir(dirName){
        fs.rmdirSync(dirName);
    }

    createDir(dirName){
        fs.mkdirSync(dirName);
    }

    writeFile(filePath, fileContent){
        fs.writeFileSync(filePath,fileContent);
    }

    removeFile(filePath){
        fs.unlinkSync(filePath);
    }

    async zipDirectoryFiles(){
        let output = fs.createWriteStream(this.archiveFileName);
        let archive = archiver('zip', {
            zlib: { level: 9 }
        });
        archive.pipe(output);
        archive.directory(this.dirName, false);
        await archive.finalize();
    }

};

module.exports.storeCredentials = async (mspId, credential) => {
    let credentialHelper = new CredentialHelper(mspId);
    credentialHelper.writeCaCerts(credential.rootCert);
    credentialHelper.writeTlsCaCerts(credential.rootCert);
    credentialHelper.writeAdminCerts(credential.adminCert);
    credentialHelper.writeKey(credential.adminKey);
    credentialHelper.writeSignCerts(credential.adminCert);
    await credentialHelper.zipDirectoryFiles();
    return credentialHelper.archiveFileName;
};
