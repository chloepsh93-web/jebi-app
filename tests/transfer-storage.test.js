import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir=await mkdtemp(join(tmpdir(),'jebi-transfer-'));
const built=await build({stdin:{contents:`export {store} from './lib/store.js';export {supabase} from './lib/supabase.js';`,resolveDir:resolve('.')},bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'mock',setup(b){b.onResolve({filter:/supabase\.js$/},()=>({path:'mock',namespace:'qa'}));b.onLoad({filter:/.*/,namespace:'qa'},()=>({contents:`export const supabase={calls:[],from(){return {upsert(row){supabase.calls.push(row);return {select(){return {single:async()=>({data:null,error:{code:'PGRST204',message:"Could not find the asset_kind column"}})}}}}}}};export const ensureUser=async()=> 'qa-user';`}));}}]});
const file=join(dir,'store.mjs');await writeFile(file,built.outputFiles[0].text);
const {store,supabase}=await import(pathToFileURL(file));test.after(()=>rm(dir,{recursive:true,force:true}));
test('unknown-value gift cannot silently become a schedule when asset column is absent',async()=>{
 const gift={id:'qa',yeonId:'qa-person',assetKind:'goods',amount:null,direction:'받음'};
 await assert.rejects(store.addMaeum(gift),/전달 방식 컬럼/);
 assert.equal(supabase.calls.length,1);assert.equal(supabase.calls[0].asset_kind,'goods');
 await assert.rejects(store.addMaeum(gift),/전달 방식 컬럼/);
 assert.equal(supabase.calls.length,1);
});
