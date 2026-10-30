import test from 'node:test';
import assert from 'node:assert/strict';

test('PWA back closes a dialog before navigating and day counters refresh after midnight', async () => {
  const realDate = globalThis.Date, realInterval = globalThis.setInterval;
  let current = new realDate(2026, 11, 30, 23, 59).getTime(), tick, confirmations = 0, pushes = 0;
  globalThis.Date = class extends realDate { constructor(...args) { super(...(args.length ? args : [current])); } static now() { return current; } };
  globalThis.setInterval = fn => { tick = fn; return 0; };
  const events = new Map(), documentEvents = new Map();
  const values = new Map([['geonjukong-seeded', '1'], ['geonjukong-demo-couple', JSON.stringify({ startDate:'2026-01-01', birthdays:[{ name:'짝꿍', date:'2000-01-02' }] })]]);
  const app = { innerHTML:'' }, toast = { textContent:'', classList:{ add(){}, remove(){} } };
  const editor = { innerHTML:'', open:false, showModal(){this.open=true;}, close(){this.open=false;}, addEventListener(){} };
  globalThis.window = { APP_CONFIG:{}, addEventListener:(name,fn)=>events.set(name,fn), scrollTo(){} };
  Object.defineProperty(globalThis,'navigator',{value:{},configurable:true});
  globalThis.document = { hidden:false, activeElement:{ matches:()=>false }, querySelector:s=>({'#app':app,'#toast':toast,'#editor':editor})[s] || null, querySelectorAll:()=>[], addEventListener:(name,fn)=>documentEvents.set(name,fn) };
  globalThis.localStorage = { getItem:k=>values.get(k) ?? null, setItem:(k,v)=>values.set(k,v), removeItem:k=>values.delete(k) };
  globalThis.sessionStorage = globalThis.localStorage;
  globalThis.location = { href:'http://localhost/', origin:'http://localhost', pathname:'/', hash:'' };
  globalThis.history = { pushState(_s,_t,url){ pushes++; location.hash=url; }, replaceState(_s,_t,url){ location.hash=url; } };
  globalThis.confirm = () => { confirmations++; return false; };
  const { local } = await import('../src/storage.js');
  const originalList = local.list; local.list = async () => [];
  const click = dataset => documentEvents.get('click')({ target:{ closest:()=>({dataset}) } });
  const flush = () => new Promise(resolve => setTimeout(resolve, 0));
  try {
    await import('../src/app.js?navigation-test');
    for (let i=0;i<20 && !app.innerHTML.includes('D+363');i++) await flush();
    assert.match(app.innerHTML, /D\+363/);
    assert.match(app.innerHTML, /짝꿍 생일/);
    assert.equal(pushes, 1);
    await click({view:'calendar'});
    await click({action:'new',kind:'event'});
    assert.equal(editor.open, true);
    events.get('popstate')(); await flush();
    assert.equal(editor.open, false);
    assert.match(app.innerHTML, /함께 채우는 달력/);
    assert.equal(confirmations, 0);
    events.get('popstate')(); await flush();
    assert.match(app.innerHTML, /오늘도, 단둘이/);
    events.get('popstate')(); await flush();
    assert.equal(confirmations, 1);
    assert.equal(pushes, 4);
    current = new realDate(2026, 11, 31, 0, 1).getTime();
    await tick();
    assert.match(app.innerHTML, /D\+364/);
    assert.match(app.innerHTML, /짝꿍 생일/);
  } finally {
    local.list = originalList; globalThis.Date = realDate; globalThis.setInterval = realInterval;
  }
});

test('Android back closes a dialog, returns to home, and confirms before exit', async () => {
  const realInterval = globalThis.setInterval;
  globalThis.setInterval = () => 0;
  const documentEvents = new Map(), values = new Map([['geonjukong-seeded','1']]);
  const app = {innerHTML:''}, toast = {textContent:'',classList:{add(){},remove(){}}};
  const editor = {innerHTML:'',open:false,showModal(){this.open=true;},close(){this.open=false;},addEventListener(){}};
  let back, exits = 0, accepted = false;
  globalThis.window = {APP_CONFIG:{},addEventListener(){},scrollTo(){},GEONJUKONG_NATIVE:{active:true,onBack:fn=>{back=fn;},listen:async()=>undefined,exit:async()=>{exits++;}}};
  Object.defineProperty(globalThis,'navigator',{value:{},configurable:true});
  globalThis.document = {hidden:false,activeElement:{matches:()=>false},querySelector:s=>({'#app':app,'#toast':toast,'#editor':editor})[s] || null,querySelectorAll:()=>[],addEventListener:(name,fn)=>documentEvents.set(name,fn)};
  globalThis.localStorage = {getItem:k=>values.get(k) ?? null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
  globalThis.sessionStorage = globalThis.localStorage;
  globalThis.location = {href:'https://localhost/',origin:'https://localhost',pathname:'/',hash:''};
  globalThis.history = {replaceState(_s,_t,url){location.hash=url;}};
  globalThis.confirm = () => accepted;
  const {local} = await import('../src/storage.js');
  const originalList = local.list; local.list = async()=>[];
  const click = dataset => documentEvents.get('click')({target:{closest:()=>({dataset})}});
  try {
    await import('../src/app.js?android-navigation-test');
    for (let i=0;i<20 && !app.innerHTML.includes('오늘도, 단둘이');i++) await new Promise(resolve=>setTimeout(resolve,0));
    await click({view:'calendar'});
    await click({action:'new',kind:'event'});
    await back(); assert.equal(editor.open,false); assert.match(app.innerHTML,/함께 채우는 달력/);
    await back(); assert.match(app.innerHTML,/오늘도, 단둘이/);
    await back(); assert.equal(exits,0);
    accepted=true; await back(); assert.equal(exits,1);
  } finally { local.list=originalList; globalThis.setInterval=realInterval; }
});
