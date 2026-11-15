import snapshots from '@/lib/data/news-snapshots.json';
import { universities, newsSources, newsSourceLabels, type LiveResult, type LiveItem } from '@/lib/catalog';
const TTL=15*60*1000;
const pending=new Map<string,Promise<LiveResult>>();
const local=new Map<string,LiveResult>(Object.entries(snapshots) as [string,LiveResult][]);
const clean=(s:string)=>s.replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/\s+/g,' ').trim();
function allowed(robots:string,path:string){
 let active=false, rules:{path:string;allow:boolean}[]=[];
 for(const raw of robots.split('\n')){const line=raw.split('#')[0].trim();const m=line.match(/^([^:]+):\s*(.*)$/);if(!m)continue;const k=m[1].toLowerCase(),v=m[2].trim();if(k==='user-agent') active=v==='*'||v.toLowerCase().includes('xueyuobserver');else if(active&&['allow','disallow'].includes(k)&&v)rules.push({path:v,allow:k==='allow'});}
 const matches=rules.filter(r=>{const pattern='^'+r.path.replace(/[.+?^{}()|[\]\\]/g,'\\$&').replace(/\*/g,'.*');try{return new RegExp(pattern).test(path)}catch{return path.startsWith(r.path)}}).sort((a,b)=>b.path.length-a.path.length||Number(b.allow)-Number(a.allow));return !matches.length||matches[0].allow;
}
async function getPage(url:string){
 const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),12000);
 try {const r=await fetch(url,{headers:{'User-Agent':'XueyuObserver/1.0 (public university news, 15-minute cache)','Accept':'text/html,application/xhtml+xml,text/plain;q=0.8'},signal:controller.signal,redirect:'follow'});if(!r.ok)return {ok:false,status:r.status,text:'',url:r.url};if(Number(r.headers.get('content-length')||0)>1500000)throw Error('页面超过抓取上限');const reader=r.body?.getReader();if(!reader)return {ok:false,status:502,text:'',url:r.url};let size=0;const chunks:Uint8Array[]=[];while(true){const n=await reader.read();if(n.done)break;size+=n.value.length;if(size>1500000){await reader.cancel();throw Error('页面超过抓取上限')}chunks.push(n.value)}const bytes=new Uint8Array(size);let off=0;chunks.forEach(c=>{bytes.set(c,off);off+=c.length});const head=new TextDecoder().decode(bytes.slice(0,6000));const charset=/charset\s*=\s*["']?(gb2312|gbk|gb18030)/i.test((r.headers.get('content-type')||'')+head)?'gb18030':'utf-8';return {ok:true,status:r.status,text:new TextDecoder(charset).decode(bytes),url:r.url};}finally{clearTimeout(timer)}
}
function extract(html:string,base:string):LiveItem[]{
 const body=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'');
 const items:LiveItem[]=[];const seen=new Set<string>();const host=new URL(base).hostname.split('.').slice(-3).join('.');
 for(const m of body.matchAll(/<a\b([^>]*?)>([\s\S]*?)<\/a>/gi)){
 const href=m[1].match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];if(!href||/^(javascript|mailto|tel|#)/i.test(href))continue;
 const attr=m[1].match(/\btitle\s*=\s*["']([^"']+)["']/i)?.[1];const childTitle=m[2].match(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1]||m[2].match(/<(?:div|span|p)\b[^>]*class=["'][^"']*\b(?:title|tit|news-title|news_title)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|span|p)>/i)?.[1];const title=clean(attr||childTitle||m[2]).replace(/\s*20\d{2}[.\/-]\d{1,2}[.\/-]\d{1,2}\s*$/,'');if(title.length<12||title.length>150||!/[\u4e00-\u9fff]/.test(title))continue;
 let url:URL;try{url=new URL(href.replace(/&amp;/g,'&'),base)}catch{continue}if(!['https:','http:'].includes(url.protocol)||!url.hostname.endsWith(host))continue;
 if(!/(\/info\/\d+\/\d+\.htm|\/20\d{2}\/|\/[\da-f]{8,}\.html?|\/\d{4,}\.html?|[?&](id|newsid|wbnewsid)=\d{4,}|\/(article|content)\/\d+)/i.test(url.href)||/登录|隐私|版权所有|系统入口|ICP备|网上服务|信息公开指南/.test(title))continue;
 if(seen.has(url.href)||items.some(x=>x.title===title))continue;seen.add(url.href);
 // Only accept an explicit date inside the same surrounding list item.
 const i=m.index||0;const liStart=body.lastIndexOf('<li',i),liEnd=body.indexOf('</li>',i);const nearby=liStart>=0&&liEnd>i&&liEnd-liStart<3000?body.slice(liStart,liEnd):m[0];
 const date=nearby.match(/(20\d{2})[年.\/-](\d{1,2})[月.\/-](\d{1,2})/);
 const publishedAt=date?`${date[1]}-${date[2].padStart(2,'0')}-${date[3].padStart(2,'0')}`:null;
 const category=/招生|研招|报考|硕士|博士|录取/.test(title)?'招生信息':/就业|招聘|双选|宣讲/.test(title)?'就业动态':/研究|科学|成果|实验室|学科|论文/.test(title)?'学术进展':'校园动态';
 items.push({title,url:url.href,publishedAt,category});if(items.length===12)break;
 }return items;
}
async function crawl(school:typeof universities[number]):Promise<LiveResult>{
 const source=newsSources[school.name]||school.website;const result:LiveResult={school:school.name,sourceLabel:newsSourceLabels[school.name]||school.name+'官网',source:source||null,status:'unconfigured',fetchedAt:new Date().toISOString(),items:[],message:'暂未配置可核验官网'};if(!source)return result;
 try{const robots=await getPage(new URL('/robots.txt',source).href);if(robots.ok&&!allowed(robots.text,new URL(source).pathname))return {...result,status:'blocked',message:'来源 robots.txt 不允许抓取，请访问官网'};if(!robots.ok&&robots.status!==404&&robots.status!==410)return {...result,status:'blocked',message:`访问策略未能确认（HTTP ${robots.status}），请访问官网`};
 const page=await getPage(source);if(!page.ok)return {...result,status:'blocked',message:`官网暂不可抓取（HTTP ${page.status}），请查看原站`};if(!/\.(edu\.cn|ac\.cn)$/.test(new URL(page.url).hostname))return {...result,status:'blocked',message:'官网跳转至未核验域名，本次未读取'};
 const items=extract(page.text,page.url);return {...result,status:items.length?'ok':'empty',source:page.url,items,message:items.length?'官网公开标题已同步':'官网可访问，未识别到文章列表；请查看原站'};
 }catch{return {...result,status:'error',message:'官网访问超时或暂不可用，稍后重试'}}
}
export async function GET(request:Request){
 const id=new URL(request.url).searchParams.get('school');const school=universities.find(s=>s.id===id);if(!school)return Response.json({error:'未知高校'}, {status:400});
 const key=new Request(new URL('/__monitor_cache/'+school.id,new URL(request.url).origin));let cache:Cache|undefined;try{cache=await caches.open('xueyu-news-v1')}catch{}
 let previous=local.get(school.id);if(!previous&&cache){try{const stored=await cache.match(key);if(stored)previous=await stored.json() as LiveResult}catch{}}
 if(previous&&Date.now()-Date.parse(previous.fetchedAt)<TTL)return Response.json({...previous,cached:true},{headers:{'Cache-Control':'no-store'}});
 if(!pending.has(school.id))pending.set(school.id,crawl(school));let result:LiveResult;
 try{result=await pending.get(school.id)!}finally{pending.delete(school.id)}
 if(result.status!=='ok'&&previous?.status==='ok'){result={...previous,stale:true,cached:true,message:'本次同步失败，保留上次成功快照；'+result.message};}else{local.set(school.id,result);if(cache)try{await cache.put(key,Response.json(result,{headers:{'Cache-Control':'max-age=86400'}}))}catch{}}
 return Response.json(result,{headers:{'Cache-Control':'no-store'}});
}
