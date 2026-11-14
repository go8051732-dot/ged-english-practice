(function () {
  const NOTEBOOK_VERSION = 1;
  let activeSubject = 'all';
  const dateToday = () => new Date().toLocaleDateString('sv-SE');
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const subjectOf = exam => exam?.subject || exam?.title || '영어';
  const shortAnswer = q => q?.shortAnswer ?? q?.answerText ?? q?.inputAnswer ?? q?.acceptedAnswers?.[0] ?? (typeof q?.answer === 'string' ? q.answer : '');
  const isShort = q => !!(q?.__notebookShort || q?.subjective || q?.answerType === 'text' || q?.type === 'short' || q?.type === 'subjective' || (!Array.isArray(q?.options) && !!shortAnswer(q)));
  const normalize = value => String(value ?? '').trim().toLocaleLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ');
  const notesFor = exam => {
    const p = progress(exam);
    if (!p.wrongNotes || typeof p.wrongNotes !== 'object') p.wrongNotes = {};
    return p.wrongNotes;
  };
  function allItems(includeMastered = true) {
    // Convert old saved incorrect answers into durable notebook entries.
    for (const exam of exams) {
      const p = progress(exam), notes = notesFor(exam), scores = { ...(p.examResult?.correct || {}), ...(p.correct || {}) };
      Object.entries(scores).forEach(([rawIndex, correct]) => {
        const index = Number(rawIndex);
        if (correct === false && exam.questions[index] && !notes[index]) {
          const wasRetriedCorrectly = p.reviewCorrect?.[index] === true, wrongDate = dateToday();
          notes[index] = { subject: subjectOf(exam), questionNumber: index + 1, firstWrongDate: wrongDate, lastWrongDate: wrongDate, wrongDates: [wrongDate], wrongCount: 1, reviewCorrectCount: wasRetriedCorrectly ? 1 : 0, reviewWrongCount: 0, status: wasRetriedCorrectly ? 'mastered' : 'pending', history: [{ date: wrongDate, kind: 'wrong', answer: p.answers?.[index] ?? '' }, ...(wasRetriedCorrectly ? [{ date: wrongDate, kind: 'review', answer: p.reviewAnswers?.[index] ?? '', correct: true }] : [])] };
        }
      });
    }
    const items = exams.flatMap(exam => {
      const notes = notesFor(exam);
      return Object.entries(notes).map(([rawIndex, note]) => ({ exam, index: Number(rawIndex), q: exam.questions[Number(rawIndex)], note }))
        .filter(item => item.q && (includeMastered || item.note.status !== 'mastered'));
    });
    return items.sort((a, b) => b.note.lastWrongDate.localeCompare(a.note.lastWrongDate) || a.exam.year - b.exam.year || a.index - b.index);
  }
  function saveNotebook() { save(); updateWrongHome(); }
  function chartHtml(items) {
    const subjects = [...new Set(items.map(item => subjectOf(item.exam)))];
    if (!subjects.length) return '<p class="wrong-empty">복습 기록이 쌓이면 여기에 진행 상황이 표시돼요.</p>';
    return subjects.map(subject => {
      const rows = items.filter(item => subjectOf(item.exam) === subject);
      const pending = rows.filter(item => item.note.status !== 'mastered').length;
      const mastered = rows.length - pending;
      const max = Math.max(1, ...subjects.map(s => items.filter(item => subjectOf(item.exam) === s).length));
      return `<div class="wrong-chart-row"><b>${escape(subject)}</b><div class="wrong-chart-track"><span class="wrong-chart-pending" style="width:${pending / max * 100}%"></span><span class="wrong-chart-mastered" style="width:${mastered / max * 100}%"></span></div><small>남음 ${pending} · 다시 맞힘 ${mastered}</small></div>`;
    }).join('') + '<div class="wrong-chart-legend"><span>남은 오답</span><span>다시 맞힌 문제</span></div>';
  }
  function itemHtml(item, mastered) {
    const n = item.note, dates = [...new Set(n.wrongDates || [n.firstWrongDate])].slice(0, 3).map(d => new Date(`${d}T00:00:00`).toLocaleDateString('ko-KR')).join(', ');
    return `<article class="wrong-note-item"><div class="wrong-note-meta"><b>${escape(subjectOf(item.exam))} · ${escape(item.exam.label)} · ${item.index + 1}번</b><span>${mastered ? '다시 맞힘' : '틀린 날짜'} · ${escape(dates || n.firstWrongDate || '')}</span></div><p>${escape(item.q.english || item.q.korean || '문제 내용 확인')}</p><small>틀린 횟수 ${n.wrongCount || 1}회${n.reviewWrongCount ? ` · 복습 중 오답 ${n.reviewWrongCount}회` : ''}${n.reviewCorrectCount ? ` · 다시 맞힘 ${n.reviewCorrectCount}회` : ''}</small><button class="button outline" onclick="startSingleWrongReview('${key(item.exam)}',${item.index})">${mastered ? '다시 풀기' : '이 문제 풀기'}</button></article>`;
  }
  function renderWrongNotebook() {
    const all = allItems(true), pending = all.filter(item => item.note.status !== 'mastered'), mastered = all.filter(item => item.note.status === 'mastered');
    const subjects = [...new Set(all.map(item => subjectOf(item.exam)))];
    const filtered = list => activeSubject === 'all' ? list : list.filter(item => subjectOf(item.exam) === activeSubject);
    const pendingRows = filtered(pending), masteredRows = filtered(mastered);
    const retryAttempts = all.reduce((sum, item) => sum + (item.note.reviewCorrectCount || 0) + (item.note.reviewWrongCount || 0), 0);
    const retryCorrect = all.reduce((sum, item) => sum + (item.note.reviewCorrectCount || 0), 0);
    const stat = document.getElementById('wrongNotebookStats');
    if (stat) stat.innerHTML = `<div><b>${pending.length}</b><span>남은 오답</span></div><div><b>${mastered.length}</b><span>다시 맞힌 문제</span></div><div><b>${retryAttempts ? Math.round(retryCorrect / retryAttempts * 100) : 0}%</b><span>복습 정답률</span></div>`;
    const chart = document.getElementById('wrongProgressChart'); if (chart) chart.innerHTML = chartHtml(all);
    const filters = document.getElementById('wrongSubjectFilters');
    if (filters) filters.innerHTML = `<button class="${activeSubject === 'all' ? 'active' : ''}" onclick="filterWrongSubject('all')">전체 ${all.length}</button>${subjects.map(s => `<button class="${activeSubject === s ? 'active' : ''}" onclick="filterWrongSubject('${escape(s)}')">${escape(s)} ${all.filter(x => subjectOf(x.exam) === s).length}</button>`).join('')}`;
    const pc = document.getElementById('wrongPendingCount'), mc = document.getElementById('wrongMasteredCount'); if (pc) pc.textContent = `(${pendingRows.length})`; if (mc) mc.textContent = `(${masteredRows.length})`;
    const pl = document.getElementById('wrongPendingList'), ml = document.getElementById('wrongMasteredList');
    if (pl) pl.innerHTML = pendingRows.length ? pendingRows.map(item => itemHtml(item, false)).join('') : '<p class="wrong-empty">남은 오답이 없어요. 문제를 틀리면 여기에 자동으로 모입니다.</p>';
    if (ml) ml.innerHTML = masteredRows.length ? masteredRows.map(item => itemHtml(item, true)).join('') : '<p class="wrong-empty">다시 맞힌 문제는 여기에 기록됩니다.</p>';
    const allBtn = document.getElementById('wrongAllRetry'); if (allBtn) allBtn.disabled = pending.length === 0;
    const homeSummary = document.getElementById('wrongHomeSummary'); if (homeSummary) homeSummary.textContent = `${pending.length}개 남음 · ${mastered.length}개 다시 맞힘`;
    saveNotebook();
  }
  function showWrongNotebook() { activeSubject = 'all'; renderWrongNotebook(); show('wrongNotebook'); }
  function startQueue(items) {
    if (!items.length) { renderWrongNotebook(); return; }
    wrongQueue = items.map(({ exam, index }) => ({ exam, index })); wrongCursor = 0;
    currentExam = wrongQueue[0].exam; currentIndex = wrongQueue[0].index; renderQuestion(); show('quiz');
  }
  window.showWrongNotebook = showWrongNotebook;
  window.filterWrongSubject = subject => { activeSubject = subject; renderWrongNotebook(); };
  window.getAllWrongItems = () => allItems(false).map(({ exam, index, q }) => ({ exam, index, q }));
  window.updateWrongHome = () => {
    const pending = allItems(false).length, button = document.getElementById('wrongHomeBtn'), summary = document.getElementById('wrongHomeSummary');
    if (button) { button.disabled = false; button.textContent = '오답노트 열기'; }
    if (summary) summary.textContent = pending ? `남은 오답 ${pending}개 · 다시 맞힌 문제 ${allItems(true).length - pending}개` : '아직 틀린 문제가 없어요.';
  };
  window.startWrongReview = examFilter => {
    const items = allItems(false).filter(item => !examFilter || key(item.exam) === key(examFilter));
    startQueue(items);
  };
  window.startSingleWrongReview = (examKey, index) => startQueue(allItems(true).filter(item => key(item.exam) === examKey && item.index === index));
  window.renderQuestion = (function (render) {
    return function (...args) {
      const q = currentExam?.questions[currentIndex];
      if (q && !Array.isArray(q.options)) { q.__notebookShort = isShort(q); q.options = []; }
      render.apply(this, args);
      if (!q || !isShort(q)) return;
      const box = document.getElementById('options'); if (!box) return;
      const input = document.createElement('input'); input.type = 'text'; input.className = 'wrong-short-answer'; input.placeholder = '답을 입력하세요'; input.setAttribute('aria-label', '답 입력');
      input.value = selected ?? ''; input.disabled = !!checked;
      input.addEventListener('input', () => { selected = input.value; const p = progress(currentExam); if (wrongQueue) { p.reviewAnswers ||= {}; p.reviewAnswers[currentIndex] = input.value; } else { p.answers ||= {}; p.answers[currentIndex] = input.value; } save(); });
      box.replaceChildren(input);
      if (checked && wrongQueue) {
        const p = progress(currentExam), right = p.reviewCorrect?.[currentIndex] === true, correct = shortAnswer(q);
        const fb = document.getElementById('feedback'); fb.textContent = `${right ? '⭕ 맞혔어요!' : '❌ 틀렸어요.'} 정답: ${correct}`;
        const translation = document.getElementById('translation'); translation.style.display = 'block';
        document.getElementById('korean').textContent = `해설: ${q.explanation || q.korean || '해설을 확인할 수 없습니다.'}`;
      }
    };
  })(window.renderQuestion);
  const originalCheck = window.checkAnswer;
  window.checkAnswer = function () {
    const q = currentExam?.questions[currentIndex]; if (!q) return;
    const answer = selected, reviewMode = !!wrongQueue, p = progress(currentExam), notes = notesFor(currentExam), idx = currentIndex;
    if (answer === null || answer === undefined || (isShort(q) && !String(answer).trim())) {
      const fb = document.getElementById('feedback'); fb.className = 'feedback show no'; fb.textContent = '답을 입력하거나 보기를 골라 주세요.'; return;
    }
    let correct = isShort(q) ? normalize(answer) === normalize(shortAnswer(q)) : answer === q.answer;
    if (isShort(q) && correct) selected = shortAnswer(q);
    originalCheck();
    const response = { date: dateToday(), kind: reviewMode ? 'review' : (correct ? 'correct' : 'wrong'), answer: String(answer), correct };
    if (!correct || reviewMode) {
      const note = notes[idx] ||= { subject: subjectOf(currentExam), questionNumber: idx + 1, firstWrongDate: dateToday(), wrongCount: 0, wrongDates: [], reviewCorrectCount: 0, reviewWrongCount: 0, history: [], status: 'pending' };
      note.subject = subjectOf(currentExam); note.questionNumber = idx + 1;
      if (!reviewMode) {
        note.firstWrongDate ||= dateToday(); note.lastWrongDate = dateToday(); note.wrongCount = (note.wrongCount || 0) + 1;
        note.wrongDates ||= []; note.wrongDates.push(dateToday()); note.status = 'pending';
      } else {
        note.reviewCorrectCount = (note.reviewCorrectCount || 0) + (correct ? 1 : 0);
        note.reviewWrongCount = (note.reviewWrongCount || 0) + (correct ? 0 : 1);
        note.lastReviewDate = dateToday(); note.status = correct ? 'mastered' : 'pending';
      }
      note.history ||= []; note.history.push(response); if (note.history.length > 100) note.history.shift();
    }
    if (isShort(q) && reviewMode) {
      p.reviewAnswers ||= {}; p.reviewAnswers[idx] = answer; p.reviewCorrect ||= {}; p.reviewCorrect[idx] = correct;
    }
    saveNotebook();
    if (reviewMode) {
      const fb = document.getElementById('feedback'); fb.textContent = `${correct ? '⭕ 맞혔어요!' : '❌ 틀렸어요.'} ${isShort(q) ? `정답: ${shortAnswer(q)}` : `정답: ${q.options[q.answer] || ''}`}`;
      const translation = document.getElementById('translation'); translation.style.display = 'block';
      document.getElementById('korean').textContent = `해설: ${q.explanation || q.korean || '해설을 확인할 수 없습니다.'}`;
    }
  };
  window.showWrongNotebook = showWrongNotebook;
  window.renderWrongNotebook = renderWrongNotebook;
  updateWrongHome();
})();
