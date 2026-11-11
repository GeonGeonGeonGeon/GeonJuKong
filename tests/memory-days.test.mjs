import test from 'node:test';
import assert from 'node:assert/strict';

test('individual diary cards keep every post, search results, detail actions and author permissions', async t => {
  const post = (id, author, date, text, extra = {}) => ({ id, kind: 'post', author_id: author, created_at: `2026-11-09T${id === 'me-late' ? '12' : '10'}:00:00Z`, data: { title: id, date, text, files: [], ...extra } });
  const mine = post('me-first', 'demo-me', '2026-11-08', 'Morning coffee');
  const partner = post('partner', 'demo-partner', '2026-11-08', 'Evening walk', { files: [{ id: 'photo', source: 'local', name: 'photo.jpg', type: 'image/jpeg' }] });
  const board = post('board', 'demo-partner', '2026-11-06', 'Shared story', { space: 'board' });
  const comment = { id: 'comment', kind: 'comment', author_id: 'demo-partner', created_at: mine.created_at, data: { postId: mine.id, text: 'A comment' } };
  const rows = new Map([mine, partner, post('me-late', 'demo-me', '2026-11-08', 'Late coffee'), post('only-partner', 'demo-partner', '2026-11-09', 'Only one perspective'), post('old', 'demo-me', '2025-01-01', 'Old story'), board, comment, { ...mine, id: 'legacy', kind: 'diary', data: { ...mine.data, title: 'Legacy hidden' } }].map(row => [row.id, row]));
  const values = new Map([['geonjukong-seeded', '1'], ['geonjukong-demo-profiles', JSON.stringify([{ user_id: 'demo-me', data: { name: '나 <우리>' } }, { user_id: 'demo-partner', data: { name: '짝꿍' } }])]]);
  const listeners = new Map();
  const app = { innerHTML: '' }, toast = { textContent: '', classList: { add() {}, remove() {} } };
  const editor = { innerHTML: '', open: false, scrollTop: 0, showModal() { this.open = true; }, close() { this.open = false; }, addEventListener() {}, classList: { add() {}, remove() {} }, style: { setProperty() {}, removeProperty() {} } };
  globalThis.window = { APP_CONFIG: {}, addEventListener() {}, removeEventListener() {}, scrollTo() {} };
  globalThis.document = { querySelector: selector => ({ '#app': app, '#editor': editor, '#toast': toast })[selector] || null, querySelectorAll: () => [], addEventListener: (type, fn) => listeners.set(type, fn), activeElement: { matches: () => false } };
  Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  globalThis.sessionStorage = localStorage;
  globalThis.location = { href: 'http://localhost/', origin: 'http://localhost', pathname: '/', hash: '#memories' };
  globalThis.history = { replaceState() {} };
  const { local } = await import('../src/storage.js');
  const { repository } = await import('../src/backend.js');
  const originalLocal = Object.getOwnPropertyDescriptors(local), originalInterval = globalThis.setInterval, originalFormData = globalThis.FormData, originalConfirm = globalThis.confirm, originalError = console.error;
  Object.assign(local, { list: async () => [...rows.values()], put: async row => rows.set(row.id, row), remove: async id => rows.delete(id), putIfVersion: async (row, version) => {
    const old = rows.get(row.id);
    if ((old.updated_at || old.created_at) !== version) return false;
    rows.set(row.id, row); return true;
  } });
  globalThis.setInterval = () => 0;
  globalThis.FormData = class { constructor(form) { this.values = Object.entries(form._data); } get(key) { return this.values.find(([name]) => name === key)?.[1]; } [Symbol.iterator]() { return this.values[Symbol.iterator](); } };
  globalThis.confirm = () => true;
  console.error = () => {};
  const click = dataset => listeners.get('click')({ target: { closest: () => ({ dataset }) } });
  const search = value => listeners.get('submit')({ target: { id: 'search-form', _data: { search: value } }, preventDefault() {} });
  const cards = () => [...app.innerHTML.matchAll(/<article class="memory-card\b[\s\S]*?<\/article>/g)].map(match => match[0]);
  const cardIds = () => cards().map(card => card.match(/class="title-button" data-action="open-post" data-id="([^"]+)"/)[1]);
  const submit = async (row, data) => {
    const error = { textContent: '' };
    await listeners.get('submit')({ preventDefault() {}, target: { id: 'record-form', dataset: { kind: 'post', id: row.id, version: row.updated_at || row.created_at }, _data: data, elements: { files: { files: [] } }, querySelector: selector => selector === '[type="submit"]' ? { textContent: 'Save', isConnected: true } : error } });
    return error.textContent;
  };
  try {
    await import('../src/app.js?memory-days');
    for (let i = 0; i < 40 && !app.innerHTML.includes('memory-grid all-memories'); i++) await new Promise(resolve => setTimeout(resolve, 5));
    await t.test('diary labels cover the list, search, new and edit forms, details and accessibility', async () => {
      assert.match(app.innerHTML, /<h1>일기<\/h1>/);
      assert.match(app.innerHTML, /data-kind="post"[^>]*>[\s\S]*?일기 쓰기<\/button>/);
      assert.match(app.innerHTML, /aria-label="일기 검색" placeholder="어떤 일기를 찾고 있나요\?"/);
      assert.match(app.innerHTML, /aria-label="partner 일기 열기"/);
      assert.doesNotMatch(app.innerHTML, /게시판|게시글|추억/);
      await click({ action: 'new', kind: 'post' });
      assert.match(editor.innerHTML, /<h2 id="dialog-title">일기 쓰기<\/h2>/);
      assert.match(editor.innerHTML, /<label>일기 제목<input/); assert.match(editor.innerHTML, /<label>일기 내용<textarea/);
      assert.match(editor.innerHTML, /placeholder="오늘의 일기를 남겨 보세요…"/);
      assert.match(editor.innerHTML, /type="submit" class="primary">일기 저장<\/button>/);
      assert.match(editor.innerHTML, /aria-label="일기 기기 초안"/);
      assert.match(editor.innerHTML, /일기 내용은 이 계정의 기기 초안으로 자동 저장돼요/);
      assert.match(editor.innerHTML, /일기 이어 쓰기/); assert.match(editor.innerHTML, /일기 초안 삭제/);
      assert.doesNotMatch(editor.innerHTML, /게시글|추억/);
      await click({ action: 'close' }); await click({ action: 'open-post', id: mine.id });
      assert.match(editor.innerHTML, /data-action="edit"[^>]*>일기 수정<\/button>/);
      assert.match(editor.innerHTML, /data-action="delete"[^>]*>일기 삭제<\/button>/);
      assert.match(editor.innerHTML, /둘이 나누는 이야기/); assert.match(editor.innerHTML, /댓글 남기기/);
      await click({ action: 'edit', id: mine.id });
      assert.match(editor.innerHTML, /<h2 id="dialog-title">일기 수정<\/h2>/);
      assert.doesNotMatch(editor.innerHTML, /type="submit"/);
      assert.match(editor.innerHTML, /수정하면 자동으로 저장돼요/);
      await click({ action: 'close' });
    });
    await t.test('shared forms and other tabs retain their existing copy outside the diary tab', async () => {
      for (const view of ['home', 'calendar']) {
        await click({ view });
        const main = app.innerHTML.match(/<main>[\s\S]*?<\/main>/)[0];
        assert.match(main, view === 'home' ? /RECENT MEMORY/ : /<h1>함께 채우는 달력<\/h1>/);
        assert.doesNotMatch(main, /일기 쓰기|일기 검색|일기 수정/);
        await click({ action: 'new', kind: 'post' });
        assert.match(editor.innerHTML, /<h2 id="dialog-title">추억 남기기<\/h2>/);
        assert.match(editor.innerHTML, /<label>제목<input/); assert.match(editor.innerHTML, /<label>이야기<textarea/);
        assert.match(editor.innerHTML, /placeholder="오늘을 기억할 작은 이야기…"/);
        assert.match(editor.innerHTML, /type="submit" class="primary">기록하기<\/button>/);
        assert.match(editor.innerHTML, /aria-label="기기 초안"/);
        await click({ action: 'close' }); await click({ action: 'open-post', id: mine.id });
        assert.match(editor.innerHTML, /data-action="edit"[^>]*>게시글 수정<\/button>/);
        assert.match(editor.innerHTML, /data-action="delete"[^>]*>삭제<\/button>/);
        await click({ action: 'edit', id: mine.id });
        assert.match(editor.innerHTML, /<h2 id="dialog-title">추억 남기기<\/h2>/);
        assert.doesNotMatch(editor.innerHTML, /type="submit"/);
        assert.match(editor.innerHTML, /수정하면 자동으로 저장돼요/);
        await click({ action: 'close' });
      }
      await click({ action: 'day', date: mine.data.date }); assert.match(app.innerHTML, /<h3>이날의 추억<\/h3>/);
      await click({ view: 'bucket' }); assert.match(app.innerHTML, /<h1>버킷리스트<\/h1>/); assert.match(app.innerHTML, /목표 추가/);
      await click({ view: 'settings' }); assert.match(app.innerHTML, /<h1>우리의 공간 설정<\/h1>/);
      assert.match(app.innerHTML, /원본은 게시글을 삭제해도 유지해요/);
      await click({ view: 'memories' });
      await click({ action: 'new', kind: 'event' });
      assert.match(editor.innerHTML, /<h2 id="dialog-title">우리의 약속<\/h2>/);
      assert.match(editor.innerHTML, /<label>메모<textarea/); assert.match(editor.innerHTML, /기록하기<\/button>/);
      assert.doesNotMatch(editor.innerHTML, /일기/);
      await click({ action: 'close' }); await click({ action: 'new', kind: 'comment' });
      assert.match(editor.innerHTML, /<h2 id="dialog-title">댓글 수정<\/h2>/);
      assert.match(editor.innerHTML, /<label>이야기<textarea/); assert.match(editor.innerHTML, /기록하기<\/button>/);
      assert.doesNotMatch(editor.innerHTML, /일기/);
      await click({ action: 'close' });
    });
    await t.test('first diary guidance and home empty guidance stay distinct', async () => {
      const saved = [...rows]; rows.clear();
      try {
        await click({ action: 'refresh' });
        assert.match(app.innerHTML, /첫 일기를 써 보세요/); assert.match(app.innerHTML, /사진, 동영상과 함께 우리의 일기를 보관해요/);
        assert.equal((app.innerHTML.match(/일기 쓰기<\/button>/g) || []).length, 2);
        assert.doesNotMatch(app.innerHTML, /추억|게시글|게시판/);
        await click({ view: 'home' });
        assert.match(app.innerHTML, /첫 번째 추억을 기다려요/); assert.match(app.innerHTML, /사진과 짧은 이야기로 시작해 보세요/);
        assert.match(app.innerHTML, /추억 남기기<\/button>/); assert.match(app.innerHTML, /약속 추가<\/button>/);
      } finally {
        for (const [id, row] of saved) rows.set(id, row);
        await click({ view: 'memories' }); await click({ action: 'refresh' });
      }
    });
    await t.test('same-date posts from both writers remain separate cards in date and creation order', () => {
      assert.match(app.innerHTML, /class="memory-grid all-memories"/);
      assert.deepEqual(cardIds(), ['only-partner', 'me-late', 'partner', 'me-first', 'board', 'old']);
      assert.equal(cards().length, 6);
      const own = cards().find(card => card.includes('<h3>me-first</h3>'));
      assert.match(own, /Morning coffee/); assert.match(own, /나 &lt;우리&gt;/); assert.doesNotMatch(own, /Evening walk|Late coffee/);
      assert.match(cards().find(card => card.includes('<h3>partner</h3>')), /Evening walk/);
      assert.doesNotMatch(app.innerHTML, /Legacy hidden|memory-day|memory-perspective|같은 날, 둘의 시점/);
    });
    await t.test('single-author dates show only existing entries without missing-writer placeholders', () => {
      assert.match(cards().find(card => card.includes('<h3>only-partner</h3>')), /Only one perspective/);
      assert.match(cards().find(card => card.includes('<h3>old</h3>')), /Old story/);
      assert.doesNotMatch(app.innerHTML, /memory-unwritten|아직 이날의 일기를 쓰지 않았어요/);
    });
    await t.test('title and body search stay case insensitive and return only matching cards', async () => {
      await search(' COFFEE ');
      assert.deepEqual(cardIds(), ['me-late', 'me-first']);
      assert.match(app.innerHTML, /Morning coffee/); assert.match(app.innerHTML, /Late coffee/); assert.doesNotMatch(app.innerHTML, /Evening walk/);
      assert.doesNotMatch(app.innerHTML, /memory-unwritten|검색에 맞는 일기가 없어요|아직 이날/);
      await search('ONLY-PARTNER'); assert.deepEqual(cardIds(), ['only-partner']); assert.match(app.innerHTML, /Only one perspective/);
      await search('no such entry'); assert.deepEqual(cardIds(), []); assert.match(app.innerHTML, /찾는 일기가 없어요/); assert.match(app.innerHTML, /다른 단어로/);
      assert.doesNotMatch(app.innerHTML, /첫 일기|추억|게시글|게시판/);
      await search('');
    });
    await t.test('each entry opens its original detail, attachments and independent comments', async () => {
      await click({ action: 'open-post', id: partner.id });
      assert.equal(editor.open, true); assert.match(editor.innerHTML, /Evening walk/); assert.match(editor.innerHTML, /attachment-gallery/);
      assert.doesNotMatch(editor.innerHTML, /data-action="edit"|data-action="delete"/);
      await click({ action: 'close' });
      await click({ action: 'open-comments', id: mine.id }); assert.match(editor.innerHTML, /A comment/); assert.doesNotMatch(editor.innerHTML, /Evening walk/);
      await click({ action: 'close' });
    });
    await t.test('foreign ordinary posts reject editing and deletion in the UI and repository', async () => {
      await click({ action: 'edit', id: partner.id }); assert.equal(editor.open, false); assert.match(toast.textContent, /작성자만/);
      await assert.rejects(repository.save('demo', 'demo-me', 'post', { ...partner.data, title: 'Forbidden' }, partner.id), /작성자만/);
      await click({ action: 'delete', id: partner.id }); assert.ok(rows.has(partner.id)); assert.match(toast.textContent, /작성자만/);
      await assert.rejects(repository.remove('demo', 'demo-me', partner), /작성자만/);
      assert.equal(rows.get(partner.id).data.title, partner.data.title);
    });
    await t.test('shared board exception allows edits while preserving author-only deletion and space', async () => {
      await click({ action: 'open-post', id: board.id }); assert.match(editor.innerHTML, /data-action="edit"/); assert.doesNotMatch(editor.innerHTML, /data-action="delete"/);
      await click({ action: 'edit', id: board.id }); assert.match(editor.innerHTML, /data-kind="post"/);
      assert.equal(await submit(board, { title: 'Shared edit', date: board.data.date, text: 'Updated shared story' }), '');
      assert.equal(rows.get(board.id).data.space, 'board'); assert.equal(rows.get(board.id).author_id, 'demo-partner'); assert.equal(rows.get(board.id).data.title, 'Shared edit');
      await assert.rejects(repository.remove('demo', 'demo-me', rows.get(board.id)), /작성자만/);
      await assert.rejects(repository.save('demo', 'demo-me', 'post', { ...partner.data, space: 'board' }, partner.id, partner.created_at), /공간은 바꿀 수/);
    });
    await t.test('owners retain edit and delete rights and related comments are cleaned up', async () => {
      await click({ action: 'open-post', id: mine.id }); assert.match(editor.innerHTML, /data-action="edit"/); assert.match(editor.innerHTML, /data-action="delete"/);
      await click({ action: 'edit', id: mine.id }); assert.equal(await submit(mine, { title: 'Own edit', date: mine.data.date, text: 'Own saved story' }), '');
      assert.equal(rows.get(mine.id).data.title, 'Own edit');
      await click({ action: 'delete', id: mine.id }); assert.equal(rows.has(mine.id), false); assert.equal(rows.has(comment.id), false);
      await listeners.get('change')({ target: { id: 'demo-person', value: 'demo-partner' } });
      await click({ action: 'open-post', id: board.id }); assert.match(editor.innerHTML, /data-action="delete"/);
      await click({ action: 'delete', id: board.id }); assert.equal(rows.has(board.id), false);
    });
    await t.test('home and calendar continue to use existing ungrouped post rendering', async () => {
      await click({ view: 'home' }); assert.doesNotMatch(app.innerHTML, /class="memory-day"/); assert.match(app.innerHTML, /RECENT MEMORY/);
      await click({ view: 'calendar' }); assert.doesNotMatch(app.innerHTML, /class="memory-day"/); assert.match(app.innerHTML, /calendar-grid/);
    });
  } finally {
    Object.defineProperties(local, originalLocal); globalThis.setInterval = originalInterval; globalThis.FormData = originalFormData; globalThis.confirm = originalConfirm; console.error = originalError;
  }
});
