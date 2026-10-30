const DB = 'geonjukong-local-v1';
let database;
async function db() {
  if (database) return database;
  database = await new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => { request.result.createObjectStore('records', { keyPath: 'id' }); request.result.createObjectStore('files', { keyPath: 'id' }); };
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  return database;
}
async function transaction(store, mode, action) {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(store, mode); const request = action(tx.objectStore(store));
    tx.oncomplete = () => resolve(request.result); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || new Error('저장하지 못했습니다.'));
  });
}
export const local = {
  list: () => transaction('records', 'readonly', s => s.getAll()),
  put: row => transaction('records', 'readwrite', s => s.put(row)),
  async putIfVersion(row, version) {
    const database = await db();
    return new Promise((resolve, reject) => {
      const tx = database.transaction('records', 'readwrite');
      const store = tx.objectStore('records');
      const request = store.get(row.id);
      let saved = false;
      request.onsuccess = () => {
        const current = request.result;
        if (current && (current.updated_at || current.created_at) === version) {
          store.put(row);
          saved = true;
        }
      };
      tx.oncomplete = () => resolve(saved);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('저장하지 못했습니다.'));
    });
  },
  remove: id => transaction('records', 'readwrite', s => s.delete(id)),
  file: id => transaction('files', 'readonly', s => s.get(id)),
  putFile: (id, blob) => transaction('files', 'readwrite', s => s.put({ id, blob })),
  async clear() { await transaction('records', 'readwrite', s => s.clear()); await transaction('files', 'readwrite', s => s.clear()); }
};
