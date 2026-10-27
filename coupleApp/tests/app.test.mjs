import test from 'node:test';
import assert from 'node:assert/strict';

test('앱 체험 흐름: 초기 데이터, 글·댓글·일기·일정·메시지와 작성자 권한',async()=>{
  const rows=new Map(),files=new Map(),values=new Map(),listeners=new Map();
  const app={innerHTML:''},toast={textContent:'',classList:{add(){},remove(){}}},editor={innerHTML:'',open:false,showModal(){this.open=true;},close(){this.open=false;},addEventListener(){}};
  globalThis.window={APP_CONFIG:{},addEventListener(){},scrollTo(){}};
  Object.defineProperty(globalThis,'navigator',{value:{},configurable:true});
  globalThis.document={querySelector(selector){return({'#app':app,'#editor':editor,'#toast':toast})[selector]||null;},querySelectorAll(){return[];},addEventListener(type,fn){listeners.set(type,fn);},activeElement:{matches(){return false;}}};
  globalThis.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
  globalThis.sessionStorage=globalThis.localStorage;
  globalThis.location={href:'http://localhost:4173/',origin:'http://localhost:4173',pathname:'/',hash:''};
  globalThis.history={replaceState(){}};
  const originalInterval=globalThis.setInterval;globalThis.setInterval=()=>0;
  const {local}=await import('../src/storage.js');
  local.list=async()=>[...rows.values()];local.put=async row=>rows.set(row.id,row);local.remove=async id=>rows.delete(id);local.putFile=async(id,blob)=>files.set(id,{id,blob});local.file=async id=>files.get(id);
  const originalFormData=globalThis.FormData;
  globalThis.FormData=class{constructor(form){this.values=Object.entries(form._data||{});}get(k){return this.values.find(([name])=>name===k)?.[1];}[Symbol.iterator](){return this.values[Symbol.iterator]();}};
  function click(dataset){return listeners.get('click')({target:{closest(){return {dataset};}}});}
  async function submit(kind,data,id=''){
    const error={textContent:''},button={textContent:'저장',disabled:false,isConnected:true};
    const form={id:'record-form',dataset:{kind,id},_data:data,elements:{files:{files:[]}},querySelector(selector){return selector==='[type="submit"]'?button:error;}};
    await listeners.get('submit')({target:form,preventDefault(){}});return error.textContent;
  }
  try{
    await import('../src/app.js');
    for(let i=0;i<20&&!app.innerHTML.includes('오늘도, 단둘이');i++)await new Promise(resolve=>setTimeout(resolve,5));
    assert.match(app.innerHTML,/오늘도, 단둘이/);assert.match(app.innerHTML,/이 기기 체험 모드/);assert.equal(rows.size,7);
    await click({view:'diary'});assert.match(app.innerHTML,/너의 하루, 나의 마음/);
    await click({action:'new',kind:'diary'});assert.equal(editor.open,true);assert.match(editor.innerHTML,/두 사람 모두에게 공개/);
    assert.equal(await submit('diary',{text:'<script>내 일기</script>',date:'2026-10-26',mood:'♡'}),'');
    assert.match(app.innerHTML,/&lt;script&gt;내 일기&lt;\/script&gt;/);assert.doesNotMatch(app.innerHTML,/<script>내 일기/);assert.equal(editor.open,false);
    const diary=[...rows.values()].find(r=>r.data.text==='<script>내 일기</script>');
    assert.equal(await submit('diary',{text:'수정한 일기',date:'2026-10-26'},diary.id),'');assert.equal(rows.get(diary.id).data.text,'수정한 일기');
    assert.equal(await submit('post',{title:'사진 없는 추억',date:'2026-10-26',text:'우리의 기록'}),'');
    const post=[...rows.values()].find(r=>r.data.title==='사진 없는 추억');assert.ok(post);
    await click({view:'memories'});assert.match(app.innerHTML,/사진 없는 추억/);await click({action:'open-post',id:post.id});assert.match(editor.innerHTML,/둘이 나누는 이야기/);
    const commentError={textContent:''};const commentForm={id:'comment-form',dataset:{post:post.id},elements:{text:{value:'좋아!'}},querySelector:s=>s==='[type="submit"]'?{textContent:'댓글',isConnected:true}:commentError};
    await listeners.get('submit')({target:commentForm,preventDefault(){}});assert.equal(commentError.textContent,'');assert.match(editor.innerHTML,/좋아!/);
    await click({action:'close'});
    await click({view:'chat'});const input={value:'새 메시지'};const chatForm={id:'chat-form',elements:{message:input},querySelector:s=>s==='[type="submit"]'?{textContent:'보내기',isConnected:true}:null};
    await listeners.get('submit')({target:chatForm,preventDefault(){}});assert.equal(input.value,'');assert.match(app.innerHTML,/새 메시지/);assert.match(app.innerHTML,/전송됨/);
    await listeners.get('change')({target:{id:'demo-person',value:'demo-partner'}});
    assert.match(await submit('diary',{text:'몰래 수정',date:'2026-10-26'},diary.id),/작성자만/);assert.equal(rows.get(diary.id).data.text,'수정한 일기');
    const {repository}=await import('../src/backend.js');await assert.rejects(repository.remove('demo','demo-partner',diary),/작성자만/);
    const ownPost=[...rows.values()].find(r=>r.kind==='post'&&r.author_id==='demo-partner');
    await repository.save('demo','demo-me','comment',{text:'삭제 테스트 댓글',postId:ownPost.id});await repository.remove('demo','demo-partner',ownPost);
    assert.equal([...rows.values()].filter(r=>r.kind==='comment'&&r.data.postId===ownPost.id).length,0);
    await click({view:'calendar'});assert.match(app.innerHTML,/함께 채우는 달력/);assert.match(app.innerHTML,/aria-label="다음 달"/);
    await click({view:'settings'});await click({action:'google-connect'});assert.match(toast.textContent,/체험 모드에서는 외부 데이터를 변경하지/);
  }finally{globalThis.FormData=originalFormData;globalThis.setInterval=originalInterval;}
});

test('Drive 사진은 보이는 시점에 불러오고 오류·로그아웃 시 안전하게 정리한다',async()=>{
  const listeners=new Map(),values=new Map([['geonjukong-seeded','1']]);
  const row={id:'drive-post',kind:'post',author_id:'demo-me',created_at:'2026-10-26T00:00:00Z',data:{title:'Drive 사진 추억',date:'2026-10-26',files:[{id:'photo',source:'drive',type:'image/jpeg',name:'우리 사진.jpg'},{id:'denied',source:'drive',type:'image/png',name:'다른 사진.png'}]}};
  const app={innerHTML:''},toast={textContent:'',classList:{add(){},remove(){}}},editor={innerHTML:'',open:false,showModal(){this.open=true;},close(){this.open=false;},addEventListener(){}};
  let images=[],observer;
  function image(id){const fallback={hidden:false},status={textContent:''};const img={dataset:{driveFile:id},isConnected:true,hidden:true,src:''};img.parentElement={querySelector:s=>s==='img'?img:s==='.file-cover'?fallback:status};return{img,fallback,status};}
  const cover=image('photo');images=[cover.img];
  const originalObserver=globalThis.IntersectionObserver,originalInterval=globalThis.setInterval;
  const originalCreate=URL.createObjectURL,originalRevoke=URL.revokeObjectURL;const revoked=[];let created=0;
  globalThis.IntersectionObserver=class{constructor(callback){this.callback=callback;this.targets=new Set();observer=this;}observe(el){this.targets.add(el);}unobserve(el){this.targets.delete(el);}disconnect(){this.targets.clear();}show(){this.callback([...this.targets].map(target=>({target,isIntersecting:true})));}};
  globalThis.setInterval=()=>0;URL.createObjectURL=()=>`blob:private-photo-${++created}`;URL.revokeObjectURL=url=>revoked.push(url);
  globalThis.window={APP_CONFIG:{},addEventListener(){},scrollTo(){}};
  Object.defineProperty(globalThis,'navigator',{value:{},configurable:true});
  globalThis.document={querySelector:s=>({'#app':app,'#editor':editor,'#toast':toast})[s]||null,querySelectorAll:s=>s==='img[data-drive-file]'?images:[],addEventListener:(type,fn)=>listeners.set(type,fn),activeElement:{matches(){return false;}}};
  globalThis.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};globalThis.sessionStorage=globalThis.localStorage;
  globalThis.location={href:'http://localhost:4173/',origin:'http://localhost:4173',pathname:'/',hash:''};globalThis.history={replaceState(){}};
  const {local}=await import('../src/storage.js');const {google}=await import('../src/google.js');
  const originalList=local.list,originalImage=google.image;local.list=async()=>[row];
  let calls=0,release,pendingSignal;
  google.image=async(id,signal)=>{calls++;if(id==='denied')throw new Error('Forbidden');pendingSignal=signal;return new Promise(resolve=>{release=resolve;});};
  const click=dataset=>listeners.get('click')({target:{closest:()=>({dataset})}});
  const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
  try{
    await import('../src/app.js?drive-photos');
    for(let i=0;i<20&&!app.innerHTML.includes('Drive 사진 추억');i++)await tick();
    assert.match(app.innerHTML,/data-drive-file="photo"/);assert.doesNotMatch(app.innerHTML,/Drive에 보관한 순간/);assert.equal(calls,0);
    observer.show();assert.equal(calls,1);
    await click({view:'memories'});observer.show();assert.equal(calls,1);
    release(new Blob(['private photo'],{type:'image/jpeg'}));await tick();
    assert.equal(cover.img.src,'blob:private-photo-1');cover.img.onload();assert.equal(cover.img.hidden,false);assert.equal(cover.fallback.hidden,true);
    const detail=image('photo'),denied=image('denied');images=[cover.img,detail.img,denied.img];
    await click({action:'open-post',id:row.id});assert.match(editor.innerHTML,/data-drive-file="photo"/);assert.match(editor.innerHTML,/원본 열기/);
    observer.show();await tick();assert.equal(calls,2);assert.equal(detail.img.src,cover.img.src);assert.equal(denied.img.hidden,true);assert.match(denied.status.textContent,/Google을 다시 연결/);
    detail.img.onerror();assert.equal(detail.fallback.hidden,false);assert.equal(detail.img.hidden,true);assert.match(detail.status.textContent,/원본 열기/);
    images=[];await click({action:'close'});await tick();assert.deepEqual(revoked,['blob:private-photo-1']);
    const pending=image('photo');images=[pending.img];await click({view:'memories'});observer.show();assert.equal(calls,3);
    images=[];await click({action:'logout'});assert.equal(pendingSignal.aborted,true);
    release(new Blob(['late private photo'],{type:'image/jpeg'}));await tick();assert.equal(created,1);assert.equal(pending.img.src,'');
  }finally{local.list=originalList;google.image=originalImage;URL.createObjectURL=originalCreate;URL.revokeObjectURL=originalRevoke;globalThis.setInterval=originalInterval;if(originalObserver)globalThis.IntersectionObserver=originalObserver;else delete globalThis.IntersectionObserver;}
});
