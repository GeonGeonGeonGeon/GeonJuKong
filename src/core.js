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
