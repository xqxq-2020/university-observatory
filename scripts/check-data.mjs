import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>JSON.parse(readFileSync(new URL('../lib/data/'+p,import.meta.url),'utf8'));
const schools=read('universities.json'),evals=read('evaluation4.json'),map=read('china-map.json'),fifth=read('evidence5.json');
assert.equal(schools.length,147);assert.equal(new Set(schools.map(s=>s.name)).size,147);assert.equal(new Set(schools.map(s=>s.id)).size,147);
assert.equal(evals.length,95);assert.equal(evals.reduce((n,d)=>n+d.records.length,0),5112);
assert.equal(map.filter(p=>p.name).length,34);
for(const s of schools){assert.ok(map.some(p=>p.short===s.province),s.name+' province');assert.ok(Array.isArray(s.disciplines));assert.equal(new Set(s.disciplines).size,s.disciplines.length);if(s.website)assert.ok(/^https?:\/\//.test(s.website))}
for(const d of evals){assert.equal(new Set(d.records.map(r=>r[0])).size,d.records.length);for(const [,grade] of d.records)assert.match(grade,/^[ABC][+-]?$/)}
const cs=evals.find(d=>d.name==='计算机科学与技术');for(const name of ['北京大学','清华大学','浙江大学','国防科技大学'])assert.equal(cs.records.find(r=>r[0]===name)?.[1],'A+');
assert.equal(schools.find(s=>s.name==='浙江大学').disciplines.length,21);
assert.ok(map.find(p=>p.short==='黑龙江').y < map.find(p=>p.short==='海南').y,'map must be north-up');
assert.ok(map.find(p=>p.short==='新疆').x < map.find(p=>p.short==='上海').x,'map must be west-left');
for(const e of fifth){assert.ok(schools.some(s=>s.name===e.school));assert.ok(new URL(e.source).hostname.endsWith('.edu.cn'));assert.match(e.grade,/^[ABC][+-]?$/)}
console.log('PASS: 147 unique schools, 95 subjects, 5112 grades, 34 map regions, source and geography invariants.');
