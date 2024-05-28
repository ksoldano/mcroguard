import {getAgentSttus, getAssetsKnd, getAssetsTypeCd, getDecision, getEpoch, getHeaderAuth} from "./util";

//const FormData = require("form-data");
//const axios = require("axios");
const _ = require("lodash");
const logger = require('log4js').getLogger('cvmsSsrApi');
//const cvmsConfig = require("./config/cvms.config.js");

// @ts-ignore
//const {getHeaderAuth, getEpoch, getAgentSttus, getAssetsTypeCd, getAssetsKnd, getUrl} = require("./util.js");

//const dbConfig = require("./config/db.config.js");
/*const dbConfigDev = require("./config/db.config.js");
const dbConfigReal = require("./config/db.config.real.js");

const dbConfig = process.env.NODE_ENV === 'local' ? dbConfigDev: dbConfigReal;*/

const modulePath = "./config/db.config." + process.env.NODE_ENV + ".js";
const dbConfig = require(modulePath);

const {knexSnakeCaseMappers} = require('objection');
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


export class DbProcess {

    constructor() {

    }

    insertSsrAssets25 = async (trx: any, item: any, cdm: any) => {

        try {
            let insertAssetsItem;
            let updateAssetsItem;
            const nowAgentSttus = new Date();
            let assetsId;
            const isCheck = await knex('tnAssetsSsr') // User is the type of row in database
                .select('assetsId')
                .where('chckToolId', cdm.data.chckToolId)
                .and
                .where('alinkNo', item.alinkNo)
                .and
                .where('assetNo', item.assetNo)
                .first();

            if (isCheck) {
                assetsId = isCheck.assetsId;
            } else {
                const result = await knex.select(knex.raw("'AST' || TO_CHAR(NOW(),'YYYYMMDD') || LPAD(NEXTVAL('SEQ_TN_ASSETS')::TEXT,10,'0') as id")).first();
                assetsId = result.id;
            }

            //자산 상태 체크
            const agentSttusCd = getAgentSttus(nowAgentSttus, item.lastPingEpoch, item.connectionInterval);

            insertAssetsItem = {
                assetsId: assetsId,
                chckToolId: cdm.data.chckToolId,
                assetsSeCd: 'SYS',
                registId: -1,
                newYn: 'N',
                assetsTyCd: getAssetsTypeCd(item.typeClass),
                assetsKnd: getAssetsKnd(item),
                indcDt: getEpoch(item.assetRegEpoch),
                agentSttusCd: agentSttusCd,
                hostNm: item.hostname,
                reprsntIp: item.ip,
                allIp: {"allIp": item.ipAll},
                kndDetail: item.osDetail,
                alinkNo: item.alinkNo,
                assetNo: item.assetNo

            }

            updateAssetsItem = {
                chckToolId: cdm.data.chckToolId,
                changeId: -1,
                assetsTyCd: getAssetsTypeCd(item.typeClass),
                assetsKnd: getAssetsKnd(item),
                indcDt: getEpoch(item.assetRegEpoch),
                agentSttusCd: agentSttusCd,
                hostNm: item.hostname,
                reprsntIp: item.ip,
                allIp: {"allIp": item.ipAll},
                kndDetail: item.osDetail,
                alinkNo: item.alinkNo,
                assetNo: item.assetNo,
                changeDt: knex.fn.now()

            }

            await knex('tnAssetsSsr')
                .insert(insertAssetsItem)
                .onConflict(['assetsId'])
                .merge(updateAssetsItem)
                .transacting(trx);

            logger.info('TnAssetsSsr insert  : ', insertAssetsItem);

            return assetsId;
        }catch(e){
            logger.error(e);
            throw e;
        }
    }

    insertAssetsGroupMapng = async (trx: any, assetsId: any, groupId: any) => {
        const insertAssetsGroup = {
            assetsId: assetsId,
            groupId: groupId,
            registId: -1,
            changeId: -1,
            registDt: knex.fn.now(),
            changeDt: knex.fn.now()
        }

        await knex('tnAssetsGroupMapng')
            .insert(insertAssetsGroup)
            .onConflict([/*'assetsGroupMapngId',*/'assetsId', 'groupId'])
            .merge({'changeDt': knex.fn.now()})
            .transacting(trx);

        logger.info('tnAssetsGroupMapng insert  : ', insertAssetsGroup);
    }

    insertAssetsChargerMapng = async (trx: any, assetsId: any, uid: any) => {
        let assetsChargerMapngId;
        const isCheckB = await knex('tnAssetsChargerMapng') // User is the type of row in database
            .select('assetsChargerMapngId')
            .where('assetsId', assetsId)
            .and
            .where('userId', uid.id ? Number(uid.id) : null)
            .first();

        if (isCheckB) {
            assetsChargerMapngId = isCheckB.assetsChargerMapngId;
        } else {
            const result = await knex.select(knex.raw("'AST' || TO_CHAR(NOW(),'YYYYMMDD') || LPAD(NEXTVAL('SEQ_TN_ASSETS')::TEXT,10,'0') as id")).first();
            assetsChargerMapngId = result.id;
        }

        const assetsChargerMapngItem = {
            assetsChargerMapngId: assetsChargerMapngId,
            assetsId: assetsId,
            chargerSeCd: 'CHARGER',
            userId: uid.id ? Number(uid.id) : null,
            registId: -1,
            registDt: knex.fn.now()
        }
        await knex('tnAssetsChargerMapng').insert(assetsChargerMapngItem)
            .onConflict(['assetsChargerMapngId'])
            .merge({'changeDt': knex.fn.now(), 'userId': uid.id ? Number(uid.id) : null})
            .transacting(trx);

        logger.info('tnAssetsChargerMapng insert  : ', assetsChargerMapngItem);
    }

    insertProject = async (trx: any, cdm: any, item:any)=>{
        //1) 프로젝트 생성
                    let prjctId;
                    const isCheck = await knex('tnPrjctSsr') // User is the type of row in database
                        .select('prjctId')
                        .where('chckToolId', cdm.data.chckToolId)
                        .and
                        .where('auditGroupNo', item.auditGroupNo)
                        .first();

                    if (isCheck) {
                        prjctId = isCheck.prjctId;
                    } else {
                        const result = await knex.select(knex.raw("'PRJ' || TO_CHAR(NOW(),'YYYYMMDD') || LPAD(NEXTVAL('SEQ_TN_PRJCT')::TEXT,10,'0') as id")).first();
                        prjctId = result.id;
                    }

                    const insertPrjct = {
                        prjctId: prjctId,
                        chckToolId: cdm.data.chckToolId,
                        chckKndPrjctCd: 'SS',
                        prjctNm: item.auditName,
                        chckSumry: item.groupName,
                        chckBeginDt : getEpoch(item.startEpoch),
                        chckEndDt : getEpoch(item.endEpoch),
                        registId: -1,
                        registDt : getEpoch(item.regEpoch),
                        chckItemId : item.atemplateNo,
                        /*chckSetupCd: ,
                        chckCycleCd: ,
                        chckSeCd: ,
                        excPlace: ,*/
                        //: item.nowCreateReport,
                        chckSeCd : 'RGLR_CHCK',
                        prjProgrsSttusCd : 'MANAGT',
                        managtTrnsferYn : 'N',
                        auditGroupNo : item.auditGroupNo

                    }

                    const updatePrjct = {
                        changeDt: knex.fn.now()

                    }

                    await knex('tnPrjctSsr')
                        .insert(insertPrjct)
                        .onConflict(['prjctId'])
                        .merge(updatePrjct)
                        .transacting(trx);

                    logger.info('TnPrjctSsr insert  : ', insertPrjct);
                    return prjctId;
    }

    insertProjectAssetMapng = async (trx: any, prjctId: any, assetsInfo:any) =>{
        let prjctAssetsMapngId;
                        const isPrjctAssetsMapngIdCheck = await knex('tnPrjctAssetsMapng') // User is the type of row in database
                            .select('prjctAssetsMapngId')
                            .where('prjctId', prjctId)
                            .first();

                        if (isPrjctAssetsMapngIdCheck) {
                            prjctAssetsMapngId = isPrjctAssetsMapngIdCheck.prjctAssetsMapngId;
                        } else {
                            const result = await knex.select(knex.raw("'PAM' || TO_CHAR(NOW(),'YYYYMMDD') || LPAD(NEXTVAL('SEQ_TN_PRJCT_ASSETS_MAPNG')::TEXT,10,'0') as id")).first();
                            prjctAssetsMapngId = result.id;
                        }

                        const insertPrjctAssetsMapng = {
                            prjctId : prjctId,
                            assetsId : assetsInfo.assetsId,
                            registId : -1,
                            registDt : knex.fn.now(),
                            changeId : -1,
                            changeDt : knex.fn.now(),
                            prjctAssetsMapngId : prjctAssetsMapngId,
                            chckSttusCd : assetsInfo.chckSttusCd, //'CHCK_COMPT', /*--ChckSttusCd,*/
                            //chckTrgetYn : ChckTrgetYn,
                            clctYn : assetsInfo.clctYn,     //수집 여부
                            frstChckDt : assetsInfo.frstChckDt,
                            lstChckDt : assetsInfo.lstChckDt
                        }

                        assetsInfo.tempPrjctAssetMappingInfo = {prjctAssetsMapngId:prjctAssetsMapngId, assetsId:assetsInfo.assetsId, alinkNo: assetsInfo.alinkNo};

                        const updatePrjctAssetsMapng = {
                            changeDt: knex.fn.now()

                        }

                        await knex('tnPrjctAssetsMapng')
                            .insert(insertPrjctAssetsMapng)
                            .onConflict(['prjctAssetsMapngId'])
                            .merge(updatePrjctAssetsMapng)
                            .transacting(trx);

                            logger.info('TnPrjctAssetsMapng insert  : ', insertPrjctAssetsMapng);
    }

    insertChckResult = async (trx: any, assetsIdInfo:any, raItem: any) =>{

        const findPrjctAssetInfo = assetsIdInfo.filter( (e: { alinkNo: any; }) => e.alinkNo == raItem.alinkNo);

        if(findPrjctAssetInfo.length === 0)
            return;

                        const insertResultAudit = {
                            //chckResultId: raItem.chckResultId,
                            lastChckResultCd: getDecision(raItem.decision),
                            chckItemId: raItem.itemCode,
                            prjctAssetsMapngId: findPrjctAssetInfo[0].tempPrjctAssetMappingInfo.prjctAssetsMapngId,
                            registSeCd: 'CHCK_FRST', //CHCK_MGRT  *registSeCd,*/
                            chckSumry: raItem.status,
                            tme: 1,
                            managtPlanDt: raItem.fixToDate,
                            //managtDt: raItem.managtDt,
                            managtYn: 'N',
                            registId: -1,
                            registDt: knex.fn.now(),
                            changeId: -1,
                            changeDt: knex.fn.now(),
                            orginlChckResultCd: getDecision(raItem.decision),
                            progrsSttusCd: raItem.progrsSttusCd
                        }
                        //진단 결과 입력

                        const updateResultAudit = {
                            changeDt: knex.fn.now()

                        }

                        logger.info('TnChckResult insert A : ', insertResultAudit);

                        await knex('tnChckResult')
                            .insert(insertResultAudit)
                            .onConflict(['chckResultId'])
                            .merge(updateResultAudit)
                            .transacting(trx);


                        logger.info('TnChckResult insert  : ', insertResultAudit);

                        logger.info('getResultAudit', raItem);
    }
}