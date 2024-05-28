const { Kafka, Partitioners} = require('kafkajs')
//const {getAdtTemplateInfo, collectAssetInfo, testAlive} = require('./ssrApi25.js');
const logger = require('log4js').getLogger('cvmsSsrApi');
const cvmsConfig = require("./config/cvms.config.js");
const {getErrorMessage} = require("./util.js");
const {SsrApi40} = require("./SsrApi40");

const {SsrApi25} = require('./SsrApi25');


//const ssrApi40 = new SsrApi40('hi');
//logger.info(ssrApi40.getHi());


const ssrApi25 = new SsrApi25();

/*if (process.env.NODE_ENV) {
    cvmsConfig.kafka.groupId = cvmsConfig.kafka.groupId + '-' + process.env.NODE_ENV;
}*/

logger.info('Kafka Info', cvmsConfig.kafka);

const kafka = new Kafka({
    clientId: 'cl-cvms-ssr-api-app',
    //brokers: ['192.168.0.177:9092']
    brokers: [cvmsConfig.kafka.ip],

})


const producer = kafka.producer({ createPartitioner: Partitioners.LegacyPartitioner });
//const producer = kafka.producer();
const consumer = kafka.consumer(
    { memberId:cvmsConfig.kafka.memberId, groupId: cvmsConfig.kafka.groupId,
        sessionTimeout: 90000,
        heartbeatInterval:3000
          });


const initKafkaProducer = async () => {
    await producer.connect();

    logger.info('started producer connected');

    const sendMsg = {
                        sender: 'ssrApiServer',
                        receiver: '*',
                        msgCreatDt : new Date(),
                        data: '',
                        code: 1,
                        callFunction: '',
                        message: 'Ssr api server start'
                    }
    await producer.send({
        topic: cvmsConfig.kafka.sendTopic, /*'tp.cvms.backend.sending',*/
        //groupId: 'cvms-ssr-api-group',
        messages: [
                            { value: JSON.stringify(sendMsg), key: 'cvms'},
        ]
    });


}

const initKafkaConsumer = async () => {
    console.log('start subscribe')

    await consumer.connect();
    await consumer.subscribe({ topic: cvmsConfig.kafka.recvTopic, fromBeginning: false })
    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {

            let returnMsg = {};
            let cdm;
            try {

                cdm = JSON.parse(message.value.toString());
                cdm.data = JSON.parse(cdm.data);
                if(cdm.data.parameter)
                    cdm.data.parameter = JSON.parse(cdm.data.parameter);

                logger.info('Receive Msg', {
                    value: cdm,
                })

                if(cdm.callFunction === 'getAdtTemplateInfo') {

                    const res = await ssrApi25.getAdtTemplateInfo(cdm);
                    returnMsg = {
                        sender: 'ssrApiServer',
                        receiver: cdm.sender,
                        msgCreatDt : new Date(),
                        data: 'testdata',
                        code: 1,
                        callFunction: cdm.callFunction,
                        message: cdm.data.toolNm +  ' 템플릿 수집을 완료하였습니다.'
                    }

                }else if(cdm.callFunction === 'alive') {

                    const res = await ssrApi25.testAlive(cdm);
                    returnMsg = {
                        sender: 'ssrApiServer',
                        receiver: cdm.sender,
                        msgCreatDt: new Date(),
                        data: 'testdata',
                        code: 1,
                        callFunction: cdm.callFunction,
                        message: cdm.data.toolNm +  ' 서버 통신 상태 체크'
                    }
                }else if(cdm.callFunction === 'getResultAuditList') {
                    const res = await ssrApi25.getResultAuditList(cdm);
                    returnMsg = {
                            sender: 'ssrApiServer',
                            receiver: cdm.sender,
                            msgCreatDt : new Date(),
                            data: (res.info && res.info.isOk === 1)? '' : res.info.errInfo,
                            code: 500,
                            callFunction: cdm.callFunction,
                            message: (res.info && res.info.isOk === 1)? cdm.data.toolNm +  ' 점검 결과를 수집하였습니다.': cdm.data.toolNm +  ' 점검 결과 API 오류가 발생하였습니다.'
                    }

                }else if(cdm.callFunction === 'collectAssetInfo') {

                    const res = await ssrApi25.collectAssetInfo(cdm);
                    returnMsg = {
                            sender: 'ssrApiServer',
                            receiver: cdm.sender,
                            msgCreatDt : new Date(),
                            data: (res.info && res.info.isOk === 1)? '' : res.info.errInfo,
                            code: 500,
                            callFunction: cdm.callFunction,
                            message: (res.info && res.info.isOk === 1)? cdm.data.toolNm +  ' 자산 수집을 완료하였습니다.':cdm.data.toolNm +  ' 자산 수집 API 오류가 발생하였습니다.'
                    }



                }


            }catch(e){

                logger.error(e);

                returnMsg = {
                    sender: 'ssrApiServer',
                    receiver: cdm.sender,
                    code: e.code,
                    msgCreatDt : new Date(),
                    callFunction: '',
                    message:  cdm.data.url + ' ' + getErrorMessage(e)
                }
            }


            const sendMessage = {
                    topic:  cvmsConfig.kafka.sendTopic, /*'tp.cvms.backend.sending',*/
                    messages: [
                            { value: JSON.stringify(returnMsg), key: 'cvms'},
                    ],
            };

            producer.send(sendMessage);

            logger.info(' producer.send', sendMessage);

        },
    })
}

initKafkaProducer();
initKafkaConsumer();

//exports.producer = producer;
//const {producer} = producer;
