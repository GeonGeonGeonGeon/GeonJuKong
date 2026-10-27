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
  }finally{globalThis.fetch=originalFetch;}
});
