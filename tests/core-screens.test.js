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
    import AddMaeum from './components/AddMaeum.jsx';
    export {qa} from '@/lib/store';
    export async function mount(name, props) {
      const container = document.createElement('div'); document.body.append(container);
      const root = createRoot(container);
      const C = {Home,Onboarding,YeonDetail,AddMaeum}[name];
      await act(async()=>root.render(React.createElement(C, props)));
      return { container, click: async (element)=>act(async()=>element.click()),
        input: async (element,value)=>act(async()=>{
          Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(element,value);
          element.dispatchEvent(new window.Event('input',{bubbles:true}));
        }), select: async(element,value)=>act(async()=>{
          element.value=value; element.dispatchEvent(new window.Event('change',{bubbles:true}));
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
      : `export const qa={fail:true,writes:[]}; export const store={isAssetKindSupported:()=>true,getStatementMode:()=>"마음",setStatementMode:()=>{},setOnboarded:()=>{},upsertYeon:async()=>({id:"y1"}),addMaeum:async(value)=>{if(qa.fail)throw new Error("QA write failure");qa.writes.push(value);return {id:"m-new",...value}}};`,loader:'js'}));
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
const {mount,qa}=await import(pathToFileURL(file));
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


test('schedule purpose clears hidden transfer fields; transfer requires evidence and preserves zero', async(t)=>{
 setup();qa.fail=false;qa.writes=[];t.after(()=>{qa.fail=true});
 localStorage.setItem('jebi:asset-kind','goods');
 const app=await mount('AddMaeum',{yeons:people,maeums:[],presetYeonId:'y1',onSaved:()=>{},onClose:()=>{}});
 t.after(()=>app.close());
 await app.click(byText(app.container,'문자 없이 직접 입력'));
 assert.equal(app.container.querySelector('[aria-label="금액"]'),null);
 await app.select(app.container.querySelector('[aria-label="경조사 종류"]'),'결혼');
 await app.click(byText(app.container,'일정 저장하기'));
 assert.equal(qa.writes.length,1);assert.equal(qa.writes[0].amount,null);assert.equal(qa.writes[0].assetKind,null);
 await app.close();
 localStorage.removeItem('jebi:asset-kind');
 const money=await mount('AddMaeum',{yeons:people,maeums:[],presetYeonId:'y1',onSaved:()=>{},onClose:()=>{}});
 t.after(()=>money.close());
 await money.click(buttons(money.container).find(b=>b.textContent.includes('돈·선물 기록하기')));
 await money.click(byText(money.container,'문자 없이 직접 입력'));
 await money.select(money.container.querySelector('[aria-label="경조사 종류"]'),'결혼');
 await money.click(byText(money.container,'주고받은 마음 저장'));
 assert.match(money.container.querySelector('[role="alert"]').textContent,/금액 또는/);assert.equal(qa.writes.length,1);
 await money.input(money.container.querySelector('[aria-label="금액"]'),'0');
 await money.click(byText(money.container,'주고받은 마음 저장'));
 assert.equal(qa.writes.length,2);assert.equal(qa.writes[1].amount,0);
});

test('record save failure preserves the input and exposes an inline error',async(t)=>{
 setup();qa.fail=true;
 const app=await mount('AddMaeum',{yeons:people,maeums:[],presetYeonId:'y1',onSaved:()=>assert.fail('failed write must not finish'),onClose:()=>{}});
 t.after(()=>app.close());
 await app.click(byText(app.container,'문자 없이 직접 입력'));
 await app.select(app.container.querySelector('[aria-label="경조사 종류"]'),' 부고'.trim());
 await app.click(byText(app.container,'일정 저장하기'));
 assert.match(app.container.querySelector('[role="alert"]').textContent,/저장하지 못했어요/);
 assert.equal(app.container.querySelector('[aria-label="인연 이름"]').value,'김도현');
});


test('bereavement onboarding uses quiet completion and does not promise full gourds',async(t)=>{
 setup();qa.fail=false;qa.writes=[];t.after(()=>{qa.fail=true});
 const app=await mount('Onboarding',{onDone:()=>{}});t.after(()=>app.close());
 await app.click(byText(app.container,'건너뛰기'));
 await app.click(buttons(app.container).find(b=>b.textContent.includes('직접')));
 await app.input(app.container.querySelector('input'),'김도현');
 await app.click(byText(app.container,'부고'));
 await app.click(byText(app.container,'이 마음 기억하기'));
 await app.click(buttons(app.container).find(b=>b.textContent.includes('심') && !b.textContent.includes('다시')));
 assert.match(app.container.textContent,/조용히 소식을 기록했어요/);
 assert.equal(app.container.querySelector('.sprout-grow'),null);
 await app.click(byText(app.container,'다음'));
 assert.ok(!app.container.textContent.includes('이렇게 가득 차요'));
 assert.equal(app.container.querySelector('img').alt,'마음을 기억하는 우리 집');
 assert.equal(qa.writes[0].amount,null);
});
