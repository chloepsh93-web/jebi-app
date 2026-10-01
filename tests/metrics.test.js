import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = await mkdtemp(join(tmpdir(), 'jebi-metrics-'));
const result = await build({stdin:{contents:`export * from './lib/metrics.js'; export {supabase} from './lib/supabase.js';`,resolveDir:resolve('.')},bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'mock',setup(b){b.onResolve({filter:/supabase\.js$/},()=>({path:'mock',namespace:'qa'}));b.onLoad({filter:/.*/,namespace:'qa'},()=>({contents:`export const supabase={rows:[],from(){return {insert:async(row)=>{supabase.rows.push(row);return {error:null}}}}};export async function ensureUser(){return 'qa-user'}` }));}}]});
const file=join(dir,'metrics.mjs');await writeFile(file,result.outputFiles[0].text);
const {sanitizeProps,logEvent,supabase}=await import(pathToFileURL(file));
test.after(()=>rm(dir,{recursive:true,force:true}));
test('unknown keys and free text cannot escape through telemetry props',()=>{
 assert.deepEqual(sanitizeProps({empty:true,name:'Private',ref:'Private',kind:'Private',screen_id:'Private',details:{email:'Private'}}),{empty:true});
 assert.deepEqual(sanitizeProps({empty:'Private'}),{});
});
test('telemetry enforces screen and common fields; unknown events are ignored',async()=>{
 await logEvent('occasion_saved',{is_demo:true,app_version:'spoof',email:'Private'},'Private');
 assert.deepEqual(supabase.rows.at(-1).props,{is_demo:false,app_version:'0.1.0'});
 const count=supabase.rows.length;await logEvent('unknown');assert.equal(supabase.rows.length,count);
 await logEvent('session_started',{},'home');assert.equal(supabase.rows.at(-1).props.screen_id,'home');
});
