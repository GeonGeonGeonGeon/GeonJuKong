import test from 'node:test';
import assert from 'node:assert/strict';

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
