import test from 'node:test';
import assert from 'node:assert/strict';

test('공유 저장소: PKCE 교환, 토큰 갱신, 페이지 조회와 비인가 수정 실패',async()=>{
  const storage=new Map([['geonjukong-pkce','test-verifier']]);
  globalThis.window={APP_CONFIG:{supabaseUrl:'https://test.supabase.co',supabaseAnonKey:'test-public-key'}};
  globalThis.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};globalThis.sessionStorage=globalThis.localStorage;
  globalThis.location={href:'http://localhost:4173/?code=test-code',origin:'http://localhost:4173',pathname:'/'};globalThis.history={replaceState(){}};
  let handler;const originalFetch=globalThis.fetch;globalThis.fetch=(url,options)=>handler(String(url),options);
  const {auth,repository}=await import('../src/backend.js');
  try{
    handler=(url,options)=>{assert.match(url,/grant_type=pkce/);assert.deepEqual(JSON.parse(options.body),{auth_code:'test-code',code_verifier:'test-verifier'});return Response.json({access_token:'first',refresh_token:'refresh',expires_in:0,user:{id:'user-1',email:'person@example.com'}});};
    await auth.callback();assert.equal(auth.user.id,'user-1');assert.equal(storage.has('geonjukong-pkce'),false);
    let refreshed=0,pages=0;
    handler=(url,options)=>{
      if(url.includes('grant_type=refresh_token')){refreshed++;assert.equal(JSON.parse(options.body).refresh_token,'refresh');return Response.json({access_token:'second',refresh_token:'new-refresh',expires_in:3600,user:{id:'user-1'}});}
      assert.equal(options.headers.Authorization,'Bearer second');pages++;
      return Response.json(pages===1?Array.from({length:500},(_,i)=>({id:String(i)})):[{id:'500'}]);
    };
    const rows=await repository.list();assert.equal(rows.length,501);assert.equal(pages,2);assert.equal(refreshed,1);
    handler=()=>Response.json([]);
    await assert.rejects(repository.save('live','user-1','diary',{text:'다른 사람 글 변경',date:'2026-10-26'},'not-owned'),/작성자만/);
    await assert.rejects(repository.remove('live','user-1',{id:'a',author_id:'user-2',kind:'diary'}),/작성자만/);
    handler=()=>Response.json({message:'permission denied'},{status:403});await assert.rejects(repository.list(),/permission denied/);
    handler=(url,options)=>{assert.match(url,/records\?on_conflict=id/);assert.match(options.headers.Prefer,/resolution=ignore-duplicates/);assert.deepEqual(JSON.parse(options.body),{id:'notice-uuid',author_id:'user-1',kind:'event_notice',data:{text:'Plan',title:'Plan',date:'2026-12-01',eventId:'google-event'}});return Response.json([]);};
    await repository.saveCalendarNotice('user-1',{id:'notice-uuid',title:'Plan',date:'2026-12-01',eventId:'google-event'});
    handler=(url,options)=>{assert.match(url,/couple_settings\?on_conflict=id/);assert.equal(options.headers.Prefer,'resolution=ignore-duplicates,return=representation');assert.deepEqual(JSON.parse(options.body),{id:1,data:{startDate:'2020-01-01'}});return Response.json([]);};
    assert.deepEqual(await repository.createCoupleSettings({startDate:'2020-01-01'}),[]);
    handler=(url,options)=>{assert.match(url,/notification_reads\?on_conflict=user_id,record_id/);assert.equal(options.headers.Prefer,'resolution=merge-duplicates,return=minimal');const rows=JSON.parse(options.body);assert.deepEqual(rows.map(({user_id,record_id})=>({user_id,record_id})),[{user_id:'user-1',record_id:'one'},{user_id:'user-1',record_id:'two'}]);assert.ok(rows.every(row=>!Number.isNaN(Date.parse(row.read_at))));return new Response(null,{status:204});};
    await repository.markNotificationsRead('user-1',['one','two']);
  }finally{globalThis.fetch=originalFetch;}
});

test('shared board edits compare the version seen when editing and reject a stale save', async () => {
  const { repository } = await import('../src/backend.js');
  const { local } = await import('../src/storage.js');
  const previousFetch = globalThis.fetch, previousList = local.list, previousPut = local.putIfVersion;
  const version = '2026-10-30T10:30:00.123456+00:00';
  let server = { id: 'board', kind: 'post', author_id: 'user-1', created_at: version, updated_at: version, data: { title: 'before', date: '2026-10-30', space: 'board' } }, denyWrite = false;
  const update = title => ({ title, date: '2026-10-30', space: 'board' });
  try {
    globalThis.fetch = async (url, options) => {
      const parsed = new URL(url);
      assert.equal(parsed.searchParams.get('id'), 'eq.board');
      if (options.method === undefined) return Response.json([{ updated_at: server.updated_at }]);
      assert.equal(options.method, 'PATCH');
      if (denyWrite || parsed.searchParams.get('updated_at') !== `eq.${server.updated_at}`) return Response.json([]);
      server = { ...server, data: JSON.parse(options.body).data, updated_at: '2026-10-30T10:31:00.000001+00:00' };
      return Response.json([server]);
    };
    await repository.save('live', 'user-1', 'post', update('first'), 'board', version);
    await assert.rejects(repository.save('live', 'user-2', 'post', update('stale'), 'board', version), /수정되었거나 삭제/);
    assert.equal(server.data.title, 'first');
    await assert.rejects(repository.save('live', 'user-2', 'post', update('no version'), 'board'), /수정되었거나 삭제/);
    denyWrite = true;
    await assert.rejects(repository.save('live', 'user-2', 'post', update('denied'), 'board', server.updated_at), /수정할 권한/);

    let stored = { ...server, updated_at: version, data: update('before') };
    local.list = async () => [{ ...stored }];
    local.putIfVersion = async (row, expected) => {
      if ((stored.updated_at || stored.created_at) !== expected) return false;
      stored = row; return true;
    };
    const outcomes = await Promise.allSettled([
      repository.save('demo', 'user-1', 'post', update('first'), 'board', version),
      repository.save('demo', 'user-2', 'post', update('stale'), 'board', version)
    ]);
    assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(outcomes.filter(result => result.status === 'rejected').length, 1);
    assert.equal(stored.data.title, 'first');
  } finally {
    globalThis.fetch = previousFetch;
    local.list = previousList;
    local.putIfVersion = previousPut;
  }
});

test('logout clears local credentials despite remote failures and prevents an in-flight refresh from restoring them', async () => {
  const previous = { window: globalThis.window, localStorage: globalThis.localStorage, sessionStorage: globalThis.sessionStorage, location: globalThis.location, history: globalThis.history, fetch: globalThis.fetch };
  const storage = new Map();
  globalThis.window = { APP_CONFIG: { supabaseUrl: 'https://test.supabase.co', supabaseAnonKey: 'test-public-key' } };
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  globalThis.sessionStorage = globalThis.localStorage;
  globalThis.location = { href: 'http://localhost:4173/?code=test-code', pathname: '/' };
  globalThis.history = { replaceState() {} };
  const { auth, repository } = await import('../src/backend.js?logout-test');
  const login = async expires => {
    storage.set('geonjukong-pkce', 'verifier');
    globalThis.fetch = async () => Response.json({ access_token: 'access', refresh_token: 'refresh', expires_in: expires, user: { id: 'user-1' } });
    await auth.callback();
  };
  try {
    await login(3600);
    globalThis.fetch = async () => Response.json({ error: 'server error' }, { status: 500 });
    assert.deepEqual(await auth.logout(), { remote: false });
    assert.equal(auth.user, null);
    assert.equal(storage.has('geonjukong-auth'), false);

    await login(3600);
    globalThis.fetch = async () => { throw new Error('offline'); };
    assert.deepEqual(await auth.logout(), { remote: false });
    assert.equal(auth.user, null);
    assert.equal(storage.has('geonjukong-auth'), false);

    await login(0);
    let finishRefresh;
    globalThis.fetch = (url, options) => {
      if (String(url).includes('grant_type=refresh_token')) return new Promise(resolve => { finishRefresh = resolve; });
      assert.match(String(url), /auth\/v1\/logout/);
      assert.equal(options.headers.Authorization, 'Bearer access');
      return Promise.resolve(new Response(null, { status: 204 }));
    };
    const pendingRequest = repository.list();
    const rejected = assert.rejects(pendingRequest, /세션이 종료/);
    assert.equal(typeof finishRefresh, 'function');
    assert.deepEqual(await auth.logout(), { remote: true });
    finishRefresh(Response.json({ access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 3600, user: { id: 'user-1' } }));
    await rejected;
    assert.equal(auth.user, null);
    assert.equal(storage.has('geonjukong-auth'), false);
  } finally {
    Object.assign(globalThis, previous);
  }
});
