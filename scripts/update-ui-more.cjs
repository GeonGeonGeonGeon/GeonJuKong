const fs=require('fs');let s=fs.readFileSync('src/app.js','utf8');
const r=(a,b)=>{if(!s.includes(a))throw Error(a.slice(0,80));s=s.replace(a,b);};
r("koreaHolidays }", "koreaHolidays, HOLIDAY_YEARS }");
r("import { local }", "import { createThumbnail, previewFile, recordPreviewDownload, recordPreviewCacheHit, previewMeasurements } from './media.js';\nimport { local }");
r('function drivePhoto(file, alt) {', 'function drivePhoto(file, alt) {\n  file = previewFile(file);');
r('const file = row.data.files?.find', 'const originalFile = row.data.files?.find');
r("|| row.data.files?.[0];", "|| row.data.files?.[0]; const file = previewFile(originalFile);");
r('if (driveUrls.has(id)) return driveUrls.get(id);', 'if (driveUrls.has(id)) { recordPreviewCacheHit(); return driveUrls.get(id); }');
r('job.promise = google.image', 'const started = performance.now();\n    job.promise = google.image');
r('const url = URL.createObjectURL(blob); driveUrls.set', 'recordPreviewDownload(blob.size, performance.now() - started);\n      const url = URL.createObjectURL(blob); driveUrls.set');
r("for (const [id, url] of driveUrls) if (!visible.has(id))", "for (const [id, url] of driveUrls) if (driveUrls.size > 32 && !visible.has(id))");
r('form.uploadedFiles.set(key,metadata);', `const thumbnail = await createThumbnail(file);
            if(thumbnail) {
              if(state.mode==='demo'){ const id=crypto.randomUUID();await local.putFile(id,thumbnail);metadata.thumbnail={id,name:thumbnail.name,type:thumbnail.type,size:thumbnail.size,source:'local'}; }
              else { try { metadata.thumbnail=await google.upload(thumbnail,()=>{}); } catch { toast('썸네일 업로드에 실패하여 원본 미리보기를 사용해요.'); } }
            }
            form.uploadedFiles.set(key,metadata);`);
r("const upcoming = events()", "const anniversary = coupleDaySummary(state.couple, today);\n  const upcoming = events()");
r('<div class="home-grid">', '<section class="card anniversary-card"><strong>${anniversary.label || \'우리의 기념일\'}</strong><span>${anniversary.upcoming ? `${e(anniversary.upcoming.data.title)} · ${anniversary.upcoming.label}` : \'설정에서 연애 시작일과 생일을 등록해 주세요.\'}</span></section><div class="home-grid">');
r('const grid = monthGrid(state.year, state.month); const items = events();', 'const grid = monthGrid(state.year, state.month); const items = events(); const holidays = [...new Set(grid.map(d=>Number(d.key.slice(0,4))))].flatMap(koreaHolidays);');
r("const ev = items.filter(r => eventOnDate(r, d.key)); const diary", "const ev = items.filter(r => eventOnDate(r, d.key)); const holiday = holidays.filter(h=>h.date===d.key).map(h=>h.title).join(', '); const red = new Date(`${d.key}T12:00:00`).getDay()===0 || holiday; const diary");
r('class="calendar-day ${d.current', 'class="calendar-day ${red ? \'holiday\' : \'\'} ${d.current');
r('aria-label="${formatDate(d.key)} 일정', 'title="${e(holiday)}" aria-label="${formatDate(d.key)} ${e(holiday)} 일정');
r('<div class="day-markers">${ev.slice', '<div class="day-markers">${holiday ? `<small class="holiday-name">${e(holiday)}</small>` : \'\'}${ev.slice');
r('<div class="calendar-legend">', '<p class="setting-hint">${HOLIDAY_YEARS.includes(state.year) ? \'대한민국 공휴일 · 임시공휴일 지정은 자료 업데이트가 필요해요.\' : \'공휴일 자료는 2026~2027년 제공해요.\'}</p><div class="calendar-legend">');
r('<h2>${formatDate(state.day)}</h2><h3>', '<h2>${formatDate(state.day)}</h2><p class="holiday-name">${e(holidays.filter(h=>h.date===state.day).map(h=>h.title).join(\', \'))}</p><h3>');
r('<button class="icon-button" data-action="edit-event" data-id="${e(row.id)}"', '${row.data.automatic ? \'<span class="tag">자동 기념일</span>\' : `<button class="icon-button" data-action="edit-event" data-id="${e(row.id)}"');
r("${icon('right')}</button></div>`).join(''); }", "${icon('right')}</button>`}</div>`).join(''); }");
r('function settings() {\n  const cfg', 'function settings() {\n  const metrics = previewMeasurements(); const birthday = index => state.couple.birthdays?.[index] || {};\n  const cfg');
r('<div class="settings-grid"><section', '<div class="settings-grid"><section class="card settings-card"><h2>생일과 기념일</h2><form id="couple-form"><label>연애 시작일<input name="startDate" type="date" value="${e(state.couple.startDate || \'\')}"></label>${[0,1].map(i=>`<label>이름 ${i+1}<input name="name${i}" maxlength="60" value="${e(birthday(i).name || (i===0 ? \'나\' : \'짝꿍\'))}"></label><label>생일 ${i+1}<input name="birthday${i}" type="date" value="${e(birthday(i).date || \'\')}"></label>`).join(\'\')}<p class="setting-hint">100일은 시작일을 포함해 계산해요. 2월 29일 생일은 평년에 2월 28일로 표시해요.</p><p class="form-error" role="alert"></p><button class="primary" type="submit">기념일 저장</button></form></section><section class="card settings-card"><h2>사진 미리보기 사용량</h2><p>이번 실행: ${metrics.downloads}회 · ${(metrics.bytes/1024).toFixed(1)} KiB · ${(metrics.milliseconds/1000).toFixed(2)}초</p><p>메모리 캐시 재사용 ${metrics.cacheHits}회</p><p class="setting-hint">새 사진은 원본과 작은 미리보기를 함께 보관해요. 기존 사진은 원본을 사용해요. 전송량은 내려받은 이미지 본문 크기이며 통신 헤더는 제외해요.</p></section><section');
r("if (state.mode === 'demo') state.records = await local.list();", "if (state.mode === 'demo') { state.records = await local.list(); try { state.notificationReads=JSON.parse(localStorage.getItem('geonjukong-demo-notification-reads')||'[]'); state.couple=JSON.parse(localStorage.getItem('geonjukong-demo-couple')||'{}'); } catch { state.notificationReads=[]; state.couple={}; } }");
r("state.records = rows; state.reads = reads; if (refreshGoogle", "state.records = rows; state.reads = reads; const [noticeReads,couple]=await Promise.all([repository.notificationReads(),repository.coupleSettings()]); state.notificationReads=noticeReads; state.couple=couple; if (refreshGoogle");
r("'comment-form','search-form'", "'comment-form','search-form','couple-form'");
r("if(form.id==='record-form') {", "if(form.id==='couple-form') { const values=Object.fromEntries(new FormData(form)); const data={startDate:values.startDate,birthdays:[0,1].map(i=>({id:String(i),name:values[`name${i}`],date:values[`birthday${i}`]}))}; if(state.mode==='demo')localStorage.setItem('geonjukong-demo-couple',JSON.stringify(data));else await repository.saveCoupleSettings(data); state.couple=data;render();toast('기념일을 저장했어요.'); }\n    if(form.id==='record-form') {");
r("if(native.active){const token=auth.takeProviderToken();if(token)await google.acceptNativeToken(token,auth.user.email);}", "google.setTokenProvider(force => auth.googleToken(force));\n      try { await google.restore(); } catch(error) { state.error=error.message; toast(error.message); }");
r("await load(native.active&&google.connected)", "await load(google.connected)");
s=s.replace(/if \(action === 'google-connect'\) \{[^\n]+/, "if (action === 'google-connect') { requireLive(); await auth.login(); }");
r("연결은 만료 시 다시 동의하며, Google 비밀번호는 저장하지 않아요.", "권한을 허용하면 인증을 자동 갱신해요. 권한이 취소된 경우 다시 연결해 주세요.");
r("if (record) openEditor('event',record);", "if (record && !record.data.automatic) openEditor('event',record);");
fs.writeFileSync('src/app.js',s);
