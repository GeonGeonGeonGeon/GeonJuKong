const fs = require('fs');
let s = fs.readFileSync('src/app.js','utf8');
const replace = (a,b) => { if(!s.includes(a)) throw new Error('Missing '+a.slice(0,70)); s=s.replace(a,b); };
replace("safeFileType, eventOnDate", "safeFileType, eventOnDate, sortRecords, coupleEvents, coupleDaySummary, koreaHolidays");
replace("lastSync: null }", "lastSync: null, order: 'newest', notificationReads: [], couple: {}, activePost: null, postScroll: 0, replyTo: '' }");
replace("const navigation = { home: 'home', calendar: 'calendar', memories: 'photo', diary: 'book', chat: 'chat', settings: 'settings' };", "const navigation = { home: 'home', chat: 'chat', calendar: 'calendar', diary: 'book', memories: 'photo', settings: 'settings' };\nlabels.home = '홈'; labels.chat = '채팅'; labels.diary = '공동 공간'; labels.memories = '보관함';\npaths.bell = '<path d=\"M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4\"/>';");
replace("const events = () => state.mode === 'demo' ? records('event') : state.events;", "const events = () => [...(state.mode === 'demo' ? records('event') : state.events), ...coupleEvents(state.year, state.couple)];");
replace("const sorted = rows => [...rows].sort((a, b) => (b.data.date || b.created_at).localeCompare(a.data.date || a.created_at) || b.created_at.localeCompare(a.created_at));", "const sorted = rows => sortRecords(rows, state.order);\nconst memoriesRows = () => state.records.filter(r => r.kind === 'diary' || r.kind === 'post' && r.data.space !== 'board');\nconst postTitle = row => row.data.title || (row.kind === 'diary' ? '오늘의 일기' : '제목 없음');\nconst canEdit = row => row.author_id === state.user || row.kind === 'post' && row.data.space === 'board';\nconst notices = () => sortRecords(state.records.filter(r => ['post','diary'].includes(r.kind) && r.author_id !== state.user));\nconst noticeRead = id => state.notificationReads.some(r => r.record_id === id && r.user_id === state.user);\nconst orderControl = () => `<label class=\"sort-control\">작성일 정렬 <select id=\"post-order\"><option value=\"newest\" ${state.order === 'newest' ? 'selected' : ''}>최신순</option><option value=\"oldest\" ${state.order === 'oldest' ? 'selected' : ''}>오래된순</option></select></label>`;");
replace('<div class="topbar-right"><span', '<div class="topbar-right"><button class="icon-button notification-button" data-action="notice-list" aria-label="알림${notices().some(r => !noticeRead(r.id)) ? \", 읽지 않은 알림 있음\" : \", 모두 읽음\"}">${icon(\'bell\')}${notices().some(r => !noticeRead(r.id)) ? \'<i class="notification-dot"></i>\' : \'\'}</button><span');
replace("const recentPosts = sorted(records('post')).slice(0, 2);", "const recentPosts = sortRecords(memoriesRows()).slice(0, 2);");
replace("const latestDiary = sorted(records('diary'))[0];", "const latestDiary = sortRecords(records('diary'))[0];");
replace('data-view="diary">우리의 일기 펼치기', 'data-view="memories">우리의 일기 펼치기');
replace("const file = row.data.files?.[0];", "const file = row.data.files?.find(f => f.type?.startsWith('image/')) || row.data.files?.[0];");
s=s.replaceAll('e(row.data.title)', 'e(postTitle(row))');
replace("const list = sorted(records('post')).filter", "const list = sorted(memoriesRows()).filter");
replace("${records('post').length}</strong></span><form", "${memoriesRows().length}</strong></span>${orderControl()}<form");
replace("'지나간 하루를, 언제든 다시 꺼내 볼 수 있게.', addButton('post', '추억 남기기')", "'사진과 일기를 날짜별로 함께 보관해요.', addButton('post', '추억·일기 쓰기')");
const a=s.indexOf('function diary() {'), b=s.indexOf('function chat()',a);
s=s.slice(0,a)+`function diary() {
  const list = sorted(records('post').filter(r => r.data.space === 'board'));
  return \`\${pageTitle('OUR SHARED SPACE', '우리의 공동 게시판', '함께 쓰고 함께 수정하는 계획과 이야기. 기존 일기는 보관함에 있어요.', addButton('post', '함께 쓰기'))}<div class="list-toolbar">\${orderControl()}<button class="text-button" data-view="memories">기존 일기 보기</button></div><div class="memory-grid">\${list.map(postCard).join('') || empty('함께 할 이야기를 남겨 보세요', '두 사람 모두 게시물을 수정할 수 있어요.')}</div>\`;
}
`+s.slice(b);
replace("function closeDialog() { $('#editor').close();", "function closeDialog() { state.activePost = null; state.replyTo = ''; $('#editor').close();");
replace("const data = row?.data || {}; const title", "if (kind === 'comment') state.postScroll = $('#editor').scrollTop || 0;\n  const data = row?.data || {}; const title");
replace("${kind === 'post' ? `<label class=\"file-input\">", "${['post','diary'].includes(kind) ? `<label class=\"file-input\">");
replace("function openPost(row) {", "function openPost(row, scroll = 0) {\n  if (!row) return; state.activePost = row.id;\n");
replace("${row.author_id === state.user ? `<div class=\"post-tools\">", "${canEdit(row) ? `<div class=\"post-tools\">");
replace("<span>${e(nameOf(row.author_id))} · ${formatDate(row.data.date)}</span></div><p class=\"post-text\">", "<span>${e(nameOf(row.author_id))} · ${formatDate(row.data.date)}</span></div><p class=\"record-times\">작성 ${e(new Date(row.created_at).toLocaleString('ko-KR'))}${row.updated_at && row.updated_at !== row.created_at ? ` · 수정 ${e(new Date(row.updated_at).toLocaleString('ko-KR'))}` : ''}</p><p class=\"post-text\">");
const ca=s.indexOf("${records('comment').filter(c => c.data.postId === row.id).map"), cb=s.indexOf("</div><form id=\"comment-form\"",ca);
s=s.slice(0,ca)+"${commentList(row)}"+s.slice(cb);
replace("data-post=\"${row.id}\" class=\"comment-form\">", "data-post=\"${row.id}\" data-reply=\"${e(state.replyTo)}\" class=\"comment-form\">${state.replyTo ? '<p>답글 작성 중 <button type=\"button\" class=\"text-button\" data-action=\"cancel-reply\">취소</button></p>' : ''}");
replace("</article>`); hydrateMedia();", "</article>`); $('#editor').scrollTop = scroll; hydrateMedia();");
const at=s.indexOf('async function load(');
s=s.slice(0,at)+`function commentList(row) {
  const comments = sortRecords(records('comment').filter(c => c.data.postId === row.id), 'oldest');
  const renderComment = (c, reply = false) => \`<div class="comment \${reply ? 'reply' : ''}" id="comment-\${e(c.id)}">\${avatar(c.author_id,true)}<div><strong>\${e(nameOf(c.author_id))}</strong><p>\${e(c.data.text)}</p><small>\${timeOf(c.created_at)}\${c.updated_at && c.updated_at !== c.created_at ? ' · 수정됨' : ''}</small><button class="text-button" data-action="reply" data-id="\${c.id}">답글</button>\${c.author_id === state.user ? \`<button class="text-button" data-action="edit" data-id="\${c.id}">수정</button><button class="text-button danger" data-action="delete-comment" data-id="\${c.id}" data-post="\${row.id}">삭제</button>\` : ''}</div></div>\`;
  return comments.filter(c => !c.data.replyTo || !comments.some(p => p.id === c.data.replyTo)).map(c => renderComment(c) + comments.filter(r => r.data.replyTo === c.id).map(r => renderComment(r,true)).join('')).join('') || '<p class="muted">첫 댓글로 마음을 전해 보세요.</p>';
}
function openNotices() {
  state.activePost = null;
  dialog('알림', '<div class="notification-list">' + notices().map(r => \`<button class="notification-item \${noticeRead(r.id) ? '' : 'unread'}" data-action="notice-open" data-id="\${r.id}"><strong>\${e(postTitle(r))}</strong><span>\${e(nameOf(r.author_id))}님의 새 기록 · \${e(new Date(r.created_at).toLocaleString('ko-KR'))}</span></button>\`).join('') + (notices().length ? '' : '<p class="muted">새 알림이 없어요.</p>') + '</div>');
}
`+s.slice(at);
replace("if (!row || row.author_id !== state.user) throw", "if (!row || !canEdit(row)) throw");
replace("if (action === 'day') { state.day = button.dataset.date; render(); }", "if (action === 'day') { const repeat = state.day === button.dataset.date; state.day = button.dataset.date; render(); if (repeat) { const list = events().filter(r => eventOnDate(r,state.day) && !r.data.automatic); if (list.length === 1) openEditor('event',list[0]); else if (list.length > 1) dialog('수정할 일정 선택',eventRows(list)); else openEditor('event'); } }");
replace("if (action === 'open-post')", "if (action === 'notice-list') openNotices();\n    if (action === 'notice-open' && row) { if(state.mode === 'live') await repository.markNotificationRead(row.id); state.notificationReads.push({user_id:state.user,record_id:row.id}); if(state.mode === 'demo')localStorage.setItem('geonjukong-demo-notification-reads',JSON.stringify(state.notificationReads)); render(); state.replyTo=''; openPost(row); }\n    if (action === 'reply' && row) { state.replyTo = row.data.replyTo || row.id; openPost(state.records.find(r => r.id === row.data.postId),$('#editor').scrollTop); $('#comment-text')?.focus({preventScroll:true}); }\n    if (action === 'cancel-reply') { state.replyTo=''; openPost(state.records.find(r => r.id === state.activePost),$('#editor').scrollTop); }\n    if (action === 'open-post')");
replace("if (row) openPost(row);", "if (row) { state.replyTo=''; openPost(row); }");
replace("await repository.remove(state.mode,state.user,row); await load(); closeDialog(); render();", "const scroll = $('#editor').scrollTop || 0; await repository.remove(state.mode,state.user,row); await load(); if(action !== 'delete-comment')closeDialog(); render();");
replace("if (post) openPost(post);", "if (post) openPost(post,scroll);");
replace("if (event.target.id === 'demo-person'", "if (event.target.id === 'post-order') { state.order=event.target.value; render(); }\n  if (event.target.id === 'demo-person'");
replace("const old=state.records.find(r=>r.id===form.dataset.id); if(kind==='post') {", "const old=state.records.find(r=>r.id===form.dataset.id); if(old) Object.assign(data,{...old.data,...data});\n      if(kind==='post' && !old && state.view==='diary') data.space='board';\n      if(['post','diary'].includes(kind)) {");
replace("closeDialog(); await load(kind==='event'); render(); toast", "if(kind==='comment'){ await load(); render(); openPost(state.records.find(r=>r.id===data.postId),state.postScroll); }\n      else { closeDialog(); await load(kind==='event'); render(); } toast");
replace("await repository.save(state.mode,state.user,'comment',{text:form.elements.text.value.trim(),postId:form.dataset.post}); await load();render();openPost(state.records.find(r=>r.id===form.dataset.post));", "const scroll=$('#editor').scrollTop||0; await repository.save(state.mode,state.user,'comment',{text:form.elements.text.value.trim(),postId:form.dataset.post,...(form.dataset.reply ? {replyTo:form.dataset.reply} : {})}); state.replyTo=''; await load();render();openPost(state.records.find(r=>r.id===form.dataset.post),scroll);");
fs.writeFileSync('src/app.js',s);
