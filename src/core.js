export const kinds = ['event', 'diary', 'post', 'comment', 'message'];
export const escapeHtml = (v = '') => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return { key: dateKey(d), day: d.getDate(), current: d.getMonth() === month }; });
}
export function validateRecord(kind, data) {
  if (!kinds.includes(kind)) throw new Error('지원하지 않는 기록입니다.');
  const field = ['event', 'post'].includes(kind) ? 'title' : 'text';
  if (!String(data[field] || '').trim()) throw new Error(field === 'title' ? '제목을 적어 주세요.' : '내용을 적어 주세요.');
  if (String(data[field]).length > (field === 'title' ? 120 : 10000)) throw new Error('내용이 너무 깁니다.');
  if (['event', 'diary', 'post'].includes(kind) && (!/^\d{4}-\d{2}-\d{2}$/.test(data.date || '') || dateKey(new Date(`${data.date}T12:00:00`)) !== data.date)) throw new Error('올바른 날짜를 선택해 주세요.');
  if (kind === 'event' && data.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(data.time)) throw new Error('올바른 시간을 선택해 주세요.');
  if (kind === 'event' && data.endDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.endDate) || dateKey(new Date(`${data.endDate}T12:00:00`)) !== data.endDate || data.endDate < data.date) throw new Error('종료 날짜를 확인해 주세요.');
    if (data.time && data.endTime && new Date(`${data.endDate}T${data.endTime}:00`) <= new Date(`${data.date}T${data.time}:00`)) throw new Error('종료 시간은 시작 시간보다 뒤여야 합니다.');
  }
  if (kind === 'comment' && !data.postId) throw new Error('게시글을 찾을 수 없습니다.');
  if (kind === 'comment' && data.replyTo !== undefined && data.replyTo !== null && (typeof data.replyTo !== 'string' || !data.replyTo.trim() || data.replyTo === data.postId)) throw new Error('올바른 답글 대상을 선택해 주세요.');
  return data;
}
export function nextDay(key) { const d = new Date(`${key}T12:00:00`); d.setDate(d.getDate() + 1); return dateKey(d); }
export function eventOnDate(row, key) {
  const data = row.data;
  if (data.date > key) return false;
  if (data.end?.date) return key < data.end.date;
  if (data.end?.dateTime) { const finish = new Date(data.end.dateTime); return new Date(`${key}T00:00:00`) < finish; }
  return key <= (data.endDate || data.date);
}
export function googleEvent(item) {
  const start = item.start?.dateTime || item.start?.date;
  if (!start || item.status === 'cancelled') return null;
  const d = item.start.dateTime ? new Date(start) : null;
  return { id: item.id, kind: 'event', author_id: item.creator?.email || '', created_at: item.created, data: { title: item.summary || '(제목 없음)', text: item.description || '', date: d ? dateKey(d) : start, time: d ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '', end: item.end, google: true } };
}
export function safeFileType(file) {
  const type = file.type.toLowerCase();
  const image = /^image\/(jpeg|png|webp|gif|heic|heif|avif)$/;
  if (!image.test(type) && !/^video\/(mp4|quicktime|webm|3gpp|x-m4v)$/.test(type)) throw new Error('사진 또는 동영상 파일만 올릴 수 있습니다.');
  if (file.size === 0) throw new Error('빈 파일은 올릴 수 없습니다.');
  return type;
}

export function sortRecords(rows, order = 'newest') {
  const direction = order === 'oldest' ? 1 : -1;
  return [...rows].sort((a, b) => (order === 'date' ? String(b.data.date).localeCompare(String(a.data.date)) : 0) || direction * ((Date.parse(a.created_at) || 0) - (Date.parse(b.created_at) || 0) || String(a.id).localeCompare(String(b.id))));
}
export function daysBetween(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}
function validDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(value || '') && dateKey(new Date(`${value}T12:00:00`)) === value; }
function annualDate(year, source) {
  const candidate = `${year}${source.slice(4)}`;
  return validDate(candidate) ? candidate : `${year}-02-28`;
}
export function coupleEvents(year, settings = {}) {
  const rows = [];
  const add = (id, title, date) => { if (Number(date.slice(0, 4)) === year) rows.push({ id: `couple-${id}-${year}`, kind: 'event', author_id: '', data: { title, date, time: '', automatic: true } }); };
  for (const [index, birthday] of (settings.birthdays || []).entries()) {
    if (validDate(birthday.date) && year >= Number(birthday.date.slice(0, 4))) add(`birthday-${birthday.id || index}`, `${birthday.name || '짝꿍'} 생일`, annualDate(year, birthday.date));
  }
  if (validDate(settings.startDate)) {
    for (const count of [100, 200, 300]) {
      const date = new Date(`${settings.startDate}T12:00:00`); date.setDate(date.getDate() + count - 1);
      add(`day-${count}`, `${count}일 기념일`, dateKey(date));
    }
    const years = year - Number(settings.startDate.slice(0, 4));
    if (years > 0) add(`anniversary-${years}`, `${years}주년`, annualDate(year, settings.startDate));
  }
  return rows.sort((a, b) => a.data.date.localeCompare(b.data.date) || a.id.localeCompare(b.id));
}
export function coupleDaySummary(settings = {}, today = dateKey()) {
  const elapsed = validDate(settings.startDate) ? daysBetween(settings.startDate, today) : null;
  const year = Number(today.slice(0, 4));
  const upcoming = [...coupleEvents(year, settings), ...coupleEvents(year + 1, settings)].find(row => row.data.date >= today);
  return { elapsed, label: elapsed === null ? '' : elapsed >= 0 ? `D+${elapsed}` : `D-${-elapsed}`, upcoming: upcoming ? { ...upcoming, remaining: daysBetween(today, upcoming.data.date), label: upcoming.data.date === today ? 'D-Day' : `D-${daysBetween(today, upcoming.data.date)}` } : null };
}

// KASI calendar data, supplemented by later government holiday designations.
// https://astro.kasi.re.kr/kor/life/post/calendarData?search_year=2028
// The 2028 calendar is preliminary; later temporary holidays require updates.
export const HOLIDAY_YEARS = [2023, 2024, 2025, 2026, 2027, 2028];
export function koreaHolidays(year) {
  if (!HOLIDAY_YEARS.includes(year)) return [];
  const fixed = [['01-01', '신정'], ['03-01', '삼일절'], ['05-05', '어린이날'], ['06-06', '현충일'], ['08-15', '광복절'], ['10-03', '개천절'], ['10-09', '한글날'], ['12-25', '성탄절']];
  if (year >= 2026) fixed.push(['05-01', '노동절'], ['07-17', '제헌절']);
  const special = {
    2023: [['01-21', '설날 연휴'], ['01-22', '설날'], ['01-23', '설날 연휴'], ['01-24', '대체공휴일 (설날)'], ['05-27', '부처님오신날'], ['05-29', '대체공휴일 (부처님오신날)'], ['09-28', '추석 연휴'], ['09-29', '추석'], ['09-30', '추석 연휴'], ['10-02', '임시공휴일']],
    2024: [['02-09', '설날 연휴'], ['02-10', '설날'], ['02-11', '설날 연휴'], ['02-12', '대체공휴일 (설날)'], ['04-10', '국회의원선거'], ['05-06', '대체공휴일 (어린이날)'], ['05-15', '부처님오신날'], ['09-16', '추석 연휴'], ['09-17', '추석'], ['09-18', '추석 연휴'], ['10-01', '임시공휴일 (국군의 날)']],
    2025: [['01-27', '임시공휴일'], ['01-28', '설날 연휴'], ['01-29', '설날'], ['01-30', '설날 연휴'], ['03-03', '대체공휴일 (삼일절)'], ['05-05', '부처님오신날'], ['05-06', '대체공휴일 (부처님오신날)'], ['06-03', '대통령선거'], ['10-05', '추석 연휴'], ['10-06', '추석'], ['10-07', '추석 연휴'], ['10-08', '대체공휴일 (추석)']],
    2026: [['02-16', '설날 연휴'], ['02-17', '설날'], ['02-18', '설날 연휴'], ['03-02', '대체공휴일 (삼일절)'], ['05-24', '부처님오신날'], ['05-25', '대체공휴일 (부처님오신날)'], ['06-03', '전국동시지방선거'], ['08-17', '대체공휴일 (광복절)'], ['09-24', '추석 연휴'], ['09-25', '추석'], ['09-26', '추석 연휴'], ['10-05', '대체공휴일 (개천절)']],
    2027: [['02-06', '설날 연휴'], ['02-07', '설날'], ['02-08', '설날 연휴'], ['02-09', '대체공휴일 (설날)'], ['05-03', '대체공휴일 (노동절)'], ['05-13', '부처님오신날'], ['07-19', '대체공휴일 (제헌절)'], ['08-16', '대체공휴일 (광복절)'], ['09-14', '추석 연휴'], ['09-15', '추석'], ['09-16', '추석 연휴'], ['10-04', '대체공휴일 (개천절)'], ['10-11', '대체공휴일 (한글날)'], ['12-27', '대체공휴일 (성탄절)']],
    2028: [['01-26', '설날 연휴'], ['01-27', '설날'], ['01-28', '설날 연휴'], ['04-12', '국회의원선거'], ['05-02', '부처님오신날'], ['10-02', '추석 연휴'], ['10-03', '추석'], ['10-04', '추석 연휴'], ['10-05', '대체공휴일 (추석)']]
  }[year];
  return [...fixed, ...special].map(([date, title]) => ({ date: `${year}-${date}`, title })).sort((a, b) => a.date.localeCompare(b.date));
}
