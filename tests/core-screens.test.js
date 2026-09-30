import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { build } from 'esbuild';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const folder = await mkdtemp(join(tmpdir(), 'jebi-screen-test-'));
const result = await build({
  stdin: { contents: `
    import React, { act } from 'react';
    import { createRoot } from 'react-dom/client';
    import Home from './components/Home.jsx';
    import Onboarding from './components/Onboarding.jsx';
    import YeonDetail from './components/YeonDetail.jsx';
    export async function mount(name, props) {
      const container = document.createElement('div'); document.body.append(container);
      const root = createRoot(container);
      const C = {Home,Onboarding,YeonDetail}[name];
      await act(async()=>root.render(React.createElement(C, props)));
      return { container, click: async (element)=>act(async()=>element.click()),
        input: async (element,value)=>act(async()=>{
          Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(element,value);
          element.dispatchEvent(new window.Event('input',{bubbles:true}));
        }), close: async()=>{await act(async()=>root.unmount());container.remove();} };
    }
  `, resolveDir: resolve('.'), loader: 'jsx' },
  bundle: true, write: false, format: 'esm', platform: 'node', jsx: 'automatic',
  plugins: [{name:'qa-mocks',setup(b){
    b.onResolve({filter:/^@\//},args=> {
      if(['@/lib/store','@/lib/metrics'].includes(args.path))return {path:args.path,namespace:'mock'};
      return {path:resolve(args.path.slice(2)+(args.path.endsWith('.js')?'':'.'+(args.path.startsWith('@/components/')?'jsx':'js')))};
    });
    b.onLoad({filter:/.*/,namespace:'mock'},args=>({contents: args.path.endsWith('metrics')
      ? 'export const logEvent=()=>{};'
      : `export const store={getStatementMode:()=>"마음",setStatementMode:()=>{},setOnboarded:()=>{},upsertYeon:async()=>({id:"y1"}),addMaeum:async()=>{throw new Error("QA write failure")}};`,loader:'js'}));
  }}],
});
const file=join(folder,'fixture.mjs'); await writeFile(file,result.outputFiles[0].text);
// Close channels created by the bundled React act harness after all assertions.
const nativeMessageChannel = global.MessageChannel;
const channels = [];
global.MessageChannel = class extends nativeMessageChannel {
  constructor() { super(); channels.push(this); }
};
test.after(() => {
  for (const channel of channels) { channel.port1.close(); channel.port2.close(); }
  global.MessageChannel = nativeMessageChannel;
});
setup();
const {mount}=await import(pathToFileURL(file));
test.after(()=>rm(folder,{recursive:true,force:true}));
function setup(){
 const dom=new JSDOM('<body></body>',{url:'https://example.test'});
 global.window=dom.window;global.document=dom.window.document;
 Object.defineProperty(global,'navigator',{value:dom.window.navigator,configurable:true});
 global.localStorage=dom.window.localStorage;global.IS_REACT_ACT_ENVIRONMENT=true;
}
const people=[{id:'y1',name:'김도현',relationTag:'회사'}];
const upcoming={id:'m1',yeonId:'y1',direction:'받음',eventType:'결혼',eventDate:'2099-10-04',amount:null,plantedAt:Date.now(),repaidAt:null};
const buttons=c=>[...c.querySelectorAll('button')];
const byText=(c,t)=>buttons(c).find(b=>b.textContent.trim()===t);

test('Home prioritizes actionable schedule and does not claim preparation complete',async()=>{
 setup();let opened=null;
 const app=await mount('Home',{yeons:people,maeums:[upcoming],alertCount:0,onOpenYeon:id=>opened=id});
 const schedule=app.container.querySelector('button.schedule-card');
 assert.ok(schedule);
 assert.ok(schedule.compareDocumentPosition(app.container.querySelector('.home-house')) & window.Node.DOCUMENT_POSITION_FOLLOWING);
 assert.ok(!app.container.textContent.includes('준비 완료'));
 await app.click(schedule);assert.equal(opened,'y1');
 await app.close();
});

test('relationship defaults to memory; monetary comparison is an explicit choice',async()=>{
 setup();
 const app=await mount('YeonDetail',{yeon:people[0],maeums:[{...upcoming,amount:10000,assetKind:'cash'}],yeons:people});
 assert.equal(app.container.querySelector('.yeon-balance'),null);
 await app.click(byText(app.container,'정산 모드'));
 assert.ok(app.container.querySelector('.yeon-balance'));
 await app.click(byText(app.container,'마음 모드'));
 assert.equal(app.container.querySelector('.yeon-balance'),null);
 await app.close();
});

test('onboarding has three slides and a failed real save remains at confirmation',async(t)=>{
 setup();
 const app=await mount('Onboarding',{onDone:()=>assert.fail('must not complete')});
 t.after(()=>app.close());
 assert.equal(app.container.querySelectorAll('.intro-slide').length,1);
 assert.equal(app.container.querySelectorAll('.intro-dot').length,3);
 await app.click(byText(app.container,'건너뛰기'));
 const manual=buttons(app.container).find(b=>b.textContent.includes('직접'));
 assert.ok(manual);await app.click(manual);
 await app.input(app.container.querySelector('input'), '김도현');
 await app.click(byText(app.container,'결혼식'));
 await app.click(byText(app.container,'이 마음 기억하기'));
 const save=buttons(app.container).find(b=>b.textContent.includes('심') && !b.textContent.includes('다시'));
 assert.ok(save);await app.click(save);
 assert.match(app.container.querySelector('[role="alert"]').textContent,/저장하지 못했어요/);
 assert.ok(app.container.querySelector('.parsed'));
 assert.equal(app.container.querySelector('.plant-house'),null);
 await app.close();
});
