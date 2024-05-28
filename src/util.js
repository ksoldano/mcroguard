const crypto = require('crypto')
const ENCRYPTION_KEY = "zbqmqmdldpadptm!123";
    //process.env.ENCRYPTION_KEY || 'abcdefghijklmnop'.repeat(2) // Must be 256 bits (32 characters)
const IV_LENGTH = 16 // For AES, this is always 16

exports.getFileName = function(str) {
    if(!str)
        return "";
    const strElem = str.split('.');
    if (strElem.length > 0)
        return strElem[0];
}

exports.getEpoch = function(epoch){
    return new Date(epoch*1000);
    /*const dt = new Date(0);
    dt.setUTCSeconds(Number(epoch));
    return dt;*/
}

/*exports.getUrl = function(cdm){
    //server_url : 'https://222.112.146.82:26343/SSAI/SSAPI.ssr',

    if(cdm.data.chckToolCd == 'SS')
        return 'https://' + cdm.data.conectIp + ':' +  cdm.data.conectPort + '/SSAI/SSAPI.ssr';
}*/


function decrypt(text) {

    const base64DecodeString = Buffer.from(text, 'base64').toString('utf8');

    const textParts = base64DecodeString.split(':')
    const iv = Buffer.from(textParts.shift(), 'hex')
    const encryptedText = Buffer.from(textParts.join(':'), 'hex')
    const decipher = crypto.createDecipheriv(
        'aes-256-cbc',
        Buffer.from(ENCRYPTION_KEY),
        iv,
    )
    const decrypted = decipher.update(encryptedText)

    return Buffer.concat([decrypted, decipher.final()]).toString()
}

exports.getHeaderAuth = function(cdm){

    if(cdm.data.chckToolCd === 'SS') {
        return {
            //headers: {Authorization: 'Basic ' + btoa(cdm.data.conectId + ':' + cdm.data.conectPasswd) }
            headers: {Authorization: 'Basic ' + cdm.data.authBase64}
        }
    }

}

exports.getErrorMessage = function(e){

    if(e.code && e.code === 'ECONNREFUSED'){
        return 'API 서버 인증이 거부 되었습니다.';
    }else if(e.code && e.code === 'ERR_CONNECTION_REFUSED'){
        return 'API 서버가 응답이 없습니다.';
    }else{
        return e.message;
    }

}

//자산 상태 체크
exports.getAgentSttus = function(now, lastPingEpoch, interval) {

    let agentSttusCd = 'NONRESP';
    if(!lastPingEpoch)
        return agentSttusCd;

    const lastPingDate = module.exports.getEpoch(lastPingEpoch);

    const intervalBufferRatio = 3;
    agentSttusCd = Math.abs(now - lastPingDate) / 1000 > (interval*intervalBufferRatio) ? agentSttusCd : 'NORMAL';

    return agentSttusCd;
}

//자산 유형 체크
exports.getAssetsTypeCd = function(typeClass) {

    if(!typeClass)
        return typeClass;
    if(typeClass.toUpperCase() == 'NETWORK')
        return 'NTWRK';
    else
        return typeClass.toUpperCase();
}


exports.getDecision = function(_code){
    //SSR 2.5 : 진단 결과 (Fail: 취약, Except: 예외, ALT: 대체, Manual: 미판정, NA: N/A, Pass: 양호, MANUAL: 수동점검)",
    /* CUVE 4
    VLNR	취약
GOOD	양호
EXCP	예외
RSKACP	위험수용
ALTR	대체
UNDC	미판정
NA	해당없음
UNCHCK	미점검*/

    const code = _code.toUpperCase();

    if(code === 'FAIL'){
        return 'VLNR';
    }else if(code === 'EXCEPT'){
        return 'EXCP';
    }else if(code === 'ALT'){
        return 'ALTR';
    }else if(code === 'MANUAL'){
        return 'UNDC';
    }else if(code === 'NA'){
        return 'NA';
    }else if(code === 'PASS'){
        return 'GOOD';
    }else if(code === 'MANUAL'){
        return 'MANUAL';
    }
}

exports.getAssetsKnd = function(item) {

    let assetsKnd = null;
    if(item.typeClass == 'OS') {
        //1: Windows, 2: AIX, 4: HP-UX, 8: Linux, 16: Solaris
        switch (item.ssOsType) {
            case 1:
                assetsKnd = 'Windows';
                break;
            case 2:
                assetsKnd = 'AIX';
                break;
            case 4:
                assetsKnd = 'HP-UX';
                break;
            case 8:
                assetsKnd = 'Linux';
                break;
            case 16:
                assetsKnd = 'Solaris';
                break;
        }
    }else if(item.typeClass == 'DB'){
        //(1: Oracle, 2: MSSQL, 4: MySQL, 8: Sybase, 16: Tibero, 32: DB2, 64: PostgreSQL, 128: Altibase, 256: MariaDB, 512: Informix)
        switch (item.ssDbType) {
            case 1:
                assetsKnd = 'Oracle';
                break;
            case 2:
                assetsKnd = 'MSSQL';
                break;
            case 4:
                assetsKnd = 'MySQL';
                break;
            case 8:
                assetsKnd = 'Sybase';
                break;
            case 16:
                assetsKnd = 'Tibero';
                break;
            case 32:
                assetsKnd = 'DB2';
                break;
            case 64:
                assetsKnd = 'PostgreSQL';
                break;
            case 128:
                assetsKnd = 'Altibase';
                break;
            case 256:
                assetsKnd = 'MariaDB';
                break;
            case 512:
                assetsKnd = 'Informix';
                break;
        }
    }else if(item.typeClass == 'WEB'){
        //(1: Apache, 2: IIS, 4: WebtoB, 8: OHS, 16: Tomcat, 32: WebLogic, 64: Jeus, 128: WebSphere, 256: JBoss, 1024: Iplanet)
        switch (item.ssWebType) {
            case 1:
                assetsKnd = 'Apache';
                break;
            case 2:
                assetsKnd = 'IIS';
                break;
            case 4:
                assetsKnd = 'WebtoB';
                break;
            case 8:
                assetsKnd = 'OHS';
                break;
            case 16:
                assetsKnd = 'Tomcat';
                break;
            case 32:
                assetsKnd = 'WebLogic';
                break;
            case 64:
                assetsKnd = 'Jeus';
                break;
            case 128:
                assetsKnd = 'WebSphere';
                break;
            case 256:
                assetsKnd = 'JBoss';
                break;
            case 1024:
                assetsKnd = 'Iplanet';
                break;
        }

    }else if(item.typeClass == 'NETWORK'){
        // (1: Cisco, 2: Juniper, 4: Alteon, 8: 3Com, 16: Alcatel, 32: Extreme, 64: Ffive)",
        switch (item.ssNetworkType) {
            case 1:
                assetsKnd = 'Cisco';
                break;
            case 2:
                assetsKnd = 'Juniper';
                break;
            case 4:
                assetsKnd = 'Alteon';
                break;
            case 8:
                assetsKnd = '3Com';
                break;
            case 16:
                assetsKnd = 'Alcatel';
                break;
            case 32:
                assetsKnd = 'Extreme';
                break;
            case 64:
                assetsKnd = 'Ffive';
                break;

        }
    }else if(item.typeClass == 'Application'){
        // (1: RHEV, 2: Kubernetes, 4: OpenStack, 8: Hadoop, 16: Docker)
        switch (item.ssApplicationType) {
            case 1:
                assetsKnd = 'RHEV';
                break;
            case 2:
                assetsKnd = 'Kubernetes';
                break;
            case 4:
                assetsKnd = 'OpenStack';
                break;
            case 8:
                assetsKnd = 'Hadoop';
                break;
            case 16:
                assetsKnd = 'Docker';
                break;

        }
    }else if(item.typeClass == 'Cloud'){
        //  (1: AWS, 2: Azure, 4: GCP, 8: CloudZ)",
        switch (item.ssCloudType) {
            case 1:
                assetsKnd = 'AWS';
                break;
            case 2:
                assetsKnd = 'Azure';
                break;
            case 4:
                assetsKnd = 'GCP';
                break;
            case 8:
                assetsKnd = 'CloudZ';
                break;

        }
    }else if(item.typeClass == 'Hypervisor'){
        //  (1: ESXi, 2: Xen)",
        switch (item.ssHypervisorType) {
            case 1:
                assetsKnd = 'ESXi';
                break;
            case 2:
                assetsKnd = 'Xen';
                break;

        }
    }


    return assetsKnd;

}

