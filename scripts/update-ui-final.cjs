const fs=require('fs');let s=fs.readFileSync('src/app.js','utf8');const r=(a,b)=>{if(!s.includes(a))throw Error(a);s=s.replace(a,b);};
r('repository.markNotificationRead(row.id)', 'repository.markNotificationRead(state.user,row.id)');
r('state.notificationReads=noticeReads;', 'state.notificationReads=noticeReads.map(r=>({...r,user_id:state.user}));');
r("async function navigate(view) { if (!views[view]) return; state.view = view; history.replaceState(null,'',`#${view}`);", "const viewHistory = [];\nasync function navigate(view, back = false) { if (!views[view]) return; if(!back && view !== state.view) { viewHistory.push(state.view); if(history.pushState)history.pushState({view},'',`#${view}`); } state.view = view; history.replaceState({view},'',`#${view}`);");
r("if (action === 'close') {", "if (action === 'close' && $('#record-form')?.dataset.kind === 'comment' && state.activePost) { openPost(state.records.find(r=>r.id===state.activePost),state.postScroll); return; }\n    if (action === 'close') {");
r("window.addEventListener('hashchange',()=>{const view=location.hash.slice(1);if(views[view])navigate(view).catch(report);});", `async function handleBack() {
  if(state.busy) { toast('저장이 끝날 때까지 기다려 주세요.'); return; }
  if($('#editor').open) { if($('#record-form')?.dataset.kind === 'comment' && state.activePost) openPost(state.records.find(r=>r.id===state.activePost),state.postScroll); else closeDialog(); return; }
  if(viewHistory.length) { await navigate(viewHistory.pop(),true); return; }
  if(state.view !== 'home') { await navigate('home',true); return; }
  if(confirm('앱을 종료할까요?')) { if(native.active) await native.exit(); else { toast('브라우저 메뉴에서 창을 닫을 수 있어요.'); } }
}
window.addEventListener('popstate',()=>{handleBack().catch(report);});
window.addEventListener('hashchange',()=>{const view=location.hash.slice(1);if(views[view] && view !== state.view)navigate(view,true).catch(report);});`);
r('async function boot(){', 'async function boot(){\n  await native.onBack(handleBack);');
fs.writeFileSync('src/app.js',s);
