import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir=await mkdtemp(join(tmpdir(),'jebi-csv-'));
const result=await build({stdin:{contents:`export * from './lib/export.js';export * from './lib/import.js';export {store} from './lib/store.js';`,resolveDir:resolve('.')},bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'storage-mock',setup(b){b.onResolve({filter:/store\.js$/},()=>({path:'store',namespace:'qa'}));b.onLoad({filter:/.*/,namespace:'qa'},()=>({contents:`export const store={writes:[],upsertYeon:async()=>({id:'new'}),addMaeum:async function(m){this.writes.push(m)}};`}));}}]});
const file=join(dir,'csv.mjs');await writeFile(file,result.outputFiles[0].text);
const {buildCsv,parseCsv,rowToDraft,importRows,isJebiCsv,store}=await import(pathToFileURL(file));
test.after(()=>rm(dir,{recursive:true,force:true}));
const people=[{id:'y1',name:'서현',relationTag:'회사'}];
const base={id:'m1',yeonId:'y1',direction:'받음',eventType:'결혼',amount:null,eventDate:'2026-10-04',plantedAt:new Date(2026,9,1,12,30).getTime()};
const rowsOf=m=>parseCsv(buildCsv(people,[{...base,...m}]).replace(/^\uFEFF/,''));

test('current and legacy transfer types survive CSV round trip',()=>{
 for(const assetKind of ['cash','goods','money','gift','help',null]){
  assert.equal(rowToDraft(rowsOf({assetKind})[1]).assetKind,assetKind);
 }
});
test('zero and unknown amount remain distinct; month-only and attendance survive',()=>{
 assert.equal(rowToDraft(rowsOf({amount:0})[1]).amount,0);
 assert.equal(rowToDraft(rowsOf({amount:null})[1]).amount,null);
 const d=rowToDraft(rowsOf({eventDate:'2026-10',datePrecision:'month',attendance:'unknown'})[1]);
 assert.equal(d.eventDate,'2026-10');assert.equal(d.datePrecision,'month');assert.equal(d.attendance,'unknown');
});
test('quoted punctuation and multiline memo survive',()=>{
 const memo='안부, "잘 지내요"\n다음에 만나요';
 assert.equal(rowToDraft(rowsOf({memo})[1]).memo,memo);
 assert.throws(()=>parseCsv('"unclosed'),/닫히지/);
});
test('negative, decimal, unsafe amounts and impossible dates are rejected, never repaired',()=>{
 for(const amount of ['-100','1.5','100원','2147483648','9,99']){const row=rowsOf({})[1];row[4]=amount;assert.equal(rowToDraft(row).skip,'bad');}
 for(const date of ['2026-02-30','2026-13','????-02-30']){const row=rowsOf({})[1];row[6]=date;assert.equal(rowToDraft(row).skip,'bad');}
 assert.equal(rowToDraft(rowsOf({eventDate:'????-02-29'})[1]).eventDate,'????-02-29');
});
test('legacy 12 columns accepted; unrecognized enums and extra columns rejected',()=>{
 const rows=rowsOf({});const old=rows.map(r=>r.slice(0,12));assert.ok(isJebiCsv(old));
 assert.ok(!isJebiCsv([rows[0].concat('extra')]));
 for(const [index,value] of [[2,'받은척'],[7,'25:00'],[12,'지금'],[13,'아마'],[14,'새 유형']]){const row=[...rows[1]];row[index]=value;assert.equal(rowToDraft(row).skip,'bad');}
});
test('restore invokes storage with actual types and repeated import skips duplicate',async()=>{
 store.writes=[];const rows=rowsOf({assetKind:'goods',amount:0,attendance:'attended'});
 const r=await importRows({yeons:people,maeums:[]},rows);assert.equal(r.added,1);assert.equal(store.writes[0].assetKind,'goods');assert.equal(store.writes[0].amount,0);
 const again=await importRows({yeons:people,maeums:store.writes},rows);assert.equal(again.skippedDup,1);
});

test('different gift types and care states are not silently deduplicated',async()=>{
 store.writes=[];
 const rows=parseCsv(buildCsv(people,[{...base,assetKind:'cash',amount:10000},{...base,id:'m2',assetKind:'goods',amount:10000}]).replace(/^\uFEFF/,''));
 const r=await importRows({yeons:people,maeums:[]},rows);assert.equal(r.added,2);assert.equal(r.skippedDup,0);
});
test('impossible recording timestamps and malformed reply timestamps are rejected',()=>{
 for(const [index,value] of [[10,'2026-02-30 12:00'],[10,'2026-10-01 24:00'],[11,'2026-10-01junk']]) {
  const row=rowsOf({})[1];row[index]=value;assert.equal(rowToDraft(row).skip,'bad');
 }
});
