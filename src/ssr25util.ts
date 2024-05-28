const _ = require("lodash");
import {getEpoch} from "./util";

const TYPE_CLASS = [
        //(1: Windows, 2: AIX, 4: HP-UX, 8: Linux, 16: Solaris)
        {type : 'OS', typeName: 'Windows', value: 1},
        {type : 'OS', typeName: 'AIX', value: 2},
        {type : 'OS', typeName: 'HP-UX', value: 4},
        {type : 'OS', typeName: 'Linux', value: 8},
        {type : 'OS', typeName: 'Solaris', value: 16},

        // (1: Apache, 2: IIS, 4: WebtoB, 8: OHS, 16: Tomcat, 32: WebLogic, 64: Jeus, 128: WebSphere, 256: JBoss, 1024: Iplanet)
        {type : 'WEB', typeName: 'Apache', value: 1},
        {type : 'WEB', typeName: 'IIS', value: 2},
        {type : 'WEB', typeName: 'WebtoB', value: 4},
        {type : 'WEB', typeName: 'OHS', value: 8},
        {type : 'WEB', typeName: 'Tomcat', value: 16},
        {type : 'WEB', typeName: 'WebLogic', value: 32},
        {type : 'WEB', typeName: 'Jeus', value: 64},
        {type : 'WEB', typeName: 'WebSphere', value: 128},
        {type : 'WEB', typeName: 'JBoss', value: 256},
        {type : 'WEB', typeName: 'Iplanet', value: 1024},

        // (1: Oracle, 2: MSSQL, 4: MySQL, 8: Sybase, 16: Tibero, 32: DB2, 64: PostgreSQL, 128: Altibase, 256: MariaDB, 512: Informix)
        {type : 'DB', typeName: 'Oracle', value:1},
        {type : 'DB', typeName: 'MSSQL', value:2},
        {type : 'DB', typeName: 'MySQL', value:4},
        {type : 'DB', typeName: 'Sybase', value:8},
        {type : 'DB', typeName: 'Tibero', value:16},
        {type : 'DB', typeName: 'DB2', value:32},
        {type : 'DB', typeName: 'PostgreSQL', value:64},
        {type : 'DB', typeName: 'Altibase', value:128},
        {type : 'DB', typeName: 'MariaDB', value:256},
        {type : 'DB', typeName: 'Informix', value:10241},

        //1: Cisco, 2: Juniper, 4: Alteon, 8: 3Com, 16: Alcatel, 32: Extreme, 64: Ffive
        {type : 'NETWORK', typeName: 'Cisco', value:1},
        {type : 'NETWORK', typeName: 'Juniper', value:2},
        {type : 'NETWORK', typeName: 'Alteon', value:4},
        {type : 'NETWORK', typeName: '3Com', value:8},
        {type : 'NETWORK', typeName: 'Alcatel', value:16},
        {type : 'NETWORK', typeName: 'Extreme', value:32},
        {type : 'NETWORK', typeName: 'Ffive', value:64},

        //(1: AWS, 2: Azure, 4: GCP, 8: CloudZ)
        {type : 'Cloud', typeName: 'AWS', value:1},
        {type : 'Cloud', typeName: 'Azure', value:2},
        {type : 'Cloud', typeName: 'GCP', value:4},
        {type : 'Cloud', typeName: 'CloudZ', value:8},

        // (1: RHEV, 2: Kubernetes, 4: OpenStack, 8: Hadoop, 16: Docker)
        {type : 'Application', typeName: 'RHEV', value:1},
        {type : 'Application', typeName: 'Kubernetes', value:2},
        {type : 'Application', typeName: 'OpenStack', value:4},
        {type : 'Application', typeName: 'Hadoop', value:8},
        {type : 'Application', typeName: 'Docker', value:16},

        // (1: ESXi, 2: Xen)
        {type : 'Hypervisor', typeName: 'ESXi', value:1},
        {type : 'Hypervisor', typeName: 'Xen', value:2}

    ];

export class Ssr25Util {



    constructor() {

    }

    /**
     * 자산 상태 정리
     * @param auditStatusTotal
     * @param resResultAudit
     * @param auditProgress
     */
    static setAssetsChckSttusCd = (auditStatusTotal:any, resResultAudit:any, auditProgress:any)=>{

        auditStatusTotal.alinkInfoJsonArr = JSON.parse(auditStatusTotal.alinkInfo);

        const gatherDoneAlinkNosArr = auditStatusTotal.gatherDoneAlinkNos != null ?  auditStatusTotal.gatherDoneAlinkNos.split(',') : [];

        const notAuditableAlinkNosArr = auditStatusTotal.notAuditableAlinkNos != null ?  auditStatusTotal.notAuditableAlinkNos.split(',') : [];
        const reportDoneAlinkNosArr = auditStatusTotal.reportDoneAlinkNos != null ?  auditStatusTotal.reportDoneAlinkNos.split(',') : [];



        // @ts-ignore
        const failCount = resResultAudit.filter( e=> e.decision === 'FAIL').length;

        for(let alinkItemInfo of auditStatusTotal.alinkInfoJsonArr){

            //수집 여부 확인
            if(gatherDoneAlinkNosArr.includes(alinkItemInfo.alink_no)) {
                alinkItemInfo.clctYn = 'Y';
            }else{
                alinkItemInfo.clctYn = 'N';
            }



            //@ts-ignore
            const fltAuditProgress = auditProgress.filter(e => e.alinkNo == alinkItemInfo.alink_no);

            if(fltAuditProgress.length > 0) {
                //최초 작업일시
                //@ts-ignore
                alinkItemInfo.frstChckDt = getEpoch(_.minBy(fltAuditProgress, function (o) {
                    return Number(o.startEpoch)
                }).startEpoch);

                //마지막 작업일시
                //@ts-ignore
                alinkItemInfo.lstChckDt = getEpoch(_.maxBy(fltAuditProgress, function (o) {
                    return Number(o.endEpoch)
                }).endEpoch);
            }


            if(notAuditableAlinkNosArr.includes(alinkItemInfo.alink_no)) {
                alinkItemInfo.chckSttusCd = 'CHCK_FAIL';
                continue;
            }

            const isReportDoneAlinkNo=  reportDoneAlinkNosArr.includes(alinkItemInfo.alink_no.toString());

            if(alinkItemInfo.audit_done == 1 && isReportDoneAlinkNo) {
                alinkItemInfo.chckSttusCd = 'CHCK_COMPT';
            }else if(alinkItemInfo.audit_done == 1 && !isReportDoneAlinkNo) {
                alinkItemInfo.chckSttusCd = 'CHCK_FAIL';
            }else if([4,5,6,7,9].includes(alinkItemInfo.audit_done)){
                alinkItemInfo.chckSttusCd = 'CHCK_FAIL';
            }else if([11,12,13].includes(alinkItemInfo.audit_done)){
                alinkItemInfo.chckSttusCd = 'CHCK_PROGS';
            }else{
                alinkItemInfo.chckSttusCd = 'CHCK_FAIL';
            }

            if(alinkItemInfo.chckSttusCd =='CHCK_COMPT' && failCount == 0){
                alinkItemInfo.chckSttusCd = 'COMPT';
            }

        }

    }

    static getUserLevelToCvmsLevel(level:number){
        return level + 1;
    }


    /**
     * TYPE_CLASS 배열에서 코드값을 가지고 검색
     */

    private static getTypeCheck(bitOrValue:number, type:string){

        const find = TYPE_CLASS.filter((e: any) => e.type === type && e.value == bitOrValue);
        if(find.length > 0) {
            return {'typeClass': type, 'typeNames': find[0].typeName};

        }else{
            return {'typeClass': type, 'typeNames': bitOrValue};

        }
    }

    /**
     * 진단기준의 typeClass와 typeNames를 읽어 온다.
     * @param item
     */
    static getType(item:any){

        if(item.ssOsType & item.ssOsTypeAll){
           const bitOrValue = item.ssOsType & item.ssOsTypeAll;
            if(bitOrValue === 0)
                return {'typeClass': null, 'typeNames': null};
            else {
                return this.getTypeCheck(bitOrValue, 'OS');
            }

        }else if(item.ssWebType & item.ssWebTypeAll){

            const bitOrValue = item.ssWebType & item.ssWebTypeAll;
            if(bitOrValue === 0)
                return {'typeClass': null, 'typeNames': null};
            else {
                return this.getTypeCheck(bitOrValue, 'WEB');
            }

        }else if(item.ssDbType & item.ssDbTypeAll){

            const bitOrValue = item.ssDbType & item.ssDbTypeAll;
            if(bitOrValue === 0)
                return {'typeClass': null, 'typeNames': null};
            else {
                return this.getTypeCheck(bitOrValue, 'DB');
            }

        }else if(item.ssCloudType & item.ssCloudTypeAll){

            const bitOrValue = item.ssCloudType & item.ssCloudTypeAll;
            if(bitOrValue === 0)
                return {'typeClass': null, 'typeNames': null};
            else {
                return this.getTypeCheck(bitOrValue, 'Cloud');
            }

        }else if(item.ssNetworkType & item.ssNetworkTypeAll){

            const bitOrValue = item.ssNetworkType & item.ssNetworkTypeAll;
            if(bitOrValue === 0)
                return {'typeClass': null, 'typeNames': null};
            else {
                return this.getTypeCheck(bitOrValue, 'NETWORK');
            }

        }else if(item.ssApplicationType & item.ssApplicationTypeAll){

            const bitOrValue = item.ssApplicationType & item.ssApplicationTypeAll;
            if(bitOrValue === 0)
                return {'typeClass': null, 'typeNames': null};
            else {
                return this.getTypeCheck(bitOrValue, 'Application');
            }

        }else if(item.ssHypervisorType & item.ssHypervisorTypeAll){

            const bitOrValue = item.ssHypervisorType & item.ssHypervisorTypeAll;
            if(bitOrValue === 0)
                return {'typeClass': null, 'typeNames': null};
            else {
                return this.getTypeCheck(bitOrValue, 'Hypervisor');
            }
        }else{
            return {'typeClass': null, 'typeNames': null};
        }
    }


}


