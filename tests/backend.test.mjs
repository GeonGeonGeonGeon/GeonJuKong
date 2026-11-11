import test from 'node:test';
import assert from 'node:assert/strict';

async function backendFixture(t, expired = false) {
  const storage = new Map([['geonjukong-auth', JSON.stringify({ access_token: 'access', refresh_token: 'refresh', expires_at: Date.now() + (expired ? -1 : 3600000), user: { id: 'member' } })]]);
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected request'); });
  const previous = { window: globalThis.window, localStorage: globalThis.localStorage };
  globalThis.window = { APP_CONFIG: { supabaseUrl: 'https://network.test', supabaseAnonKey: 'public' } };
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  t.after(() => Object.assign(globalThis, previous));
  const backend = await import(`../src/backend.js?network-${crypto.randomUUID()}`);
  return { ...backend, storage };
}
const flushRequests = () => new Promise(resolve => setImmediate(resolve));

test('REST and google-auth bound missing responses and body reads, preserve login and allow retry', async t => {
  const { auth, repository, storage } = await backendFixture(t);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  for (const request of [() => repository.members(), () => auth.googleToken()]) {
    for (const bodyOnly of [false, true]) {
      let signal;
      globalThis.fetch = async (_url, options) => {
        signal = options.signal;
        return bodyOnly ? { ok: true, status: 200, json: () => new Promise(() => {}) } : new Promise(() => {});
      };
      const pending = request();
      const rejected = assert.rejects(pending, error => error.name === 'TimeoutError' && error.code === 'timeout' && error.retryable);
      await flushRequests();
      t.mock.timers.tick(15000);
      await rejected;
      assert.equal(signal.aborted, true);
      assert.equal(auth.user.id, 'member'); assert.equal(storage.has('geonjukong-auth'), true);
      globalThis.fetch = async () => Response.json([]);
      assert.deepEqual(await request(), []);
    }
  }
  globalThis.fetch = async () => Response.json({ error: 'upstream timeout', code: 'timeout' }, { status: 504 });
  await assert.rejects(auth.googleToken(), { name: 'TimeoutError', code: 'timeout', retryable: true, status: 504 });
  assert.equal(auth.user.id, 'member'); assert.equal(storage.has('geonjukong-auth'), true);
});

test('concurrent expired sessions share refresh, survive its timeout and retry together', async t => {
  const { auth, repository, storage } = await backendFixture(t, true);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let refreshes = 0, finishOld;
  globalThis.fetch = async url => {
    assert.match(url, /grant_type=refresh_token/); refreshes++;
    return new Promise(resolve => { finishOld = resolve; });
  };
  const first = repository.members(), second = repository.profiles();
  const rejected = [first, second].map(pending => assert.rejects(pending, { code: 'timeout' }));
  await flushRequests(); assert.equal(refreshes, 1);
  t.mock.timers.tick(15000); await Promise.all(rejected);
  assert.equal(auth.user.id, 'member');
  globalThis.fetch = async (url, options) => {
    if (url.includes('grant_type=refresh_token')) { refreshes++; return Response.json({ access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 3600, user: { id: 'member' } }); }
    assert.equal(options.headers.Authorization, 'Bearer new-access'); return Response.json([]);
  };
  assert.deepEqual(await Promise.all([repository.members(), repository.profiles()]), [[], []]);
  assert.equal(refreshes, 2);
  finishOld(Response.json({ access_token: 'stale', refresh_token: 'stale', expires_in: 3600, user: { id: 'wrong' } }));
  await flushRequests();
  assert.equal(JSON.parse(storage.get('geonjukong-auth')).access_token, 'new-access');
});

test('cancelling one REST reader leaves the shared refresh available to another reader', async t => {
  const { repository, auth } = await backendFixture(t, true);
  let finishRefresh, refreshes = 0;
  globalThis.fetch = async url => {
    if (url.includes('grant_type=refresh_token')) { refreshes++; return new Promise(resolve => { finishRefresh = resolve; }); }
    return Response.json([]);
  };
  const controller = new AbortController();
  const cancelled = assert.rejects(repository.members({ signal: controller.signal }), { name: 'AbortError' });
  const other = repository.profiles();
  await flushRequests(); controller.abort(); await cancelled;
  finishRefresh(Response.json({ access_token: 'fresh', refresh_token: 'refresh', expires_in: 3600, user: { id: 'member' } }));
  assert.deepEqual(await other, []); assert.equal(refreshes, 1); assert.equal(auth.user.id, 'member');
  const preAborted = new AbortController(); preAborted.abort();
  await assert.rejects(repository.members({ signal: preAborted.signal }), { name: 'AbortError' });
});

test('REST and google-auth retry simultaneous 401s once using one refresh', async t => {
  const { repository, auth } = await backendFixture(t);
  let refreshes = 0, requests = 0;
  globalThis.fetch = async (url, options) => {
    if (url.includes('grant_type=refresh_token')) { refreshes++; return Response.json({ access_token: 'fresh', refresh_token: 'refresh', expires_in: 3600, user: { id: 'member' } }); }
    requests++;
    return options.headers.Authorization === 'Bearer access' ? Response.json({}, { status: 401 }) : Response.json([]);
  };
  assert.deepEqual(await Promise.all([repository.members(), auth.googleToken()]), [[], []]);
  assert.equal(refreshes, 1); assert.equal(requests, 4);
  globalThis.fetch = async url => {
    if (url.includes('grant_type=refresh_token')) { refreshes++; return Response.json({ access_token: 'fresh', refresh_token: 'refresh', expires_in: 3600, user: { id: 'member' } }); }
    return Response.json({ message: 'Unauthorized' }, { status: 401 });
  };
  await assert.rejects(repository.members(), /Unauthorized/); assert.equal(refreshes, 2);
});

test('only a definitive invalid refresh clears stored login', async t => {
  const { repository, auth, storage } = await backendFixture(t, true);
  globalThis.fetch = async () => { throw new TypeError('offline'); };
  await assert.rejects(repository.members(), /offline/);
  assert.equal(storage.has('geonjukong-auth'), true);
  globalThis.fetch = async () => Response.json({ msg: 'invalid refresh' }, { status: 400 });
  await assert.rejects(repository.members(), /invalid refresh/);
  assert.equal(auth.user, null); assert.equal(storage.has('geonjukong-auth'), false);
});

test('logout cancels a missing response and itself has a finite remote wait', async t => {
  const { repository, auth, storage } = await backendFixture(t);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let finishOld;
  globalThis.fetch = async url => new Promise(resolve => { if (url.includes('/rest/')) finishOld = resolve; });
  const reader = assert.rejects(repository.members(), { name: 'AbortError' });
  await flushRequests();
  const logout = auth.logout(); await reader;
  await flushRequests(); t.mock.timers.tick(15000);
  assert.deepEqual(await logout, { remote: false });
  finishOld(Response.json([{ id: 'late' }])); await flushRequests();
  assert.equal(auth.user, null); assert.equal(storage.has('geonjukong-auth'), false);
});

test('bucket and profile REST writes validate input, protect versions and return persisted rows', async () => {
  const values = new Map([['geonjukong-auth', JSON.stringify({ user: { id: 'member' }, access_token: 'session', expires_at: Date.now() + 3600000 })]]);
  globalThis.window = { APP_CONFIG: { supabaseUrl: 'https://features.test', supabaseAnonKey: 'public' } };
  globalThis.localStorage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const previousFetch = globalThis.fetch;
  const { repository } = await import('../src/backend.js?feature-rest-tests');
  let request, response = [{ id: 'goal', title: 'A goal' }], responseStatus = 200;
  globalThis.fetch = async (url, options) => { request = { url: new URL(url), options, body: options.body && JSON.parse(options.body) }; return Response.json(response, { status: responseStatus }); };
  try {
    await repository.saveBucketItem('member', { title: ' A goal ', notes: '', completed_on: null });
    assert.equal(request.options.method, 'POST'); assert.equal(request.body.author_id, 'member'); assert.equal(request.body.title, 'A goal');
    assert.equal(request.options.headers.Authorization, 'Bearer session');
    await repository.saveBucketItem('member', { title: 'A goal', completed_on: '2026-11-03' }, 'goal', '2026-11-03T10:00:00Z');
    assert.equal(request.options.method, 'PATCH'); assert.equal(request.url.searchParams.get('id'), 'eq.goal');
    assert.equal(request.url.searchParams.get('updated_at'), 'eq.2026-11-03T10:00:00Z'); assert.equal(request.body.author_id, undefined);
    response = [];
    await assert.rejects(repository.saveBucketItem('member', { title: 'A goal' }, 'goal', 'stale'), /변경되었거나 삭제/);
    await assert.rejects(repository.removeBucketItem('goal', 'stale'), /변경되었거나 삭제/);
    assert.equal(request.options.method, 'DELETE'); assert.equal(request.url.searchParams.get('updated_at'), 'eq.stale');
    await assert.rejects(repository.saveBucketItem('member', { title: 'A goal', completed_on: '2026-02-30' }), /올바른 달성/);
    response = [{ user_id: 'member', data: { status: 'hello', bio: '', photo: '' } }];
    const saved = await repository.saveProfile('member', { status: ' hello ' });
    assert.equal(saved.user_id, 'member'); assert.equal(request.url.pathname, '/rest/v1/member_profiles');
    assert.match(request.options.headers.Prefer, /resolution=merge-duplicates/);
    assert.deepEqual(request.body, { user_id: 'member', data: { name: '', status: 'hello', bio: '', photo: '' } });
    const photos = [{ recordId: 'post', fileId: 'photo', file: { id: 'photo', name: 'photo.jpg', source: 'drive', type: 'image/jpeg' }, selected: false }];
    response = { homePhoto: photos };
    assert.deepEqual(await repository.updateHomePhoto(photos), response);
    assert.equal(request.url.pathname, '/rest/v1/rpc/update_home_photo');
    assert.deepEqual(request.body, { selection: photos });
    responseStatus = 400; response = { code: 'P0001', message: '올바른 사진을 선택해 주세요.' };
    await assert.rejects(repository.updateHomePhoto(photos), error => {
      assert.match(error.message, /서버.*업데이트/); assert.equal(error.cause.message, response.message); return true;
    });
    await assert.rejects(repository.updateHomePhoto([{ file: { ...photos[0].file, type: 'video/mp4' } }]), { message: '올바른 사진을 선택해 주세요.' });
    responseStatus = 403; response = { message: 'Forbidden' };
    await assert.rejects(repository.updateHomePhoto(photos), { message: 'Forbidden' });
    await assert.rejects(repository.saveProfile('member', { photo: 'https://invalid.test/image.svg' }), /프로필 사진/);
  } finally { globalThis.fetch = previousFetch; }
});

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
    await assert.rejects(repository.save('live','user-1','post',{title:'다른 사람 글 변경',date:'2026-10-26'},'not-owned'),/작성자만/);
    await assert.rejects(repository.remove('live','user-1',{id:'a',author_id:'user-2',kind:'post'}),/작성자만/);
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
    await new Promise(resolve => setImmediate(resolve));
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
