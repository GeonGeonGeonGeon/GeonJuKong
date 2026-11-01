import test from 'node:test';
import assert from 'node:assert/strict';
import { sortRecords, daysBetween, coupleEvents, coupleDaySummary, koreaHolidays } from '../src/core.js';
import { monthGrid,dateKey,nextDay,validateRecord,escapeHtml,googleEvent,safeFileType,eventOnDate } from '../src/core.js';

test('record ordering uses creation instant and stable ID, never edited or diary date', () => {
  const rows = [{ id: 'a', created_at: '2026-10-01T00:00:00Z', updated_at: '2026-12-01' }, { id: 'b', created_at: '2026-10-01T09:00:00+09:00' }, { id: 'c', created_at: '2026-10-02T00:00:00Z' }];
  assert.deepEqual(sortRecords(rows).map(r => r.id), ['c', 'b', 'a']);
  assert.deepEqual(sortRecords(rows, 'oldest').map(r => r.id), ['a', 'b', 'c']);
  assert.equal(rows[0].id, 'a');
});
test('date ordering uses the entered date, then creation time and stable ID', () => {
  const rows = [
    { id: 'a', created_at: '2026-10-03T00:00:00Z', data: { date: '2026-10-01' } },
    { id: 'b', created_at: '2026-10-01T00:00:00Z', data: { date: '2026-10-02' } },
    { id: 'c', created_at: '2026-10-02T00:00:00Z', data: { date: '2026-10-02' } },
    { id: 'd', created_at: '2026-10-02T00:00:00Z', data: { date: '2026-10-02' } }
  ];
  assert.deepEqual(sortRecords(rows, 'date').map(r => r.id), ['d', 'c', 'b', 'a']);
  assert.deepEqual(sortRecords(rows, 'newest').map(r => r.id), ['a', 'd', 'c', 'b']);
  assert.equal(rows[0].id, 'a');
});
test('anniversaries include the first day and recur without stored duplicates', () => {
  const settings = { startDate: '2024-02-29', birthdays: [{ id: 'one', name: '나', date: '2000-02-29' }, { id: 'two', name: '짝꿍', date: '2001-05-01' }] };
  const first = coupleEvents(2024, settings);
  assert.equal(first.find(r => r.data.title === '100일 기념일').data.date, '2024-06-07');
  const next = coupleEvents(2025, settings);
  assert.equal(next.find(r => r.data.title === '1주년').data.date, '2025-02-28');
  assert.equal(next.find(r => r.data.title === '나 생일').data.date, '2025-02-28');
  assert.deepEqual(next, coupleEvents(2025, settings));
  assert.equal(new Set(next.map(r => r.id)).size, next.length);
  assert.equal(coupleEvents(2023, settings).some(r => r.data.title.includes('주년')), false);
});
test('day counters cross daylight-saving boundaries and distinguish elapsed from remaining', () => {
  assert.equal(daysBetween('2026-03-07', '2026-03-09'), 2);
  const settings = { startDate: '2026-01-01' };
  assert.equal(coupleDaySummary(settings, '2026-01-01').label, 'D+0');
  assert.equal(coupleDaySummary(settings, '2026-04-10').upcoming.label, 'D-Day');
  assert.equal(coupleDaySummary(settings, '2026-04-09').upcoming.label, 'D-1');
  assert.equal(coupleDaySummary({}, '2026-01-01').elapsed, null);
});
test('verified Korean holidays include lunar, replacement, election and 2026 amendments', () => {
  const holidays = koreaHolidays(2026);
  for (const date of ['2026-02-17', '2026-03-02', '2026-05-01', '2026-05-25', '2026-06-03', '2026-07-17', '2026-09-25', '2026-10-05']) assert.ok(holidays.some(h => h.date === date), date);
  assert.equal(holidays.some(h => h.date === '2026-06-08'), false);
  assert.ok(koreaHolidays(2027).some(h => h.date === '2027-02-09'));
  assert.ok(koreaHolidays(2027).some(h => h.date === '2027-07-19'));
  assert.deepEqual(koreaHolidays(2030), []);
});
test('holiday tables preserve historical law and expose KASI preliminary 2028 dates', () => {
  for (const [year, dates] of Object.entries({
    2023: ['2023-01-24', '2023-05-29', '2023-10-02'],
    2024: ['2024-02-12', '2024-04-10', '2024-10-01'],
    2025: ['2025-01-27', '2025-03-03', '2025-06-03', '2025-10-08'],
    2028: ['2028-01-27', '2028-04-12', '2028-05-02', '2028-10-05']
  })) {
    const holidays = koreaHolidays(Number(year));
    for (const date of dates) assert.ok(holidays.some(h => h.date === date), date);
  }
  assert.equal(koreaHolidays(2025).some(h => h.date === '2025-05-01' || h.date === '2025-07-17'), false);
  assert.equal(koreaHolidays(2025).filter(h => h.date === '2025-05-05').length, 2);
  assert.equal(koreaHolidays(2028).filter(h => h.date === '2028-10-03').length, 2);
});
test('reply validation rejects malformed targets', () => {
  for (const replyTo of ['', {}, 'post']) assert.throws(() => validateRecord('comment', { text: 'reply', postId: 'post', replyTo }));
  assert.equal(validateRecord('comment', { text: 'reply', postId: 'post', replyTo: 'root' }).replyTo, 'root');
});
test('달력은 일요일부터 시작하며 윤년 2월 29일을 포함한다',()=>{const days=monthGrid(2024,1);assert.equal(days.length,42);assert.equal(days[0].key,'2024-01-28');assert.equal(days.filter(d=>d.current).length,29);assert.ok(days.some(d=>d.key==='2024-02-29'));});
test('12월에서 다음 해로 이동하고 월말과 윤년을 처리한다',()=>{assert.equal(nextDay('2024-02-28'),'2024-02-29');assert.equal(nextDay('2025-12-31'),'2026-01-01');assert.equal(dateKey(new Date(2026,0,1)),'2026-01-01');});
test('빈 내용과 잘못된 날짜/시간 및 부모 없는 댓글을 거부한다',()=>{for(const[kind,data]of[['diary',{text:' ',date:'2026-10-26'}],['post',{title:'제목',date:'2026-02-30'}],['event',{title:'약속',date:'2026-10-26',time:'25:00'}],['comment',{text:'댓글'}],['message',{text:'x'.repeat(10001)}]])assert.throws(()=>validateRecord(kind,data));});
test('공개 일기, 댓글과 메시지의 정상 입력을 받는다',()=>{for(const[kind,data]of[['diary',{text:'오늘도 좋아',date:'2026-10-26'}],['comment',{text:'좋아',postId:'123'}],['message',{text:'안녕'}]])assert.deepEqual(validateRecord(kind,data),data);});
test('사용자 글의 HTML과 속성 삽입을 이스케이프한다',()=>{assert.equal(escapeHtml('<img onerror="x"> & \'a\''),'&lt;img onerror=&quot;x&quot;&gt; &amp; &#39;a&#39;');});
test('Google 종일 일정과 취소된 일정을 구분한다',()=>{const row=googleEvent({id:'a',summary:'산책',start:{date:'2026-10-26'},end:{date:'2026-10-27'}});assert.equal(row.data.date,'2026-10-26');assert.equal(row.data.time,'');assert.equal(googleEvent({status:'cancelled',start:{date:'2026-10-26'}}),null);});
test('원본 사진/영상 허용, 실행 가능한 SVG/HTML과 빈 파일 거부',()=>{assert.equal(safeFileType({type:'video/quicktime',size:100}),'video/quicktime');assert.equal(safeFileType({type:'image/heic',size:100}),'image/heic');for(const type of ['image/svg+xml','text/html','application/javascript'])assert.throws(()=>safeFileType({type,size:1}));assert.throws(()=>safeFileType({type:'image/png',size:0}));});
test('여러 날의 종일 일정은 Google의 종료일을 제외하고 표시한다',()=>{const row={data:{date:'2026-10-26',end:{date:'2026-10-29'}}};assert.equal(eventOnDate(row,'2026-10-25'),false);assert.equal(eventOnDate(row,'2026-10-27'),true);assert.equal(eventOnDate(row,'2026-10-29'),false);});
test('종료일이 앞서거나 종료 시간이 시작보다 이르면 저장을 거부한다',()=>{assert.throws(()=>validateRecord('event',{title:'약속',date:'2026-10-26',endDate:'2026-10-25'}));assert.throws(()=>validateRecord('event',{title:'약속',date:'2026-10-26',time:'19:00',endDate:'2026-10-26',endTime:'18:00'}));});
