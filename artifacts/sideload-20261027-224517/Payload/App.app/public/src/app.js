import { dateKey, monthGrid, escapeHtml as e, validateRecord, safeFileType, eventOnDate } from './core.js';
import { local } from './storage.js';
import { auth, configured, repository } from './backend.js';
import { google } from './google.js';
import { native, isAuthCallback } from './platform.js';

const $ = selector => document.querySelector(selector);
const today = dateKey();
const now = new Date();
const state = { mode: 'demo', user: 'demo-me', view: 'home', year: now.getFullYear(), month: now.getMonth(), day: today, records: [], events: [], reads: [], members: [], busy: false, filter: '', error: '', lastSync: null };
const demoNames = { 'demo-me': '나', 'demo-partner': '짝꿍' };
const paths = {
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 11h18m-12 4h.01M12 15h.01M16 15h.01"/>',
  photo: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m21 15-5-5L5 21"/>',
  book: '<path d="M12 5v16M3 3c4-1 7 0 9 2 2-2 5-3 9-2v16c-4-1-7 0-9 2-2-2-5-3-9-2Z"/>',
  chat: '<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-3 2 2-7a8.5 8.5 0 1 1 18-3.5Z"/><path d="M7 11h.01M12 11h.01M17 11h.01"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="m9 3-1 3-3 1-2 3 2 3v4l4 1 3 3 3-3 4-1v-4l2-3-2-3-3-1-1-3Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  left: '<path d="m15 6-6 6 6 6"/>', right: '<path d="m9 6 6 6-6 6"/>',
  cloud: '<path d="M7 18a5 5 0 1 1 1-10 6 6 0 0 1 12 2 4 4 0 0 1-1 8Z"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>', send: '<path d="m22 2-7 20-4-9L2 9Zm0 0L11 13"/>',
  check: '<path d="m5 12 4 4L19 6"/>', download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  logout: '<path d="M9 3H4v18h5M9 12h13m-5-5 5 5-5 5"/>', search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>'
};
const icon = (name, extra = '') => `<svg class="icon ${extra}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.heart}</svg>`;
const labels = { home: '우리의 오늘', calendar: '캘린더', memories: '추억 보관함', diary: '우리의 일기', chat: '둘만의 대화', settings: '설정' };
const navigation = { home: 'home', calendar: 'calendar', memories: 'photo', diary: 'book', chat: 'chat', settings: 'settings' };
const nameOf = id => demoNames[id] || state.members.find(m => m.email === id)?.display_name || (id === state.user ? state.members.find(m => m.email === auth.user?.email)?.display_name || '나' : '짝꿍');
const formatDate = (key, options = { month: 'long', day: 'numeric', weekday: 'short' }) => new Date(`${key}T12:00:00`).toLocaleDateString('ko-KR', options);
const timeOf = iso => new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
const records = kind => state.records.filter(r => r.kind === kind);
const events = () => state.mode === 'demo' ? records('event') : state.events;
const sorted = rows => [...rows].sort((a, b) => (b.data.date || b.created_at).localeCompare(a.data.date || a.created_at) || b.created_at.localeCompare(a.created_at));
const avatar = (id, small = false) => `<span class="avatar ${id === state.user ? 'me' : 'partner'} ${small ? 'small' : ''}" aria-hidden="true">${e(nameOf(id).slice(0, 1))}</span>`;
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('visible'); clearTimeout(toast.timer); toast.timer = setTimeout(() => $('#toast').classList.remove('visible'), 4200); }
function report(error) { console.error(error.message); toast(error.message || '작업을 완료하지 못했습니다.'); }
function empty(title, text, action = '') { return `<div class="empty">${icon('heart')}<h3>${title}</h3><p>${text}</p>${action}</div>`; }
const addButton = (kind, label, cls = 'primary') => `<button class="${cls}" data-action="new" data-kind="${kind}">${icon('plus')}${label}</button>`;
function scene() { return `<svg class="together-art" viewBox="0 0 440 250" fill="none" aria-hidden="true"><circle cx="310" cy="62" r="39" fill="#efcf95"/><path d="M1 190c87-80 143-13 229-40 83-26 120-10 211 40v60H1Z" fill="#ccd2b5"/><path d="M0 221c89-21 112-53 196-26 82 26 171-41 244-1v56H0Z" fill="#93aa8b"/><path d="M327 189v-76m-17 30 17 13 18-24" stroke="#526c4f" stroke-width="3"/><ellipse cx="327" cy="106" rx="30" ry="45" fill="#6f8b66"/><path d="M106 206c-3-37 7-77 37-77s40 40 37 77" fill="#faf2dc"/><path d="M168 210c-3-30 4-64 30-64s36 34 34 64" fill="#d9a385"/><path d="M111 173c11-8 21-8 31-2m42 10c8-6 17-6 24-1" stroke="#536044" stroke-width="2" stroke-linecap="round"/><path d="m137 184 8 4-8 4m68-1 7 4-7 4" fill="#dba758"/><path d="M87 217c33-6 91 2 146-2" stroke="#647c54" stroke-width="3" stroke-linecap="round"/><path d="m242 109 5 6 5-6c12-14-17-20-10 0Z" fill="#bc715d"/><path d="M41 66c17-17 34-17 51 0m269-35c12-12 24-12 36 0" stroke="#a3ad91" stroke-width="2" stroke-linecap="round"/></svg>`; }
function unread() { const own = state.reads.find(r => r.user_id === state.user)?.last_read_at || ''; return records('message').filter(r => r.author_id !== state.user && r.created_at > own).length; }
function render() {
  const count = unread();
  $('#app').innerHTML = `<aside class="sidebar"><a class="brand" href="#home" aria-label="GeonJuKong 홈">${icon('heart')}<span>GeonJuKong<small>JUST THE TWO OF US</small></span></a><div class="sidebar-caption">우리의 작은 공간</div><nav aria-label="주 메뉴">${Object.entries(navigation).map(([view, glyph]) => `<button class="nav-item ${state.view === view ? 'active' : ''}" data-view="${view}" ${state.view === view ? 'aria-current="page"' : ''}>${icon(glyph)}<span>${labels[view]}</span>${view === 'chat' && count ? `<b class="badge">${count}</b>` : ''}</button>`).join('')}</nav><div class="sidebar-bottom"><div class="pair-avatars">${avatar(state.user)}${avatar(state.user === 'demo-me' ? 'demo-partner' : 'other')}</div><strong>우리 둘이면 충분해</strong><span>작은 순간도 오래도록.</span><div class="tiny-flower">✳</div></div></aside>
  <main><header class="topbar"><span class="breadcrumb">OUR LITTLE SPACE <span>/ ${labels[state.view]}</span></span><div class="topbar-right"><span class="connection ${state.mode === 'live' ? 'live' : ''}"><i></i>${state.mode === 'demo' ? '이 기기 체험 모드' : '둘만의 공유 공간'}</span><button class="avatar-button" data-view="settings" aria-label="내 계정 설정">${avatar(state.user, true)}</button></div></header><div class="page"><div class="demo-banner ${state.mode === 'live' ? 'live-banner' : ''}">${icon(state.mode === 'demo' ? 'cloud' : 'check')}<span>${state.mode === 'demo' ? '체험 기록은 이 브라우저에만 저장돼요. 두 기기에서 함께 쓰려면 계정을 연결해 주세요.' : `두 사람에게만 공개되는 공간이에요.${state.lastSync ? ` · ${timeOf(state.lastSync)} 동기화` : ''}`}</span><button data-view="settings">${state.mode === 'demo' ? '연결 설정' : '관리'} ${icon('right')}</button></div>${state.error ? `<div class="error-banner" role="alert">${e(state.error)} <button data-action="refresh">다시 시도</button></div>` : ''}${views[state.view]()}</div><footer class="footer">GeonJuKong <span>소중한 건, 함께한 시간.</span><span class="footer-heart">♡</span></footer></main>`;
  hydrateMedia();
  if (state.view === 'chat') { const list = $('#messages'); if (list) list.scrollTop = list.scrollHeight; }
}
function pageTitle(eyebrow, title, description, action = '') { return `<div class="page-heading"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p class="subtitle">${description}</p></div>${action}</div>`; }
function eventRows(list) { return list.map(row => `<div class="event-row"><span class="event-time">${e(row.data.time || '하루 종일')}</span><span class="event-line"></span><div><strong>${e(row.data.title)}</strong>${row.data.text ? `<p>${e(row.data.text)}</p>` : ''}</div><button class="icon-button" data-action="edit-event" data-id="${e(row.id)}" aria-label="${e(row.data.title)} 일정 보기">${icon('right')}</button></div>`).join(''); }
function home() {
  const upcoming = events().filter(r => r.data.date >= today).sort((a,b) => `${a.data.date}${a.data.time}`.localeCompare(`${b.data.date}${b.data.time}`)).slice(0, 3);
  const recentPosts = sorted(records('post')).slice(0, 2);
  const latestDiary = sorted(records('diary'))[0];
  return `${pageTitle('A DAY WITH YOU', '오늘도, 단둘이', `${formatDate(today)} · 평범한 하루도 우리에겐 특별하니까.`)}<section class="hero"><div class="hero-copy"><span class="pill">OUR DAYS, OUR STORY</span><h2>같이 보낸 하루가<br>우리의 이야기가 돼.</h2><p>약속을 나누고, 마음을 적고,<br>오래 기억하고 싶은 순간을 모아요.</p>${addButton('post', '오늘의 순간 남기기')}</div>${scene()}<span class="hero-note">a little moment, a lasting memory</span></section>
  <div class="home-grid"><section class="card schedule-card"><div class="section-heading"><h2>${icon('calendar')}다가오는 약속</h2><button class="text-button" data-view="calendar">캘린더 ${icon('right')}</button></div>${state.mode === 'live' && !google.connected ? empty('일정을 연결해 볼까요?', '설정에서 Google을 연결하면 공유 일정이 보여요.') : upcoming.length ? upcoming.map(r => `<div class="upcoming-date">${formatDate(r.data.date)}${eventRows([r])}</div>`).join('') : empty('아직 정해진 약속이 없어요', '함께하고 싶은 하루를 남겨 보세요.', addButton('event', '약속 추가', 'secondary'))}</section>
  <section class="card diary-card"><div class="section-heading"><h2>${icon('book')}마음을 꺼내는 시간</h2><span class="tag">둘에게 공개</span></div>${latestDiary ? `<p class="diary-quote">“${e(latestDiary.data.text.slice(0, 115))}${latestDiary.data.text.length > 115 ? '…' : ''}”</p><div class="byline">${avatar(latestDiary.author_id, true)}<span>${e(nameOf(latestDiary.author_id))} · ${formatDate(latestDiary.data.date, { month: 'long', day: 'numeric' })}</span></div>` : `<p class="diary-quote">오늘은 어떤 마음이었나요?<br>서로의 하루를 조금 더 가까이.</p>`}<button class="text-button diary-link" data-view="diary">우리의 일기 펼치기 ${icon('arrow')}</button></section></div>
  <section class="memories-section"><div class="section-heading"><h2>차곡차곡, 우리의 순간</h2><button class="text-button" data-view="memories">모두 보기 ${icon('right')}</button></div><div class="memory-grid">${recentPosts.length ? recentPosts.map(postCard).join('') : empty('첫 번째 추억을 기다려요', '사진 한 장과 짧은 이야기로 시작해 보세요.', addButton('post', '추억 남기기'))}</div></section>`;
}
function calendar() {
  const grid = monthGrid(state.year, state.month); const items = events();
  const dayEvents = items.filter(r => eventOnDate(r, state.day)).sort((a,b) => (a.data.time || '').localeCompare(b.data.time || ''));
  const dayDiaries = records('diary').filter(r => r.data.date === state.day);
  const dayPosts = records('post').filter(r => r.data.date === state.day);
  return `${pageTitle('OUR SHARED DAYS', '함께 채우는 달력', '약속도, 마음도. 같은 날짜에 나란히.', addButton('event', '약속 추가'))}<div class="calendar-layout"><section class="card calendar-card"><div class="month-heading"><h2>${state.year}년 <strong>${state.month + 1}월</strong></h2><div><button class="text-button" data-action="today">오늘</button><button class="icon-button" data-action="month" data-offset="-1" aria-label="이전 달">${icon('left')}</button><button class="icon-button" data-action="month" data-offset="1" aria-label="다음 달">${icon('right')}</button></div></div><div class="calendar-week">${['일','월','화','수','목','금','토'].map(d => `<span>${d}</span>`).join('')}</div><div class="calendar-grid">${grid.map(d => { const ev = items.filter(r => eventOnDate(r, d.key)); const diary = records('diary').some(r => r.data.date === d.key); return `<button class="calendar-day ${d.current ? '' : 'outside'} ${d.key === state.day ? 'selected' : ''} ${d.key === today ? 'today' : ''}" data-action="day" data-date="${d.key}" aria-label="${formatDate(d.key)} 일정 ${ev.length}개${diary ? ', 일기 있음' : ''}" aria-pressed="${d.key === state.day}"><span>${d.day}</span><div class="day-markers">${ev.slice(0, 2).map(r => `<small>${e(r.data.title)}</small>`).join('')}${ev.length > 2 ? `<small>+${ev.length - 2}</small>` : ''}${diary ? '<i class="diary-dot"></i>' : ''}</div></button>`; }).join('')}</div><div class="calendar-legend"><span><i></i>우리의 일정</span><span><i></i>우리의 일기</span>${state.mode === 'live' ? '<span>Google Calendar</span>' : '<span>체험 캘린더</span>'}</div></section><aside class="card date-detail"><p class="eyebrow">ON THIS DAY</p><h2>${formatDate(state.day)}</h2><h3>우리의 약속 <span>${dayEvents.length}</span></h3>${dayEvents.length ? eventRows(dayEvents) : '<p class="muted">아직 약속이 없는 날이에요.</p>'}<button class="full-width secondary" data-action="new" data-kind="event">${icon('plus')}이날 약속 추가</button><div class="divider"></div><h3>이날의 일기 <span>${dayDiaries.length}</span></h3>${dayDiaries.map(r => `<div class="day-diary">${avatar(r.author_id, true)}<p>${e(r.data.text.slice(0,100))}</p></div>`).join('') || '<p class="muted">짧은 마음 한 줄을 남겨 볼까요?</p>'}<button class="text-button" data-action="new" data-kind="diary">${icon('plus')}일기 쓰기</button>${dayPosts.length ? `<div class="divider"></div><h3>이날의 추억</h3>${dayPosts.map(r => `<button class="text-button" data-action="open-post" data-id="${r.id}">${e(r.data.title)} ${icon('right')}</button>`).join('')}` : ''}</aside></div>`;
}
function drivePhoto(file, alt) {
  return `<div class="photo-preview"><div class="file-cover">${icon('photo')}<span data-preview-status>${google.connected ? '사진을 불러오는 중…' : 'Google 연결 후 사진을 볼 수 있어요.'}</span><small>${e(file.name)}</small></div><img data-drive-file="${e(file.id)}" alt="${e(alt)}" decoding="async" hidden></div>`;
}
function postCard(row) {
  const file = row.data.files?.[0];
  return `<article class="memory-card"><button class="memory-cover ${file ? '' : 'illustrated-cover'}" data-action="open-post" data-id="${row.id}" aria-label="${e(row.data.title)} 게시글 열기">${file ? file.type.startsWith('image/') ? file.source === 'local' ? `<img data-file="${e(file.id)}" alt="${e(row.data.title)}" loading="lazy">` : drivePhoto(file,row.data.title) : `<div class="file-cover">${icon(file.type.startsWith('video/') ? 'photo' : 'cloud')}<span>${file.type.startsWith('video/') ? '우리의 영상' : 'Drive에 보관한 순간'}</span><small>${e(file.name)}</small></div>` : `<div class="paper-drawing">${icon('heart')}<span>${row.data.art === 'walk' ? 'a walk with you' : 'little things, big love'}</span><div class="drawing-hills"></div></div>`}${row.data.files?.length ? `<span class="file-count">${icon('photo')}${row.data.files.length}</span>` : ''}</button><div class="memory-info"><p class="memory-date">${formatDate(row.data.date, { year:'numeric',month:'2-digit',day:'2-digit' })}</p><button class="title-button" data-action="open-post" data-id="${row.id}"><h3>${e(row.data.title)}</h3></button><p class="memory-excerpt">${e(row.data.text || '함께한 순간을 간직해요.')}</p><div class="memory-meta"><span>${avatar(row.author_id, true)}${e(nameOf(row.author_id))}</span><span>${icon('chat')}${records('comment').filter(c => c.data.postId === row.id).length}</span></div></div></article>`;
}
function memories() {
  const list = sorted(records('post')).filter(r => `${r.data.title} ${r.data.text}`.toLowerCase().includes(state.filter.toLowerCase()));
  return `${pageTitle('COLLECTING LITTLE MOMENTS', '우리의 추억 보관함', '지나간 하루를, 언제든 다시 꺼내 볼 수 있게.', addButton('post', '추억 남기기'))}<div class="list-toolbar"><span>소중한 순간 <strong>${records('post').length}</strong></span><form id="search-form" class="search">${icon('search')}<input name="search" aria-label="추억 검색" placeholder="어떤 순간을 찾고 있나요?" value="${e(state.filter)}"><button type="submit" class="text-button">검색</button></form></div><div class="memory-grid all-memories">${list.length ? list.map(postCard).join('') : empty(state.filter ? '찾는 추억이 없어요' : '첫 추억을 남겨 보세요', state.filter ? '다른 단어로 찾아보세요.' : '사진, 동영상과 함께 우리의 이야기를 보관해요.', state.filter ? '' : addButton('post', '추억 남기기'))}</div>`;
}
function diary() {
  return `${pageTitle('WORDS FROM THE HEART', '너의 하루, 나의 마음', '말로 다 하지 못한 마음까지. 우리 둘에게 공개되는 일기예요.', addButton('diary', '오늘의 일기'))}<div class="diary-grid">${sorted(records('diary')).map(row => `<article class="card journal"><div class="journal-heading"><span class="mood">${e(row.data.mood || '☀')}</span><span>${formatDate(row.data.date, {year:'numeric',month:'long',day:'numeric',weekday:'short'})}</span><span class="tag">함께 읽는 일기</span></div><p class="journal-text">${e(row.data.text)}</p><div class="journal-footer"><div class="byline">${avatar(row.author_id,true)}<span>${e(nameOf(row.author_id))}의 하루</span></div>${row.author_id === state.user ? `<div><button class="text-button" data-action="edit" data-id="${row.id}">수정</button><button class="text-button danger" data-action="delete" data-id="${row.id}">삭제</button></div>` : ''}</div></article>`).join('') || empty('오늘의 마음을 들려주세요', '일기는 우리 두 사람만 읽을 수 있어요.', addButton('diary', '일기 쓰기'))}</div>`;
}
function chat() {
  const list = records('message').sort((a,b) => a.created_at.localeCompare(b.created_at)); let day = '';
  const partnerRead = state.reads.find(r => r.user_id !== state.user)?.last_read_at || '';
  return `${pageTitle('JUST BETWEEN US', '둘만의 대화', '별것 아닌 이야기라도, 너라서 좋아.')}<section class="card chat-card"><div class="chat-header"><div class="pair-avatars">${avatar(state.user,true)}${avatar(state.user === 'demo-me' ? 'demo-partner' : 'other',true)}</div><div><strong>우리 둘의 이야기</strong><p>${state.mode === 'demo' ? '체험 대화 · 실제 상대에게 전송되지 않아요' : '5초마다 새 메시지 확인 · 잠금 화면 알림은 설정 필요'}</p></div></div><div id="messages" class="messages" aria-label="대화 기록" aria-live="polite">${list.map(r => { const key = dateKey(new Date(r.created_at)); const separator = day !== key ? `<div class="chat-date">${formatDate(key)}</div>` : ''; day = key; const own = r.author_id === state.user; return `${separator}<div class="message ${own ? 'own' : ''}">${own ? '' : avatar(r.author_id,true)}<div>${own ? '' : `<span class="message-name">${e(nameOf(r.author_id))}</span>`}<div class="bubble">${e(r.data.text)}</div><span class="message-time">${timeOf(r.created_at)} ${own ? r.created_at <= partnerRead ? '· 읽음' : '· 전송됨' : ''}</span></div></div>`; }).join('') || empty('첫 인사를 건네 보세요', '둘만의 대화가 여기 쌓일 거예요.')}</div><form id="chat-form" class="chat-compose"><textarea name="message" rows="1" maxlength="10000" placeholder="너에게 하고 싶은 말…" aria-label="메시지" required></textarea><button class="primary icon-button" type="submit" aria-label="메시지 보내기">${icon('send')}</button></form></section>`;
}
function settings() {
  const cfg = window.APP_CONFIG;
  return `${pageTitle('MAKE OURSELVES AT HOME', '우리의 공간 설정', '연결은 간단하게, 소중한 기록은 안전하게.')}<div class="settings-grid"><section class="card settings-card"><div class="section-heading"><h2>${icon('heart')}우리의 계정</h2><span class="tag">${state.mode === 'demo' ? '체험 중' : '연결됨'}</span></div><p>${state.mode === 'demo' ? '지금은 이 브라우저에서 기능을 체험하고 있어요. 체험 기록과 실제 공유 기록은 따로 보관해요.' : `${e(auth.user?.email)} 계정으로 로그인했어요. 서버에서 허용한 두 계정만 기록을 볼 수 있어요.`}</p>${state.mode === 'demo' ? `<button class="primary" data-action="login">Google로 로그인</button><p class="setting-hint">${configured ? '설정된 Supabase에 로그인합니다.' : '먼저 README의 안내에 따라 config.js와 서버를 설정해 주세요.'}</p><div class="divider"></div><label for="demo-person">체험할 사람</label><select id="demo-person"><option value="demo-me" ${state.user === 'demo-me' ? 'selected' : ''}>나</option><option value="demo-partner" ${state.user === 'demo-partner' ? 'selected' : ''}>짝꿍</option></select><p class="setting-hint">상대방으로 바꿔 댓글과 메시지, 작성자 권한을 확인할 수 있어요.</p>` : `<button class="secondary" data-action="logout">${icon('logout')}로그아웃</button>`}</section>
  <section class="card settings-card"><div class="section-heading"><h2>${icon('calendar')}Google 연결</h2><span class="tag">${google.connected ? '연결됨' : '연결 전'}</span></div><p>공유 캘린더의 일정을 함께 관리하고, 사진과 영상의 원본을 Drive에 보관해요.</p><button class="primary" data-action="google-connect">${icon('cloud')}${google.connected ? 'Google 다시 연결' : 'Google 연결하기'}</button><div class="status-list"><span>공유 캘린더 ID <b>${cfg.calendarId ? '설정됨' : '설정 필요'}</b></span><span>공유 Drive 폴더 <b>${cfg.driveFolderId ? '설정됨' : '설정 필요'}</b></span><span>폴더 접근 확인 <button class="text-button" data-action="pick-folder">폴더 선택</button></span></div><p class="setting-hint">두 사람 모두 같은 폴더를 선택해 접근을 허용해야 해요. 연결은 만료 시 다시 동의하며, Google 비밀번호는 저장하지 않아요.</p></section>
  <section class="card settings-card"><div class="section-heading"><h2>${icon('home')}${native.active ? '설치형 GeonJuKong 앱' : '홈 화면에 설치'}</h2></div>${native.active ? '<p>휴대폰에 설치한 GeonJuKong 앱을 사용 중이에요. 앱 화면은 기기에 포함되어 있어 별도 웹페이지를 열지 않아도 돼요.</p><p class="setting-hint">공유 기록과 Google 연동에는 인터넷 연결이 필요해요. 새 버전은 새 설치 파일로 업데이트해 주세요.</p>' : '<p><strong>아이폰 14</strong><br>Safari에서 열기 → 공유 메뉴 → 홈 화면에 추가</p><p><strong>갤럭시 S23 울트라</strong><br>Chrome 메뉴 → 홈 화면에 추가 또는 앱 설치</p><p class="setting-hint">휴대폰 웹앱에서는 HTTPS 주소가 필요해요. 설치형 버전은 Android·iOS 빌드로 만들 수 있어요.</p><button class="secondary" data-action="install">설치 안내</button>'}</section>
  <section class="card settings-card"><div class="section-heading"><h2>${icon('chat')}대화 알림</h2></div><p>${native.active ? '앱을 열어 두면 새 메시지를 5초마다 확인해요. 설치형 앱의 잠금 화면 알림은 아직 연결되지 않았어요.' : '앱을 열어 두면 새 메시지를 5초마다 확인해요. 잠금 화면 알림은 서버의 Web Push 설정 후 켤 수 있어요.'}</p>${native.active ? '<p class="setting-hint">잠금 화면 알림을 사용하려면 Android FCM·iOS APNs 설정과 네이티브 푸시 연동이 필요해요.</p>' : '<button class="secondary" data-action="notifications">이 기기에서 알림 켜기</button><p class="setting-hint">아이폰은 iOS 16.4 이상에서 홈 화면에 설치한 뒤 허용해 주세요. 알림에는 대화 내용을 표시하지 않아요.</p>'}</section>
  <section class="card settings-card wide"><div class="section-heading"><h2>${icon('download')}기록 보관과 백업</h2></div><p>글·일정·일기·댓글·메시지와 파일 목록을 JSON으로 내려받아요. 사진·영상 원본은 포함되지 않으므로 ${state.mode === 'demo' ? '체험 파일을 원본 열기로 따로 저장해 주세요.' : 'Google Drive에서도 별도로 백업해 주세요.'}</p><div class="button-row"><button class="secondary" data-action="export">${icon('download')}기록 내보내기</button>${state.mode === 'demo' ? '<button class="text-button danger" data-action="reset">체험 데이터 초기화</button>' : '<button class="text-button" data-action="refresh">지금 동기화</button>'}</div><p class="setting-hint">원본은 게시글을 삭제해도 유지해요. Drive에서 파일을 직접 삭제하면 게시글에서도 열 수 없어요.</p></section></div>`;
}
const views = { home, calendar, memories, diary, chat, settings };
const urls = new Map();
const driveUrls = new Map();
const driveLoads = new Map();
const driveObserver = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
  for (const entry of entries) if (entry.isIntersecting) { driveObserver.unobserve(entry.target); loadDriveImage(entry.target.querySelector('img')); }
}, { rootMargin: '200px' }) : null;
function clearDriveImages() {
  driveObserver?.disconnect();
  for (const job of driveLoads.values()) job.controller.abort();
  driveLoads.clear();
  for (const url of driveUrls.values()) URL.revokeObjectURL(url);
  driveUrls.clear();
}
async function driveImageUrl(id) {
  if (driveUrls.has(id)) return driveUrls.get(id);
  let job = driveLoads.get(id);
  if (!job) {
    job = { controller: new AbortController() }; driveLoads.set(id, job);
    job.promise = google.image(id, job.controller.signal).then(blob => {
      if (driveLoads.get(id) !== job) throw new DOMException('사진 요청이 취소됐어요.', 'AbortError');
      const url = URL.createObjectURL(blob); driveUrls.set(id, url); return url;
    }).finally(() => { if (driveLoads.get(id) === job) driveLoads.delete(id); });
  }
  return job.promise;
}
async function loadDriveImage(img) {
  const fallback = img.parentElement.querySelector('.file-cover');
  const status = img.parentElement.querySelector('[data-preview-status]');
  img.onload = () => { if (img.isConnected) { img.hidden = false; fallback.hidden = true; } };
  img.onerror = () => { img.hidden = true; fallback.hidden = false; status.textContent = '이 사진은 원본 열기로 확인해 주세요.'; };
  try {
    const url = await driveImageUrl(img.dataset.driveFile);
    if (img.isConnected && driveUrls.get(img.dataset.driveFile) === url) img.src = url;
  } catch {
    if (img.isConnected) status.textContent = google.connected ? '사진을 불러오지 못했어요. 원본 열기를 이용해 주세요.' : '설정에서 Google을 다시 연결해 주세요.';
  }
}
async function hydrateMedia() {
  for (const img of document.querySelectorAll('img[data-file], video[data-file]')) {
    try { if (!urls.has(img.dataset.file)) { const file = await local.file(img.dataset.file); if (file) urls.set(img.dataset.file, URL.createObjectURL(file.blob)); } if (img.isConnected && urls.has(img.dataset.file)) img.src = urls.get(img.dataset.file); } catch { /* 파일을 읽지 못해도 다른 기록을 표시합니다. */ }
  }
  driveObserver?.disconnect();
  const images = [...document.querySelectorAll('img[data-drive-file]')];
  const visible = new Set(images.map(img => img.dataset.driveFile));
  for (const [id, url] of driveUrls) if (!visible.has(id)) { URL.revokeObjectURL(url); driveUrls.delete(id); }
  for (const [id, job] of driveLoads) if (!visible.has(id)) { job.controller.abort(); driveLoads.delete(id); }
  for (const img of images) if (!img.src) {
    if (driveObserver) driveObserver.observe(img.parentElement);
    else loadDriveImage(img);
  }
}
function closeDialog() { $('#editor').close(); $('#editor').innerHTML = ''; hydrateMedia(); }
function dialog(title, content) { const el = $('#editor'); el.innerHTML = `<div class="modal-heading"><h2 id="dialog-title">${title}</h2><button class="icon-button" data-action="close" aria-label="닫기">${icon('close')}</button></div>${content}`; if (!el.open) el.showModal(); }
function openEditor(kind, row) {
  if (kind === 'event' && state.mode === 'live' && !google.connected) { toast('설정에서 Google을 먼저 연결해 주세요.'); state.view = 'settings'; render(); return; }
  const data = row?.data || {}; const title = {event:'우리의 약속',diary:'오늘의 마음',post:'추억 남기기',comment:'댓글 수정'}[kind];
  let end = data.end?.dateTime ? new Date(data.end.dateTime) : null;
  let endDate = data.end?.date ? new Date(`${data.end.date}T12:00:00`) : null; if (endDate) endDate.setDate(endDate.getDate() - 1);
  dialog(title, `<form id="record-form" data-kind="${kind}" data-id="${row?.id || ''}">${kind !== 'comment' ? `<label>날짜<input type="date" name="date" value="${e(data.date || (state.view === 'calendar' ? state.day : today))}" required></label>` : `<input type="hidden" name="postId" value="${e(data.postId)}">`}${['event','post'].includes(kind) ? `<label>제목<input name="title" value="${e(data.title || '')}" maxlength="120" placeholder="어떤 순간인가요?" required></label>` : ''}${kind === 'event' ? `<div class="form-row"><label>시작 시간 <span class="optional">비우면 하루 종일</span><input name="time" type="time" value="${e(data.time || '')}"></label><label>종료 날짜<input name="endDate" type="date" value="${end ? dateKey(end) : endDate ? dateKey(endDate) : data.date || (state.view === 'calendar' ? state.day : today)}"></label><label>종료 시간<input name="endTime" type="time" value="${end ? `${String(end.getHours()).padStart(2,'0')}:${String(end.getMinutes()).padStart(2,'0')}` : ''}"></label></div>` : ''}${kind === 'diary' ? `<label>오늘의 마음<select name="mood">${['☀','☁','☂','♡','✦'].map(m => `<option ${data.mood === m ? 'selected' : ''}>${m}</option>`).join('')}</select></label><p class="form-note">${icon('heart')}이 일기는 두 사람 모두에게 공개돼요.</p>` : ''}<label>${kind === 'event' ? '메모' : '이야기'}<textarea name="text" rows="${kind === 'event' ? 3 : 6}" maxlength="10000" placeholder="오늘을 기억할 작은 이야기…" ${['diary','comment'].includes(kind) ? 'required' : ''}>${e(data.text || '')}</textarea></label>${kind === 'post' ? `<label class="file-input">${icon('photo')}사진·동영상 원본 추가<input type="file" name="files" accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,image/avif,video/mp4,video/quicktime,video/webm,video/3gpp" multiple></label><p id="file-summary" class="setting-hint">${data.files?.length ? `기존 파일 ${data.files.length}개는 유지됩니다. ` : ''}${state.mode === 'demo' ? '원본은 이 브라우저에 저장돼요. 브라우저 데이터를 지우면 삭제돼요.' : '원본을 공유 Drive 폴더에 보관해요. 전송 중 이 화면을 열어 두세요.'}</p>` : ''}<p id="form-error" class="form-error" role="alert"></p><div class="modal-actions">${kind === 'event' && row ? `<button class="text-button danger" type="button" data-action="delete-event" data-id="${row.id}">일정 삭제</button>` : ''}<button type="button" class="secondary" data-action="close">취소</button><button type="submit" class="primary">${row ? '수정 저장' : '기록하기'}</button></div></form>`);
}
function openPost(row) {
  dialog(e(row.data.title), `<article class="post-detail"><div class="byline">${avatar(row.author_id,true)}<span>${e(nameOf(row.author_id))} · ${formatDate(row.data.date)}</span></div><p class="post-text">${e(row.data.text || '')}</p><div class="attachments">${(row.data.files || []).map(file => `<div class="attachment">${file.source === 'local' ? file.type.startsWith('image/') ? `<img data-file="${file.id}" alt="${e(file.name)}">` : `<video controls playsinline preload="metadata" data-file="${file.id}" aria-label="${e(file.name)}"></video>` : file.type.startsWith('image/') ? drivePhoto(file,file.name) : `<div class="drive-attachment">${icon('cloud')}<strong>${e(file.name)}</strong><span>Google Drive · 원본 보관</span></div>`}<button class="secondary" data-action="open-file" data-id="${e(file.id)}" data-source="${file.source}">${icon('download')}원본 열기</button></div>`).join('')}</div>${row.author_id === state.user ? `<div class="post-tools"><button class="text-button" data-action="edit" data-id="${row.id}">게시글 수정</button><button class="text-button danger" data-action="delete" data-id="${row.id}">삭제</button></div>` : ''}<div class="divider"></div><h3>둘이 나누는 이야기 <span class="muted">${records('comment').filter(c => c.data.postId === row.id).length}</span></h3><div class="comments">${records('comment').filter(c => c.data.postId === row.id).map(c => `<div class="comment">${avatar(c.author_id,true)}<div><strong>${e(nameOf(c.author_id))}</strong><p>${e(c.data.text)}</p><small>${timeOf(c.created_at)}</small>${c.author_id === state.user ? `<button class="text-button" data-action="edit" data-id="${c.id}">수정</button><button class="text-button danger" data-action="delete-comment" data-id="${c.id}" data-post="${row.id}">삭제</button>` : ''}</div></div>`).join('') || '<p class="muted">첫 댓글로 마음을 전해 보세요.</p>'}</div><form id="comment-form" data-post="${row.id}" class="comment-form"><label class="sr-only" for="comment-text">댓글</label><textarea id="comment-text" name="text" rows="2" maxlength="10000" required placeholder="이 순간에 마음 한 줄…"></textarea><button type="submit" class="primary">댓글 남기기</button><p class="form-error" role="alert"></p></form></article>`); hydrateMedia();
}
async function load(refreshGoogle = false) {
  if (state.mode === 'demo') state.records = await local.list();
  else { const [rows, reads] = await Promise.all([repository.list(), repository.readAt()]); state.records = rows; state.reads = reads; if (refreshGoogle && google.connected) state.events = await google.events(state.year,state.month); }
  state.error = ''; state.lastSync = new Date().toISOString();
}
async function markRead() {
  if (state.mode === 'demo') { const read = {user_id:state.user,last_read_at:new Date().toISOString()}; state.reads = state.reads.filter(r => r.user_id !== state.user).concat(read); localStorage.setItem('geonjukong-demo-reads',JSON.stringify(state.reads)); }
  else { const result = await repository.markRead(state.user); if(result?.[0])state.reads = state.reads.filter(r => r.user_id !== state.user).concat(result[0]); }
}
async function navigate(view) { if (!views[view]) return; state.view = view; history.replaceState(null,'',`#${view}`); if (view === 'chat') await markRead(); render(); window.scrollTo({top:0,behavior:'instant'}); }
function requireLive() { if (state.mode !== 'live') throw new Error('실제 연동은 Google 로그인과 서버 설정 후 사용할 수 있어요. 체험 모드에서는 외부 데이터를 변경하지 않아요.'); }
let installPrompt;
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; });
document.addEventListener('click', async event => {
  const button = event.target.closest('button, a[data-action]'); if (!button) return;
  try {
    if (button.dataset.view) { await navigate(button.dataset.view); return; }
    const action = button.dataset.action; const row = state.records.find(r => r.id === button.dataset.id);
    if (action === 'new') openEditor(button.dataset.kind);
    if (action === 'close') { if (state.busy) throw new Error('저장이 끝날 때까지 기다려 주세요.'); closeDialog(); }
    if (action === 'reload') location.reload();
    if (action === 'edit') { if (!row || row.author_id !== state.user) throw new Error('작성자만 수정할 수 있어요.'); openEditor(row.kind,row); }
    if (action === 'day') { state.day = button.dataset.date; render(); }
    if (action === 'month' || action === 'today') {
      const target = action === 'today' ? new Date() : new Date(state.year,state.month + Number(button.dataset.offset),1);
      state.year = target.getFullYear(); state.month = target.getMonth(); state.day = action === 'today' ? today : dateKey(target);
      if (state.mode === 'live' && google.connected) { state.events = []; render(); state.events = await google.events(state.year,state.month); } render();
    }
    if (action === 'edit-event') { const record = events().find(r => r.id === button.dataset.id); if (record) openEditor('event',record); }
    if (action === 'delete-event') {
      const record = events().find(r => r.id === button.dataset.id); if (!record) return;
      if (!confirm('이 약속을 삭제할까요? Google 연동 중이면 공유 캘린더에서도 삭제돼요.')) return;
      if (state.mode === 'demo') await repository.remove('demo',state.user,record); else await google.deleteEvent(record.id);
      closeDialog(); await load(true); render(); toast('약속을 삭제했어요.');
    }
    if (action === 'open-post') { if (row) openPost(row); }
    if (action === 'delete' || action === 'delete-comment') {
      if (!row || !confirm(row.kind === 'post' ? '게시글과 댓글을 삭제할까요? 사진·영상 원본은 유지돼요.' : '이 기록을 삭제할까요?')) return;
      await repository.remove(state.mode,state.user,row); await load(); closeDialog(); render();
      if (action === 'delete-comment') { const post = state.records.find(r => r.id === button.dataset.post); if (post) openPost(post); } toast('기록을 삭제했어요.');
    }
    if (action === 'open-file') {
      if (button.dataset.source === 'drive') await google.openFile(button.dataset.id);
      else { const stored = await local.file(button.dataset.id); if (!stored) throw new Error('이 기기에서 원본을 찾을 수 없어요.'); if(native.active){await native.saveFile(stored.blob,stored.blob.name||'original');return;} const link = document.createElement('a'); link.href = URL.createObjectURL(stored.blob); link.download = stored.blob.name || 'original'; link.click(); setTimeout(() => URL.revokeObjectURL(link.href),10000); }
    }
    if (action === 'login') { button.disabled = true; try { await auth.login(); } finally { button.disabled = false; } }
    if (action === 'logout') {
      if(state.mode==='live'&&'serviceWorker'in navigator){const registration=await navigator.serviceWorker.getRegistration();const subscription=await registration?.pushManager?.getSubscription();if(subscription){await repository.unsubscribe(subscription.endpoint);await subscription.unsubscribe();}}
      await auth.logout(); google.disconnect(); clearDriveImages(); state.records=[]; state.events=[]; state.members=[]; state.reads=[]; state.mode='demo'; state.user='demo-me'; await seed(); await load(); render();
    }
    if (action === 'google-connect') { requireLive(); if(native.active){await auth.login();return;} await google.connect(auth.user.email); await load(true); render(); toast('Google을 연결했어요. 이제 공유 일정을 확인할 수 있어요.'); }
    if (action === 'pick-folder') { requireLive(); const folder = await google.pickFolder(); if (folder.id !== window.APP_CONFIG.driveFolderId) throw new Error(`선택한 폴더 ID: ${folder.id}. 공용 폴더가 맞다면 config.js의 driveFolderId를 이 값으로 설정해 주세요.`); await google.checkFolder(); toast('공유 Drive 폴더 접근을 확인했어요.'); }
    if (action === 'refresh') { button.disabled=true; try { await load(true); render(); toast('최신 기록을 불러왔어요.'); } finally { button.disabled=false; } }
    if (action === 'export') { const payload = { app:'GeonJuKong',version:1,exportedAt:new Date().toISOString(),mode:state.mode,records:state.records,calendar:events(),notice:'파일 목록만 포함됩니다. 원본 파일은 별도로 백업해 주세요.' }; if(native.active){await native.saveFile(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),`GeonJuKong-${today}.json`);return;} const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'})); const link=document.createElement('a');link.href=url;link.download=`GeonJuKong-기록-${today}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),10000); }
    if (action === 'reset') { if (!confirm('이 브라우저의 체험 기록과 원본 파일을 모두 지우고 예시 기록으로 초기화할까요? 실제 공유 데이터에는 영향이 없어요.')) return; await local.clear(); localStorage.removeItem('geonjukong-seeded'); localStorage.removeItem('geonjukong-demo-reads'); for (const url of urls.values()) URL.revokeObjectURL(url); urls.clear(); state.reads=[]; await seed(); await load(); render(); toast('체험 데이터를 초기화했어요.'); }
    if (action === 'install') { if(native.active){toast('설치형 GeonJuKong 앱을 사용하고 있어요.');return;} if (installPrompt) { await installPrompt.prompt(); installPrompt = null; } else toast('아이폰: Safari 공유 → 홈 화면에 추가 / 갤럭시: Chrome 메뉴 → 앱 설치'); }
    if (action === 'notifications') await enableNotifications();
  } catch (error) { report(error); }
});
$('#editor').addEventListener('cancel', event => { if(state.busy)event.preventDefault(); });
document.addEventListener('change', event => {
  if (event.target.id === 'demo-person' && state.mode === 'demo') { state.user=event.target.value; localStorage.setItem('geonjukong-demo-person',state.user); render(); }
  if (event.target.name === 'files') $('#file-summary').textContent = `${event.target.files.length}개 선택 · ${[...event.target.files].reduce((n,f)=>n+f.size,0)/1024/1024 < 1 ? '1MB 미만' : `${Math.round([...event.target.files].reduce((n,f)=>n+f.size,0)/1024/1024)}MB`} · 원본으로 저장해요.`;
});
document.addEventListener('submit', async event => {
  const form=event.target; if(!['record-form','chat-form','comment-form','search-form'].includes(form.id))return;
  event.preventDefault(); if(state.busy)return;
  if(form.id==='search-form'){state.filter=new FormData(form).get('search').trim();render();return;}
  const submit=form.querySelector('[type="submit"]'); const original=submit.textContent; state.busy=true; submit.disabled=true;
  const errorBox=form.querySelector('.form-error'); if(errorBox)errorBox.textContent='';
  try {
    if(form.id==='record-form') {
      const kind=form.dataset.kind; const data=Object.fromEntries(new FormData(form)); delete data.files; validateRecord(kind,data);
      const old=state.records.find(r=>r.id===form.dataset.id); if(kind==='post') {
        data.files=[...(old?.data.files||[])];
        const files=[...form.elements.files.files]; files.forEach(safeFileType);
        // 성공한 파일을 폼에 유지해 게시글 저장 재시도에서 중복 업로드하지 않습니다.
        form.uploadedFiles ||= new Map();
        for(let i=0;i<files.length;i++) {
          const file=files[i]; const key=`${file.name}:${file.size}:${file.lastModified}`; let metadata=form.uploadedFiles.get(key);
          if(!metadata) {
            if(state.mode==='demo'){ const id=crypto.randomUUID();await local.putFile(id,file); metadata={id,name:file.name,type:file.type,size:file.size,source:'local'}; }
            else metadata=await google.upload(file,p=>{submit.textContent=`${i+1}/${files.length} · ${p}%`;});
            form.uploadedFiles.set(key,metadata);
          }
          data.files.push(metadata);
        }
      }
      if(kind==='event' && state.mode==='live') await google.saveEvent(data,form.dataset.id || undefined);
      else await repository.save(state.mode,state.user,kind,data,form.dataset.id || undefined);
      closeDialog(); await load(kind==='event'); render(); toast('우리의 기록을 저장했어요.');
    }
    if(form.id==='chat-form') {
      const input=form.elements.message; const text=input.value.trim(); if(!text)throw new Error('메시지를 적어 주세요.');
      const saved=await repository.save(state.mode,state.user,'message',{text}); input.value=''; await markRead(); await load(); render();
      if(state.mode==='live') repository.notify(saved.id).catch(()=>toast('메시지는 전송했지만 푸시 알림은 보내지 못했어요.'));
    }
    if(form.id==='comment-form') {
      await repository.save(state.mode,state.user,'comment',{text:form.elements.text.value.trim(),postId:form.dataset.post}); await load();render();openPost(state.records.find(r=>r.id===form.dataset.post));toast('댓글을 남겼어요.');
    }
  } catch(error) { if(errorBox)errorBox.textContent=error.message;else report(error); }
  finally { state.busy=false; if(submit.isConnected){submit.disabled=false;submit.textContent=original;} }
});
document.addEventListener('keydown', event => { if(event.target.matches('#chat-form textarea')&&event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();event.target.form.requestSubmit();} });
async function enableNotifications(){
  if(native.active)throw new Error('설치형 앱의 잠금 화면 알림은 별도 APNs·FCM 연동이 필요합니다. 현재 앱을 열어 두면 대화가 갱신돼요.');
  requireLive(); if(!window.APP_CONFIG.vapidPublicKey)throw new Error('Web Push 서버 설정이 필요해요. README의 알림 설정을 먼저 완료해 주세요.');
  if(!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window))throw new Error('이 브라우저는 푸시를 지원하지 않아요. 아이폰은 홈 화면에 설치한 뒤 다시 시도해 주세요.');
  const permission=await Notification.requestPermission(); if(permission!=='granted')throw new Error('알림 권한이 허용되지 않았어요. 브라우저 설정에서 변경할 수 있어요.');
  const registration=await navigator.serviceWorker.ready; const key=window.APP_CONFIG.vapidPublicKey; const binary=atob(key.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-key.length%4)%4));
  const subscription=await registration.pushManager.getSubscription()||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:Uint8Array.from(binary,c=>c.charCodeAt(0))});
  await repository.subscribe(state.user,subscription.toJSON());toast('이 기기의 새 메시지 알림을 켰어요.');
}
async function seed(){
  if(localStorage.getItem('geonjukong-seeded'))return;
  const shifted=offset=>{const d=new Date();d.setDate(d.getDate()+offset);return dateKey(d);};
  const sample=[
    ['event','demo-me',{title:'같이 저녁 먹기',date:today,time:'19:00',text:'오늘은 서로 좋아하는 메뉴로.'}],
    ['event','demo-partner',{title:'느긋한 산책',date:shifted(2),time:'16:00',text:'커피 한 잔, 그리고 우리 둘.'}],
    ['diary','demo-me',{date:today,mood:'☀',text:'함께하는 일상을 이렇게 모아 두면 좋겠다고 생각했어. 특별한 일이 없는 날도, 너랑 함께라면 기억하고 싶은 하루가 되니까.'}],
    ['diary','demo-partner',{date:shifted(-1),mood:'♡',text:'바쁜 하루 끝에 나누는 짧은 대화가 참 좋아. 내일은 조금 더 천천히, 서로의 하루를 들어 주자.'}],
    ['post','demo-me',{title:'별일 없이도 좋은 하루',date:shifted(-1),text:'걷다가 나눈 시시한 이야기까지, 오래 기억하고 싶어서.',art:'walk',files:[]}],
    ['post','demo-partner',{title:'우리의 첫 번째 페이지',date:shifted(-3),text:'여기에 우리만의 순간들을 하나씩 모아 보자.',files:[]}],
    ['message','demo-partner',{text:'우리만의 공간이 생겼네 ♡ 오늘 하루는 어땠어?'}]
  ];
  for(let i=0;i<sample.length;i++){const[kind,author_id,data]=sample[i];await local.put({id:crypto.randomUUID(),kind,author_id,data,created_at:new Date(Date.now()-(sample.length-i)*60000).toISOString()});}
  localStorage.setItem('geonjukong-seeded','1');
}
async function start(callbackUrl){
  try {
    await auth.callback(callbackUrl);
    if(configured&&auth.user){
      const members=await repository.members();if(members.length!==2)throw new Error('허용된 두 계정의 서버 설정을 확인해 주세요.');
      state.mode='live';state.user=auth.user.id;state.members=members;
      if(native.active){const token=auth.takeProviderToken();if(token)await google.acceptNativeToken(token,auth.user.email);}
    }else{await seed();state.user=localStorage.getItem('geonjukong-demo-person')==='demo-partner'?'demo-partner':'demo-me';try{state.reads=JSON.parse(localStorage.getItem('geonjukong-demo-reads')||'[]');}catch{state.reads=[];}}
    state.view=views[location.hash.slice(1)]?location.hash.slice(1):'home';await load(native.active&&google.connected);render();if(state.view==='chat')await markRead();
    google.prepare().catch(report);
    if(!native.active&&'serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>toast('오프라인 설치 기능을 준비하지 못했어요. HTTPS 주소에서 다시 확인해 주세요.'));
  }catch(error){
    state.mode='demo';state.user='demo-me';state.members=[];state.records=[];state.events=[];
    $('#app').innerHTML=`<div class="access-error">${icon('heart')}<h1>우리 둘의 공간이에요</h1><p>${e(error.message)}</p><button class="primary" data-action="logout">로그아웃하고 다시 시작</button><button class="secondary" data-action="reload">다시 시도</button></div>`;
  }
}
let polling=false;
setInterval(async()=>{
  if(state.mode!=='live'||document.hidden||state.busy||polling)return;polling=true;
  try{
    const before=JSON.stringify([state.records,state.reads]);await load(false);if(state.view==='chat')await markRead();
    if(before!==JSON.stringify([state.records,state.reads])&&!$('#editor').open){
      const focused=document.activeElement;
      if(state.view==='chat'&&focused.matches('#chat-form textarea')){
        const draft=focused.value,start=focused.selectionStart,end=focused.selectionEnd;
        render();const input=$('#chat-form textarea');input.value=draft;input.focus({preventScroll:true});input.setSelectionRange(start,end);
      }else if(!focused.matches('input,textarea,select'))render();
    }
  }
  catch(error){state.error='공유 기록을 갱신하지 못했어요. 네트워크와 로그인을 확인해 주세요.';if(!$('#editor').open&&!document.activeElement.matches('input,textarea,select'))render();}finally{polling=false;}
},5000);
window.addEventListener('hashchange',()=>{const view=location.hash.slice(1);if(views[view])navigate(view).catch(report);});
let processingLink = false;
async function boot(){
  const launchUrl = await native.listen(async url => {
    if(!isAuthCallback(url)||processingLink)return;
    processingLink=true;try{await start(url);}finally{processingLink=false;}
  });
  await start(isAuthCallback(launchUrl)?launchUrl:undefined);
}
boot().catch(report);
