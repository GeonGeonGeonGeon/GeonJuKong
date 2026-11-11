export function createRecordAutosave({ save, status, delay = 300 }) {
  let revision = 0, savedRevision = 0, timer = null, job = null, stopped = false;
  const clear = () => { clearTimeout(timer); timer = null; };
  const flush = async () => {
    clear();
    if (stopped) return false;
    if (job) return job;
    if (savedRevision === revision) return true;
    job = (async () => {
      while (!stopped && savedRevision !== revision) {
        const savingRevision = revision;
        status('saving');
        try { await save(); }
        catch (error) { if (!stopped) status('error', error); return false; }
        savedRevision = savingRevision;
      }
      clear();
      if (!stopped) status('saved');
      return !stopped;
    })();
    try { return await job; }
    finally { job = null; }
  };
  return {
    get saving() { return Boolean(job); },
    get dirty() { return revision !== savedRevision; },
    schedule() {
      if (stopped) return;
      revision++; clear(); status('pending');
      timer = setTimeout(flush, delay);
    },
    flush,
    stop() { stopped = true; clear(); return job; }
  };
}
