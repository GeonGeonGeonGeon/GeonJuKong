import test from 'node:test';
import assert from 'node:assert/strict';
import { seal, unseal, refreshGoogle, verifyGoogle } from '../supabase/functions/google-auth/service.mjs';

test('Google birthday reads the signed-in profile and handles missing or denied data', async () => {
  const oldWindow = globalThis.window, oldFetch = globalThis.fetch;
  globalThis.window = { APP_CONFIG: {} };
  const { google } = await import('../src/google.js?birthday-test');
  google.setTokenProvider(async () => ({ access_token: 'birthday-token', expires_in: 3600 }));
  try {
    globalThis.fetch = async (url, options) => {
      assert.match(url, /people\/me\?personFields=birthdays/);
      assert.equal(options.headers.Authorization, 'Bearer birthday-token');
      return Response.json({ birthdays: [{ date: { year: 2000, month: 2, day: 29 }, metadata: { primary: true } }] });
    };
    assert.equal(await google.birthday(), '2000-02-29');
    globalThis.fetch = async () => Response.json({ birthdays: [{ date: { month: 4, day: 2 } }] });
    await assert.rejects(google.birthday(), /연도까지/);
    globalThis.fetch = async () => Response.json({ error: { message: 'insufficient scope' } }, { status: 403 });
    await assert.rejects(google.birthday(), /다시 연결/);
  } finally { google.disconnect(); globalThis.window = oldWindow; globalThis.fetch = oldFetch; }
});

test('Drive photo access selects the requested file and preserves response errors', async () => {
  const oldWindow = globalThis.window, oldDocument = globalThis.document, oldLocation = globalThis.location, oldFetch = globalThis.fetch;
  let selected, callback, fileFilter, pickerToken;
  class DocsView { setFileIds(ids) { fileFilter = ids; return this; } }
  class PickerBuilder {
    addView() { return this; } setOAuthToken(value) { pickerToken = value; return this; }
    setDeveloperKey() { return this; } setAppId() { return this; } setOrigin() { return this; } setTitle() { return this; }
    setCallback(fn) { callback = fn; return this; }
    build() { return { setVisible() { queueMicrotask(() => callback(selected)); } }; }
  }
  globalThis.window = { APP_CONFIG: { googleApiKey: 'key', googleProjectNumber: '123' }, gapi: { load(_name, options) { options.callback(); } }, google: { picker: { DocsView, PickerBuilder, ViewId: { DOCS: 'docs' }, Action: { PICKED: 'picked', CANCEL: 'cancel' } } } };
  globalThis.location = { origin: 'https://example.test' };
  globalThis.document = { createElement() { return {}; }, head: { append(element) { queueMicrotask(() => element.onload()); } } };
  const { google } = await import('../src/google.js?photo-access-test');
  google.setTokenProvider(async () => ({ access_token: 'test-token', expires_in: 3600 }));
  try {
    selected = { action: 'picked', docs: [{ id: 'other' }] };
    await assert.rejects(google.pickPhoto('photo-id'), /해당 사진/);
    assert.equal(fileFilter, 'photo-id'); assert.equal(pickerToken, 'test-token');
    selected = { action: 'cancel' };
    await assert.rejects(google.pickPhoto('photo-id'), /취소/);
    selected = { action: 'picked', docs: [{ id: 'photo-id' }] };
    await google.pickPhoto('photo-id');
    globalThis.fetch = async () => new Response(null, { status: 403 });
    await assert.rejects(google.image('photo-id'), error => error.status === 403);
    globalThis.fetch = async () => Response.json({ error: { errors: [{ reason: 'userRateLimitExceeded' }] } }, { status: 403 });
    await assert.rejects(google.image('photo-id'), error => error.code === 'rate_limit');
    globalThis.fetch = async () => new Response('bad', { headers: { 'Content-Type': 'text/plain' } });
    await assert.rejects(google.image('photo-id'), error => error.code === 'invalid_image');
  } finally { google.disconnect(); globalThis.window = oldWindow; globalThis.document = oldDocument; globalThis.location = oldLocation; globalThis.fetch = oldFetch; }
});

test('Google credentials are encrypted per user and rejected after tampering', async () => {
  const secret = btoa('a'.repeat(32));
  const ciphertext = await seal('private-refresh', secret, 'user-1');
  assert.doesNotMatch(ciphertext, /private-refresh/);
  assert.equal(await unseal(ciphertext, secret, 'user-1'), 'private-refresh');
  await assert.rejects(unseal(ciphertext, secret, 'user-2'));
  await assert.rejects(unseal(ciphertext, btoa('b'.repeat(32)), 'user-1'));
  await assert.rejects(refreshGoogle('refresh', 'client', 'secret', async () => Response.json({ error: 'invalid_grant' }, { status: 400 })), error => error.invalidGrant === true);
  await assert.rejects(verifyGoogle('access', 'expected@example.com', async () => Response.json({ email: 'other@example.com', email_verified: true })));
});

test('Google restored tokens refresh once for concurrent requests and retry 401', async () => {
  globalThis.window = { APP_CONFIG: { calendarId: 'shared' } };
  const { google } = await import('../src/google.js?refresh-test');
  const originalFetch = globalThis.fetch;
  let refreshes = 0, requests = 0;
  google.setTokenProvider(async () => { refreshes++; await Promise.resolve(); return { access_token: `token-${refreshes}`, expires_in: 3600 }; });
  try {
    await Promise.all([google.restore(), google.restore()]);
    assert.equal(refreshes, 1);
    globalThis.fetch = async (_url, options) => {
      requests++;
      if (requests === 1) return new Response(null, { status: 401 });
      assert.equal(options.headers.Authorization, 'Bearer token-2');
      return Response.json({ items: [] });
    };
    assert.deepEqual(await google.events(2026, 9), []);
    assert.equal(refreshes, 2); assert.equal(requests, 2);
    google.disconnect(); assert.equal(google.connected, false);
    await google.restore(); assert.equal(refreshes, 3);
  } finally { globalThis.fetch = originalFetch; }
});

test('upcoming calendar events use local midnight and follow pages until three future starts', async () => {
  globalThis.window = { APP_CONFIG: { calendarId: 'shared' } };
  const { google } = await import('../src/google.js?upcoming-test');
  const originalFetch = globalThis.fetch;
  google.setTokenProvider(async () => ({ access_token: 'token', expires_in: 3600 }));
  const requests = [];
  globalThis.fetch = async url => {
    const query = new URL(url).searchParams;
    requests.push(query);
    if (!query.has('pageToken')) return Response.json({
      items: [
        { id: 'ongoing', start: { date: '2026-10-25' }, end: { date: '2026-11-02' } },
        { id: 'first', start: { date: '2026-11-01' }, end: { date: '2026-11-02' } },
        { id: 'cancelled', status: 'cancelled', start: { date: '2026-11-02' } }
      ], nextPageToken: 'next'
    });
    assert.equal(query.get('pageToken'), 'next');
    return Response.json({ items: [
      { id: 'second', start: { date: '2026-12-01' }, end: { date: '2026-12-02' } },
      { id: 'third', start: { date: '2027-02-01' }, end: { date: '2027-02-02' } }
    ], nextPageToken: 'unused' });
  };
  try {
    const result = await google.upcomingEvents('2026-11-01');
    assert.deepEqual(result.map(row => row.id), ['first', 'second', 'third']);
    assert.equal(requests.length, 2);
    assert.equal(requests[0].get('timeMin'), new Date('2026-11-01T00:00:00').toISOString());
    assert.equal(requests[0].get('singleEvents'), 'true');
    assert.equal(requests[0].get('orderBy'), 'startTime');
    assert.equal(requests[0].has('timeMax'), false);
  } finally { google.disconnect(); globalThis.fetch = originalFetch; }
});

test('Google: 동일 계정 확인, 일정 페이지 조회/수정, 원본 청크 업로드와 중단 재개',async()=>{
  const cfg={googleClientId:'test-client',calendarId:'test-calendar',driveFolderId:'test-folder'};
  globalThis.window={APP_CONFIG:cfg,google:{accounts:{oauth2:{hasGrantedAllScopes:()=>true,initTokenClient(options){return{requestAccessToken(){options.callback({access_token:'test-token',expires_in:3600});}};}}}}};
  const originalFetch=globalThis.fetch;
  let identity='person@example.com';let handler;
  globalThis.fetch=async(url,options={})=>{
    if(String(url).includes('userinfo'))return Response.json({email:identity,email_verified:true});
    return handler(String(url),options);
  };
  const {google}=await import('../src/google.js');
  try{
    await google.connect('person@example.com');assert.equal(google.connected,true);
    identity='other@example.com';await assert.rejects(google.connect('person@example.com'),/같은 Google 계정/);identity='person@example.com';
    let page=0;
    handler=(url,options)=>{assert.match(options.headers.Authorization,/Bearer test-token/);page++;if(page===1)return Response.json({items:[{id:'a',start:{date:'2026-10-26'},end:{date:'2026-10-27'},summary:'첫 일정'}],nextPageToken:'next'});assert.match(url,/pageToken=next/);return Response.json({items:[{id:'b',start:{date:'2026-10-27'},end:{date:'2026-10-28'},summary:'둘째 일정'}]});};
    const events=await google.events(2026,9);assert.equal(events.length,2);assert.equal(page,2);
    handler=(url,options)=>{assert.match(url,/test-calendar\/events\/event%2Fid$/);assert.equal(options.headers.Authorization,'Bearer test-token');return Response.json({id:'event/id',start:{date:'2027-02-13'},end:{date:'2027-02-14'},summary:'Moved'});};
    assert.equal((await google.event('event/id')).data.date,'2027-02-13');
    handler=(url,options)=>{assert.match(url,/test-calendar\/events\/a$/);assert.equal(options.method,'PATCH');const body=JSON.parse(options.body);assert.equal(body.start.date,'2026-10-26');assert.equal(body.end.date,'2026-10-29');return Response.json({id:'a'});};
    await google.saveEvent({title:'여행',date:'2026-10-26',endDate:'2026-10-28'},'a');
    const controller=new AbortController();
    handler=(url,options)=>{assert.match(url,/files\/private%2Fphoto\?alt=media$/);assert.doesNotMatch(url,/test-token|access_token/);assert.equal(options.headers.Authorization,'Bearer test-token');assert.equal(options.signal,controller.signal);return new Response(new Blob(['private photo'],{type:'image/jpeg'}));};
    const photo=await google.image('private/photo',controller.signal);assert.equal(photo.type,'image/jpeg');assert.equal(await photo.text(),'private photo');
    handler=()=>new Response('Not an image',{headers:{'Content-Type':'text/html'}});
    await assert.rejects(google.image('not-a-photo'),/미리볼 수 있는 사진/);
    handler=()=>new Response(null,{status:403});
    await assert.rejects(google.image('inaccessible-photo'),/파일 권한/);assert.equal(google.connected,true);
    const file=new Blob([new Uint8Array(5*1024*1024).fill(42)],{type:'video/mp4'});Object.defineProperties(file,{name:{value:'original.mp4'},lastModified:{value:123}});
    let initiated=0;let chunks=0;let interrupted=true;
    handler=async(url,options)=>{
      if(url.includes('uploadType=resumable')){initiated++;assert.equal(JSON.parse(options.body).parents[0],'test-folder');return new Response(null,{status:200,headers:{Location:'https://upload.example/session'}});}
      if(options.headers['Content-Range'].startsWith('bytes */'))return new Response(null,{status:308,headers:{Range:'bytes=0-4194303'}});
      chunks++;
      if(chunks===1){assert.equal(options.body.size,4194304);const bytes=new Uint8Array(await options.body.arrayBuffer());assert.equal(bytes[0],42);assert.equal(bytes.at(-1),42);return new Response(null,{status:308,headers:{Range:'bytes=0-4194303'}});}
      if(interrupted){interrupted=false;throw new TypeError('Network interrupted');}
      assert.equal(options.headers['Content-Range'],'bytes 4194304-5242879/5242880');assert.equal(options.body.size,1048576);
      return Response.json({id:'original-id',name:'original.mp4'});
    };
    await assert.rejects(google.upload(file,()=>{}),/Network interrupted/);
    const uploaded=await google.upload(file,()=>{});assert.equal(initiated,1);assert.equal(uploaded.id,'original-id');assert.equal(uploaded.source,'drive');assert.equal(uploaded.size,file.size);
    handler=()=>new Response(null,{status:401});
    await assert.rejects(google.image('expired-photo'),/Google 연결/);assert.equal(google.connected,false);
    google.disconnect();assert.equal(google.connected,false);await assert.rejects(google.events(2026,9),/Google을 연결/);
  }finally{globalThis.fetch=originalFetch;}
});
