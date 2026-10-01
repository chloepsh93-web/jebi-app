import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir=await mkdtemp(join(tmpdir(),'jebi-auth-'));
const built=await build({stdin:{contents:`export * from './lib/auth.js';export {supabase} from './lib/supabase.js';`,resolveDir:resolve('.')},bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'mock-auth',setup(b){b.onResolve({filter:/supabase\.js$/},()=>({path:'supabase',namespace:'qa'}));b.onLoad({filter:/.*/,namespace:'qa'},()=>({contents:`export const supabase={calls:[],queryError:false,auth:{updateUser:async(...args)=>{supabase.calls.push(args);return {error:null}},signInWithOtp:async(arg)=>{supabase.calls.push(arg);return {error:null}},getUser:async()=>({data:{user:{id:'qa-anon',is_anonymous:true}}})},from(table){const query={select:()=>query,eq:async()=>({data:[{id:table}],error:supabase.queryError?{message:'QA read failure'}:null})};return query}};`}));}}]});
const file=join(dir,'auth.mjs');await writeFile(file,built.outputFiles[0].text);
const {getEmailRedirectUrl,sendLoginLink,linkEmail,snapshotAnonymous,supabase}=await import(pathToFileURL(file));
const original=process.env.NEXT_PUBLIC_AUTH_REDIRECT_URL;
test.after(async()=>{if(original===undefined)delete process.env.NEXT_PUBLIC_AUTH_REDIRECT_URL;else process.env.NEXT_PUBLIC_AUTH_REDIRECT_URL=original;delete global.window;await rm(dir,{recursive:true,force:true});});
test('preview callback returns to preview, restore never creates a new user',async()=>{
 delete process.env.NEXT_PUBLIC_AUTH_REDIRECT_URL;global.window={location:{origin:'https://qa-preview.example'}};
 await sendLoginLink('qa@example.test');
 const options=supabase.calls.at(-1).options;
 assert.equal(options.emailRedirectTo,'https://qa-preview.example/');assert.equal(options.shouldCreateUser,false);
 await linkEmail('qa@example.test');assert.equal(supabase.calls.at(-1)[1].emailRedirectTo,'https://qa-preview.example/');
});
test('explicit callback accepts HTTPS and localhost development only',()=>{
 process.env.NEXT_PUBLIC_AUTH_REDIRECT_URL='https://allowed.example/';assert.equal(getEmailRedirectUrl(),'https://allowed.example/');
 for(const url of ['http://remote.example/','javascript:alert(1)','https://user:password@example.test/']){process.env.NEXT_PUBLIC_AUTH_REDIRECT_URL=url;assert.throws(()=>getEmailRedirectUrl());}
 process.env.NEXT_PUBLIC_AUTH_REDIRECT_URL='http://localhost:3000';assert.equal(getEmailRedirectUrl(),'http://localhost:3000/');
});
test('snapshot read failure cannot masquerade as an empty account',async()=>{
 supabase.queryError=true;await assert.rejects(snapshotAnonymous(),/기록을 읽지 못/);
 supabase.queryError=false;const snap=await snapshotAnonymous();assert.equal(snap.anonId,'qa-anon');assert.equal(snap.yeons.length,1);assert.equal(snap.maeums.length,1);
});
