module.exports = {
    /*ssr : {
        api : {
            server_url : 'https://222.112.146.82:26343/SSAI/SSAPI.ssr',
            username : 'ssrca',
            password : 'qwe123qwe123!'
        }
    },*/
    kafka : {
        recvTopic: process.env.NODE_ENV ? 'tp.cvms.backend.to.ssr' + '-' + process.env.NODE_ENV : 'tp.cvms.backend.to.ssr',
        ip: process.env.NODE_ENV === 'local'? '192.168.0.177:10000': '10.5.4.2:9092',
        memberId: process.env.NODE_ENV ? 'cvms-ssr-api' + '-' + process.env.NODE_ENV : 'cvms-ssr-api',
        sendTopic: process.env.NODE_ENV ? 'tp.cvms.ssr.to.backend' + '-' + process.env.NODE_ENV : 'tp.cvms.ssr.to.backend',
        groupId: process.env.NODE_ENV ? 'cvms-ssr-api-group' + '-' + process.env.NODE_ENV : 'cvms-ssr-api-group'
    }
};
