import schools from './data/universities.json';
import rawEvaluations from './data/evaluation4.json';
import fifth from './data/evidence5.json';
import jobs from './data/employment.json';
export type School = {id:string;name:string;province:string;city:string;website:string|null;disciplines:string[]};
export const universities:School[] = schools;
export const evaluations = rawEvaluations;
export type Fifth = {school:string;discipline:string;grade:string;source:string;title:string;date?:string};
export type Employment = {school:string;url:string;title:string;year?:string};
export const evidence5 = fifth as Fifth[];
export const employment = jobs as Employment[];
export const sources = {
 dfc:'https://www.moe.gov.cn/srcsite/A22/s7065/202202/t20220211_598710.html',
 dfcPdf:'https://www.moe.gov.cn/srcsite/a22/s7065/202202/w020220214318455516037.pdf',
 evaluation:'https://www.cdgdc.edu.cn/dslxkpgjggb/',
 evaluationPdf:'https://webs.nuist.edu.cn/_upload/article/files/80/8e/30a7ae4d44bdb2f50a675e7f05d9/87813fa7-5920-4b3d-acf2-d359edfe7497.pdf',
 fifth:'https://www.moe.gov.cn/jyb_xwfb/moe_1946/fj_2020/202011/t20201102_497819.html',
 newRound:'https://www.moe.gov.cn/jyb_zzjg/huodong/202601/t20260108_1426054.html',
 map:'https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json'
};
export const normalize = (name:string) => name.replace('上海体育大学','上海体育学院').replace('海军军医大学','第二军医大学').replace('空军军医大学','第四军医大学');
export const jointAssessmentSchools=['中国矿业大学','中国矿业大学（北京）','中国地质大学（北京）','中国地质大学（武汉）','中国石油大学（北京）','中国石油大学（华东）'];
export function schoolGrades(school:string){if(jointAssessmentSchools.includes(school))return [];return evaluations.flatMap(d=>{const record=d.records.find(r=>normalize(r[0])===normalize(school));return record?[{name:d.name,code:d.code,grade:record[1]}]:[]}).sort((a,b)=>gradeValue(b.grade)-gradeValue(a.grade));}
export function gradeValue(grade:string){return ({'A+':100,'A':90,'A-':80,'B+':70,'B':60,'B-':50,'C+':40,'C':30,'C-':20} as Record<string,number>)[grade]||0;}
export const disciplineCoverage=Object.entries(universities.reduce((acc,s)=>{s.disciplines.filter(d=>!d.includes('自主')).forEach(d=>(acc[d]??=[]).push(s.id));return acc},{} as Record<string,string[]>)).map(([name,ids])=>({name,ids,count:ids.length})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'zh'));
export const newsSources:Record<string,string> = {
 '浙江大学':'https://ugrs.zju.edu.cn/',
 '清华大学':'https://www.tsinghua.edu.cn/',
 '北京大学':'https://news.pku.edu.cn/',
 '复旦大学':'https://www.fudan.edu.cn/',
 '上海交通大学':'https://news.sjtu.edu.cn/',
 '南京大学':'https://www.nju.edu.cn/',
 '武汉大学':'https://www.whu.edu.cn/',
 '中国科学技术大学':'https://news.ustc.edu.cn/',
 '哈尔滨工业大学':'https://www.hit.edu.cn/',
 '西安交通大学':'https://www.xjtu.edu.cn/',
};
export type LiveItem={title:string;url:string;publishedAt:string|null;category:string};
export const newsSourceLabels:Record<string,string>={'浙江大学':'浙江大学本科生院'};
export type LiveResult={school:string;sourceLabel?:string;source:string|null;status:'ok'|'empty'|'blocked'|'error'|'unconfigured';fetchedAt:string;items:LiveItem[];message:string;cached?:boolean;stale?:boolean};
