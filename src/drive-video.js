export function createDriveVideoPlayer(google) {
  const urls = new Map(), jobs = new Map();
  function clear() {
    for (const job of jobs.values()) job.controller.abort();
    jobs.clear();
    for (const url of urls.values()) URL.revokeObjectURL(url);
    urls.clear();
  }
  function prune(videos) {
    const visible = new Set([...videos].map(video => video.dataset.driveVideo));
    for (const [id, url] of urls) if (!visible.has(id)) { URL.revokeObjectURL(url); urls.delete(id); }
    for (const [id, job] of jobs) if (!visible.has(id)) { job.controller.abort(); jobs.delete(id); }
  }
  async function load(video, autoplay = false) {
    const id = video.dataset.driveVideo;
    const wrapper = video.parentElement;
    const button = wrapper.querySelector('.video-load');
    const status = wrapper.querySelector('.video-status');
    if (button) button.disabled = true;
    if (status) status.textContent = '영상을 불러오는 중이에요…';
    try {
      if (!urls.has(id)) {
        let job = jobs.get(id);
        if (!job) {
          job = { controller: new AbortController() };
          jobs.set(id, job);
          job.promise = google.video(id, job.controller.signal).then(blob => {
            if (jobs.get(id) !== job) throw new DOMException('영상 요청이 취소됐어요.', 'AbortError');
            const url = URL.createObjectURL(blob); urls.set(id, url); return url;
          }).finally(() => { if (jobs.get(id) === job) jobs.delete(id); });
        }
        await job.promise;
      }
      if (!video.isConnected) return;
      video.src = urls.get(id);
      video.onerror = () => {
        if (status) status.textContent = '이 기기에서 재생할 수 없는 형식이에요. 원본 열기로 확인해 주세요.';
      };
      if (button) button.hidden = true;
      if (status) status.textContent = '';
      if (autoplay) { try { await video.play(); } catch { if (status) status.textContent = '재생 버튼을 눌러 주세요.'; } }
    } catch (error) {
      if (video.isConnected && error.name !== 'AbortError') {
        if (status) status.textContent = error.message;
        if (button) { button.hidden = false; button.textContent = '영상 다시 불러오기'; }
      }
    } finally { if (button) button.disabled = false; }
  }
  return { load, clear, prune };
}
