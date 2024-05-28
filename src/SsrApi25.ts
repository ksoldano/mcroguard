import {getAgentSttus, getAssetsKnd, getAssetsTypeCd, getEpoch, getHeaderAuth} from "./util";
import {DbProcess} from "./DbProcess";
import os from "os";
import {Ssr25Util} from "./ssr25util";
import util_1 from "../dist/src/util";

const path = require('path');
const FormData = require("form-data");
const axios = require("axios");
const _ = require("lodash");
const logger = require('log4js').getLogger('cvmsSsrApi');
const cvmsConfig = require("./config/cvms.config.js");

// @ts-ignore
const {getHeaderAuth, getEpoch, getDecision, getAssetsTypeCd, getAssetsKnd, getUrl} = require("./util.js");

//const dbConfigDev = require("./config/db.config.js");
//const dbConfigReal = require("./config/db.config.real.js");

// Now require the module using the constructed path
const modulePath = "./config/db.config." + process.env.NODE_ENV + ".js";
const dbConfig = require(modulePath);
//const dbConfig = process.env.NODE_ENV === 'local' ? dbConfigDev: dbConfigReal;

logger.info('CVMS SSR API Server process.env.NODE_ENV:', process.env.NODE_ENV, dbConfig.HOST);


const { knexSnakeCaseMappers } = require('objection');
const knex = require('knex')({
    client: 'pg',
    connection: {
        //connectionString: dbConfig.DB,
        host: dbConfig.HOST,
        port: dbConfig.PORT,
        user: dbConfig.USER,
        database: dbConfig.DB,
        password: dbConfig.PASSWORD,
        //ssl: dbConfig.DB_SSL ? { rejectUnauthorized: false } : false
    },
    pool: dbConfig.POOL,
    ...knexSnakeCaseMappers()
});


export class SsrApi25 {

    /*private knex = require('knex')({
        client: 'pg',
        connection: {
            //connectionString: dbConfig.DB,
            host: dbConfig.HOST,
            port: dbConfig.PORT,
            user: dbConfig.USER,
            database: dbConfig.DB,
            password: dbConfig.PASSWORD,
            //ssl: dbConfig.DB_SSL ? { rejectUnauthorized: false } : false
        },
        pool: dbConfig.POOL,
        ...knexSnakeCaseMappers()
    });*/

    constructor() {

    }

    testAlive = async (cdm:any)=>{
        let bodyFormData = new FormData();
        bodyFormData.append('apiId', 'getUserInfo');
        bodyFormData.append('userId', cdm.data.conectId);


        await axios.post(cdm.data.url, bodyFormData, getHeaderAuth(cdm))
            .then(async function (response:any) {

                if(response.data.info)
                    return true;
                else
                    return false;
            }).catch((err: any) => {
                throw err;
            });

    }

    /**
     * 사용자 정보
     * @param cdm
     * @param param
     * @returns {Promise<void>}
     */
    getUserInfo = async (cdm:any, param:any)=>{
        let fd = new FormData();
        fd.append('apiId', 'getUserInfo');
        fd.append('userNoArray', param.authUserNos);
        //bodyFormData.append('returnType', 1 );

        const that = this;
        await axios.post(cdm.data.url, fd, getHeaderAuth(cdm))
            .then(async function (response:any) {

                if(response.info && response.info.isOk != 1){
                    throw new Error(response.info.errInfo);
                }

                param.userIdInfos = response.data.list.map((e:any) => {
                    return {'isEnable': e.isEnable, userId: e.userId}
                });

                return response.data;
            }).catch((err: any) => {
                throw err;
            });

    }

    /**
     * 자산 그룹은 데이터 조회후 전체를 트랜잭션 처리한다.
     * @param cdm
     * @returns {Promise<T>}
     */
    getAgentGroupInfo = async (cdm:any) => {
        let fd = new FormData();
        fd.append('apiId', 'getAgentGroupInfo');

        logger.info('[getAgentGroupInfo] 자산그룹 수집 요청');
        const that = this;
        return await axios.post(cdm.data.url, fd, getHeaderAuth(cdm))
            .then(async function (response:any) {

                logger.info('[getAgentGroupInfo] 자산그룹 수집 응답', response.data.info);

                try {

                    if (response.data.info && response.data.info.isOk != 1) {
                        throw new Error(response.data.info.errInfo);
                    }

                    //사용자 정보 호출 여부
                    if (cdm.data.parameter && cdm.data.parameter.collectUserInfo) {
                        // 사용자 아이디 정보를 그룹에 매핑함
                        for (const item of response.data.agentGroupInfo) {

                            if (item.isEnable) {
                                item.userInfos = await that.getUserInfo(cdm, item);
                            }
                        }
                    }

                    //사용자 그룹 리셋이 아니면 DB 적용하지 않는다.
                    if (cdm.data.parameter && !cdm.data.parameter.groupReset)
                        return response.data;

                    // TODO 자산그룹 전체 트랜잭션
                    await knex.transaction(async (trx: { rollback: any }) => {

                        for (const item of response.data.agentGroupInfo) {

                            // TODO 사용 여부 skip 할것인지 ??
                            // 아니면 아래 처럼 삭제 할것인지...
                            /*if(item.isEnable == 0){
                                continue;
                            }*/


                            if (item.isEnable) {
                                //knex.datetime('changeDt', { precision: 6 }).defaultTo(knex.fn.now(6));

                                const insertItem = {
                                    //chckToolCd:   cdm.data.chckToolCd, //chckToolCd: 'SS',
                                    chckServerId: cdm.data.chckToolId,
                                    registId: -1,
                                    newYn: 'N',
                                    assetsGroupId: item.agentGroupNo,
                                    parentsGroupId: item.parentAgentGroupNo,
                                    groupNm: item.groupName,
                                    registDt: knex.fn.now(),
                                }

                                knex("tnAssetsGroup")
                                    .transacting(trx)
                                    .insert(insertItem)
                                    .onConflict(['assetsGroupId', 'chckServerId'])
                                    .merge({'changeDt': knex.fn.now()})
                                    //.then(trx.commit)
                                    .catch(trx.rollback);

                                logger.info('getAgentGroupInfo insertItem : ', insertItem);

                            } else {


                                // 삭제
                                const delItem = {
                                    chckServerId: cdm.data.chckToolId,
                                    assetsGroupId: item.agentGroupNo,
                                    parentsGroupId: item.parentAgentGroupNo
                                }
                                knex("tnAssetsGroup")
                                    .where(delItem)
                                    .del()
                                    .transacting(trx)
                                    //.then(trx.commit)
                                    .catch(trx.rollback);

                                logger.info('getAgentGroupInfo deleteItem : ', delItem);

                            }


                        }
                    });
                } catch (e) {

                    logger.error(e);
                }

                return response.data;

            }).catch((err: any) => {
                logger.error(err);
                throw err;
            });

    }

    /**
     * 자산 그룹, 자산 그룹 사용자 및 자산 수집 (SKB 버전)
     * @param cdm
     * @returns {Promise<*>}
     */
    collectAssetInfo = async (cdm:any)=> {

        const that = this;
        return await this.getAgentGroupInfo(cdm)
            .then(
                async res => {
                    //console.log(res);
                    /*for (const item of res.agentGroupInfo) {
                        if (item.isEnable != 0) {
                            const linkInfos = JSON.parse(item.linkInfo);


                            if (linkInfos == null || linkInfos.length == 0)
                                continue;

                            for (const linkInfo of linkInfos) {

                                const aParam = {
                                    linkInfo: linkInfo,
                                    userIdInfos: item.userIdInfos
                                }
                                await that.getAssetInfo(cdm, aParam);
                            }
                        }

                    }*/

                    await that.getAssetInfo(cdm, res.agentGroupInfo);

                    return res;

                }
            );


    }

    /**
     * 자산 정보 수집
     * 정보 수집후 자산 하나 단위로 트랜잭션 처리(자산, 자산 그룹, 자산 담당자 처리)
     * @param cdm
     * @param param
     * @returns {Promise<void>}
     */
    getAssetInfo = async (cdm:any, param:any) => {
        let fd = new FormData();
        fd.append('apiId', 'getAssetInfo');
        if(param.alinkNoArray)
            fd.append('alinkNoArray', param.alinkNoArray);
        //fd.append('assetNoArray', param.linkInfo.assetNo);

        logger.info('[getAssetInfo] 자산정보 수집 요청');

        const dbProcess = new DbProcess();

        const that = this;
        await axios.post(cdm.data.url, fd, getHeaderAuth(cdm))
            .then(async function (response:any) {

                const nowAgentSttus = new Date();
                logger.info('[getAssetInfo] 자산정보 수집 응답', response.data.info);

                for (const item of response.data.list) {

                    try {

                        //자산별로 트랜잭션
                        await knex.transaction(async (trx: any) => {


                            const assetsId = await  dbProcess.insertSsrAssets25(trx, item, cdm);

                            //자산 그룹 매핑

                            if(!item.agentGroupNoArray)
                                return;

                            const agentGroupNoList = item.agentGroupNoArray.split(',');

                            for (const groupId of agentGroupNoList) {

                                if(item.agentGroupNoArray && cdm.data.parameter && cdm.data.parameter.groupReset) {

                                    await dbProcess.insertAssetsGroupMapng(trx,assetsId,groupId);

                                }

                                //사용자 정보를 수집할 경우
                                if(cdm.data.parameter && cdm.data.parameter.collectUserInfo) {
                                    const arrFind = param.filter((e:any)=> e.agentGroupNo == groupId);
                                    if(arrFind.length < 1){
                                        return;
                                    }

                                    const findGroup = arrFind[0];

                                    // userId로 부터 uid 조회
                                    const userIds = await knex('tbUser').select('id').whereIn('userId', findGroup.userIdInfos.map((e:any) => e.userId)); // Resolves to any
                                    logger.info('TnAssetsSsr userIds  : ', userIds);

                                    for (const uid of userIds) {

                                        // 자산 담당자 매핑
                                        await dbProcess.insertAssetsChargerMapng(trx, assetsId, uid);


                                    }
                                }
                            }




                        });

                    } catch (e) {
                        logger.error(e);
                        //throw e;
                    }

                }

                return true; //response.data;
            }).catch((err: any) => {
                throw err;
            });

    }

    getAdtTemplateInfo = async (cdm:any)=>{
        let bodyFormData = new FormData();
        bodyFormData.append('apiId', 'getAdtTemplateInfo');
        bodyFormData.append('returnType', 1 );

        const that = this;
        await axios.post(cdm.data.url, bodyFormData, getHeaderAuth(cdm)
        )
            .then(async function (response:any) {


                try {
                    knex.transaction(async (trx: any) => {

                        //템플릿이 없으면 리턴
                        if(response.data.templateList && response.data.templateList.length == 0) {

                            return;
                        }


                        // atemplateNo 가 없으면 삭제
                        await knex('tnTmpltSsr')
                                .where('chckToolId', cdm.data.chckToolId)
                                .and
                                .whereNotIn('atemplateNo', response.data.templateList.map((e: { atemplateNo: any; })=> e.atemplateNo))
                                .del();


                        for (const item of response.data.templateList) {
                            //response.data.templateList.forEach(function (item) {

                            if(item.isEnable == 0){
                                continue;
                            }

                            logger.info('getAdtTemplateInfo : ', item);

                            let itemId;
                            const isCheck = await knex('tnTmpltSsr') // User is the type of row in database
                                .select('itemId')
                                .where('chckToolId', cdm.data.chckToolId)
                                .and
                                .where('atemplateNo', item.atemplateNo)
                                .first();

                            if (isCheck) {
                                itemId = isCheck.itemId;
                            } else {
                                const result = await knex.select(knex.raw("'TPL' || TO_CHAR(NOW(),'YYYYMMDD') || LPAD(NEXTVAL('tn_tmplt_ssr_seq')::TEXT,10,'0') as id")).first();
                                itemId = result.id;
                            }


                            const insertItem={
                                itemId: itemId,
                                atemplateNo : item.atemplateNo,
                                templateName : item.templateName,
                                showConfig : item.showConfig,
                                chckToolId : cdm.data.chckToolId,
                                isManual : 'N',
                                registDt: knex.fn.now(),
                                regDate : getEpoch(item.templateRegEpoch),
                                modifyDate : getEpoch(item.modifyEpoch)

                                /*isActive : item.isEnable,
                                regDate : new Date(item.templateRegEpoch),
                                modifyDate: new Date(item.modifyEpoch),
                                regist_dt: knex.fn.now()*/
                            }

                            item.itemId = itemId;

                            //knex.datetime('changeDt', { precision: 6 }).defaultTo(knex.fn.now(6));

                            await knex("tnTmpltSsr")
                                .insert(insertItem)
                                .onConflict(['atemplateNo', 'chckToolId'])
                                .merge({'changeDt': knex.fn.now()})
                                .transacting(trx);
                        }

                        console.log(response.data.templateList);
                        console.log('a');

                    });
                } catch (e) {
                    logger.error(e);
                }

                for (const item of response.data.templateList) {

                    if(item.isEnable) {
                        await that.getAdtTemplateInfoDetail(cdm, item);
                    }
                }

                //진단 기준 v_chck_item 뷰를 갱신한다.
                knex.schema.refreshMaterializedView('v_chck_item');


                return response.data;
            }).catch((err: any) => {
                throw err;
            });

    }





    getAdtTemplateInfoDetail = async (cdm:any, param:any)=>{
        let bodyFormData = new FormData();
        bodyFormData.append('apiId', 'getAdtTemplateInfo');
        bodyFormData.append('returnType', 0 );
        bodyFormData.append('atemplateNo', param.atemplateNo );


        await axios.post(cdm.data.url, bodyFormData, getHeaderAuth(cdm))
            .then(async function (response:any) {

                let i = 0;
                try {
                    knex.transaction(async (trx: any) => {

                        await knex('tnTmpltSsrDetail')
                                .where('tmplt_item_id', param.itemId)
                                .del();

                        for (const item of response.data.templateList) {

                            if(item.isEnable == 0){
                                continue;
                            }

                            logger.info('getAdtTemplateInfoDetail : ', i++, item);

                            const insertItem={
                                tmplt_item_id : param.itemId,
                                vitemNo: item.vitemNo,
                                atemplateNo: item.atemplateNo,
                                templateName: item.templateName,
                                templateType: item.templateType,
                                itemCode: item.itemCode,
                                userCode: item.userCode,
                                userClass: item.userClass,
                                userLevel: Ssr25Util.getUserLevelToCvmsLevel(item.userLevel),
                                typeClass: Ssr25Util.getType(item).typeClass,
                                typeNames: Ssr25Util.getType(item).typeNames,
                                title: item.title,
                                standard: item.standard,
                                fix: item.fix,
                                fixHtml: item.fixHtml,
                                conf: item.conf,
                                registDt: knex.fn.now(),
                                changeDt: knex.fn.now()

                            };

                            const updateItem = {
                                tmplt_item_id : param.itemId,
                                vitemNo: item.vitemNo,
                                atemplateNo: item.atemplateNo,
                                templateName: item.templateName,
                                templateType: item.templateType,
                                itemCode: item.itemCode,
                                userCode: item.userCode,
                                userClass: item.userClass,
                                userLevel: Ssr25Util.getUserLevelToCvmsLevel(item.userLevel),
                                typeClass: Ssr25Util.getType(item).typeClass,
                                typeNames: Ssr25Util.getType(item).typeNames,
                                title: item.title,
                                standard: item.standard,
                                fix: item.fix,
                                fixHtml: item.fixHtml,
                                conf: item.conf,
                                changeDt: knex.fn.now()
                            };


                            await knex("tnTmpltSsrDetail")
                                .insert(insertItem)
                                .onConflict(['vitemNo'])
                                .merge(updateItem)
                                .transacting(trx);

                        }
                    });

                    logger.info('getAdtTemplateInfoDetail end');

                } catch (e) {
                    logger.error(e);
                }

                return true;
            }).catch((err: any) => {
                throw err;
            });

    }

    getAuditStatusTotal = async (cdm:any, item:any)=>{
        let fd = new FormData();
        fd.append('apiId', 'getAuditStatusTotal');

        if (item.auditGroupNo) {
            fd.append('auditGroupNoArray', item.auditGroupNo);
        }
        //fd.append('auditGroupNoArray', param.auditGroupNoArray );


        return await axios.post(cdm.data.url, fd, getHeaderAuth(cdm))
            .then(async function (response:any) {


                if (response.data.info && response.data.info.isOk != 1) {
                        throw new Error(response.data.info.errInfo);

                }

                return response.data;

                /*} catch (e) {
                    logger.error(e);
                }*/

                //return response;
            }).catch((err: any) => {
                throw err;
            });

    }

    getAuditProgress = async (cdm:any, item:any)=>{
        let fd = new FormData();
        fd.append('apiId', 'getAuditProgress');

        if (item.alinkNos) {
            fd.append('alinkNoArray', item.alinkNos);
        }
        //fd.append('auditGroupNoArray', param.auditGroupNoArray );


        return await axios.post(cdm.data.url, fd, getHeaderAuth(cdm))
            .then(async function (response:any) {


                if (response.data.info && response.data.info.isOk != 1) {
                        throw new Error(response.data.info.errInfo);

                }
                return response.data.list;

            }).catch((err: any) => {
                throw err;
            });

    }

    /**
     * 진단 조회
     * @param cdm
     * @returns {Promise<T>}
     */
    getAuditListByAuditName = async (cdm: any, auditGroupList?: any) => {
        let fd = new FormData();
        fd.append('apiId', 'getAuditListByAuditName');

        if (auditGroupList && auditGroupList.length > 0) {
            fd.append('auditGroupNoArray', auditGroupList.map((e: { auditGroupNo: any; }) => e.auditGroupNo).join(','));
        }


        logger.info('[getAuditListByAuditName] 진단 조회 조회 요청', cdm.data);
        const that = this;
        return await axios.post(cdm.data.url, fd, getHeaderAuth(cdm))
            .then(async function (response: any) {

                logger.info('[getAuditListByAuditName] 진단 조회  조회 응답', response.data.info);

                try {

                    if (response.data.info && response.data.info.isOk != 1) {
                        throw new Error(response.data.info.errInfo);

                    }

                    //auditGroupNo, atemplateNo
                    // {{ 리스트 중복 제거? 왜 그런지 모름?????
                    const filteredList1 = _.uniqBy(response.data.list, 'auditGroupNo', 'atemplateNo', 'alinkNos');
                    // }}

                    // {{ SSR 프로젝트에 있으면 제외
                    const dbAuditoGroupNosTmp = await knex('tnPrjctSsr') // User is the type of row in database
                        .select('auditGroupNo')
                        .where('chckToolId', cdm.data.chckToolId);

                    //knex pg 에서 숫자형 필드도 문자로 리턴되어 숫자로 형변환... --;;;;
                    const dbAuditoGroupNos = dbAuditoGroupNosTmp.map((e: any) => {
                        return {'auditGroupNo': Number(e.auditGroupNo)}
                    });
                    // 현재 DB에 있는 프로젝트를 제외한다.
                    const filteredList = _.differenceBy(filteredList1, dbAuditoGroupNos, 'auditGroupNo');
                    // }}


                    for (const item of filteredList) {
                        const alinkNos1 = item.alinkNos;
                        const arrAlinkNo = alinkNos1.split(",");

                        let noAlinkNos = [];
                        for (const alinkNo of arrAlinkNo) {

                            let assetsId;
                            const isCheck = await knex('tnAssetsSsr') // User is the type of row in database
                                .select('assetsId')
                                .where('chckToolId', cdm.data.chckToolId)
                                .and
                                .where('alinkNo', alinkNo)
                                .first();

                            if (isCheck) {
                                assetsId = isCheck.assetsId;
                            } else {  // 존재하지 않으면 ????
                                noAlinkNos.push(alinkNo);
                            }

                            //noAlinkNos.push(alinkNo);

                            //item.startEpoch = getEpoch(item.startEpoch);
                            //item.endEpoch = getEpoch(item.endEpoch);
                            item.startDt = getEpoch(item.startEpoch);
                            item.endDt = getEpoch(item.endEpoch);
                            item.noAlinkNos = noAlinkNos;
                            item.toolNm = cdm.data.toolNm;
                            item.chckToolId = cdm.data.chckToolId;


                        }
                    }

                    response.data.list = filteredList;


                } catch (e) {

                    logger.error(e);
                }

                return response.data;

            }).catch((err: any) => {
                logger.error(err);
                throw err;
            });

    }

    /**
     *
     * @param cdm
     */
    getResultAuditList = async (cdm: any) => {

        const that = this;
        let res;

        const dbProcess = new DbProcess();

        const auditPrjct = await this.getAuditListByAuditName(cdm, cdm.data.parameter.auditGroupList);
        res = auditPrjct;
        logger.info('auditPrjct', auditPrjct);


        for (const item of auditPrjct.list) {

            const auditStatusTotal = await this.getAuditStatusTotal(cdm, item);

            //const resultAuditSummary = await this.getResultAuditSummary(cdm, item);

            const auditProgress = await this.getAuditProgress(cdm, item);

            const resResultAudit = await this.getResultAudit(cdm, item);
            //자산 상태 정리
            Ssr25Util.setAssetsChckSttusCd(auditStatusTotal.list[0], resResultAudit.data.list, auditProgress);



            try {

                // TODO 진단 결과 전체 트랜잭션
                await knex.transaction(async (trx: { rollback: any }) => {

                    //1) 프로젝트 생성
                    const prjctId = await dbProcess.insertProject(trx, cdm, item);

                    //2) TODO 자산이 추가된 경우 추가 
                    if (item.noAlinkNos && item.noAlinkNos.length > 0) {
                        logger.info('item.noAlinkNos : ', item.noAlinkNos);

                        //자산이 없으면 자산을 추가한다.
                        await that.getAssetInfo(cdm, {alinkNoArray: item.noAlinkNos.join(',')});
                    }

                    //3)  자산 매핑 등록
                    const alinkArr = item.alinkNos.split(',');

                    // 3-1) alinkNo로 assetsId 목록 조회
                    const assetsIdInfo = await knex('tnAssetsSsr')
                        .select('assetsId', 'alinkNo')
                        .where('chckToolId', cdm.data.chckToolId)
                        .and
                        .whereIn('alinkNo', alinkArr);


                    // 3-3) 프로젝트 자산 등록
                    for (const assetsInfo of assetsIdInfo) {

                        // @ts-ignore
                        const findAssetsInfo = auditStatusTotal.list[0].alinkInfoJsonArr.filter( e => e.alink_no == assetsInfo.alinkNo);

                        assetsInfo.chckSttusCd = findAssetsInfo[0].chckSttusCd;
                        assetsInfo.frstChckDt = findAssetsInfo[0].frstChckDt;
                        assetsInfo.clctYn = findAssetsInfo[0].clctYn;
                        assetsInfo.lstChckDt = findAssetsInfo[0].lstChckDt;
                        // 3-2) prjctAssetsMapngId 조회
                        await dbProcess.insertProjectAssetMapng(trx, prjctId, assetsInfo);

                    }


                    //4) 취약점 등록

                    for (const raItem of resResultAudit.data.list) {

                        await dbProcess.insertChckResult(trx, assetsIdInfo, raItem);

                    }


                });

            } catch (err: any) {
                logger.error(err);
                throw err;
            }
        }

        return res;
    }


    getResultAuditSummary = async (cdm:any, item:any) => {
        let fd = new FormData();
        fd.append('apiId', 'getResultAuditSummary');

        fd.append('atemplateNoArray', item.atemplateNo);
        fd.append('auditGroupNoArray', item.auditGroupNo);


        logger.info('[getResultAuditSummary] 진단 결과 조회 요약 요청', cdm.data);
        return await axios.post(cdm.data.url, fd, getHeaderAuth(cdm))
            .then(async function (response:any) {

                logger.info('[getResultAuditSummary] 진단 결과 조회 요약 응답', response.data.info);

                try {

                    if (response.data.info && response.data.info.isOk != 1) {
                        throw new Error(response.data.info.errInfo);
                    }

                    return response.data.list;

                } catch (e) {
                    logger.error(e);
                }



            }).catch((err: any) => {
                logger.error(err);
                throw err;
            });

    }


    /**
     * 진단 결과 수집
     * @param cdm
     * @returns {Promise<T>}
     */
    getResultAudit = async (cdm:any, item:any) => {
        let fd = new FormData();
        fd.append('apiId', 'getResultAudit');

        fd.append('auditGroupNo', item.auditGroupNo);
        //fd.append('alinkNoArray', cdm.data.alinkNoArray);
        //fd.append('atemplateNoArray', cdm.data.atemplateNoArray);
        //fd.append('limit', 1000); // 1000 건이 안넘는다고 가정함 템플릿이 1000건이 안넘으므로

        logger.info('[getResultAudit] 진단 결과 조회 요청', cdm.data);
        return await axios.post(cdm.data.url, fd, getHeaderAuth(cdm))
            .then(async function (response:any) {

                logger.info('[getResultAudit] 진단 결과 조회 응답', response.data.info);

               // try {

                    if (response.data.info && response.data.info.isOk != 1) {
                        throw new Error(response.data.info.errInfo);
                    }

               /* } catch (e) {

                    logger.error(e);
                }*/

                return response;

            }).catch((err: any) => {
                logger.error(err);
                throw err;
            });

    }

}