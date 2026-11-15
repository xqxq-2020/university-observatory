import assert from 'node:assert/strict';
import {build} from 'esbuild';
const result=await build({entryPoints:['app/api/live/route.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {GET}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
const nativeFetch=globalThis.fetch;let calls=[];
try{
 globalThis.fetch=async url=>{calls.push(String(url));throw Error('No request should be made')};
 assert.equal((await GET(new Request('https://test.invalid/api/live?school=https://evil.invalid'))).status,400);assert.equal(calls.length,0);
 globalThis.fetch=async url=>{calls.push(String(url));return new Response('User-agent: *\nDisallow: /')};
 const blocked=await (await GET(new Request('https://test.invalid/api/live?school=u002'))).json();assert.equal(blocked.status,'blocked');assert.equal(calls.length,1);assert.ok(calls[0].endsWith('/robots.txt'));
 calls=[];globalThis.fetch=async url=>{calls.push(String(url));if(String(url).endsWith('/robots.txt'))return new Response('',{status:404});return {ok:true,status:200,url:String(url),headers:new Headers({'content-type':'text/html;charset=utf-8'}),body:new Response(`<ul><li><a href="/news/ttxw.htm">头条新闻 Headlines</a></li><li><span>2026-11-14</span><a href="/info/1182/129311.htm">清华大学研究团队发布新的科学研究成果</a></li><li><a href="https://evil.invalid/info/123/456789.htm">不应收录的外部来源信息这是测试标题</a></li></ul>`).body}};
 const first=await (await GET(new Request('https://test.invalid/api/live?school=u006'))).json();assert.equal(first.status,'ok');assert.equal(first.items.length,1);assert.equal(first.items[0].publishedAt,'2026-11-14');assert.ok(first.items[0].url.startsWith('https://www.buaa.edu.cn/'));
 const before=calls.length;const cached=await (await GET(new Request('https://test.invalid/api/live?school=u006'))).json();assert.equal(cached.cached,true);assert.equal(calls.length,before);
 console.log('PASS: source allowlist, robots exclusion, article filtering, source-domain isolation, explicit dates, and cache reuse.');
} finally{globalThis.fetch=nativeFetch}
