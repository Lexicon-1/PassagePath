(function () {
  const data = window.AUTHORS_PURPOSE_DATA;
  const selectionsData = window.READING_SELECTIONS_DATA || { selections: [] };
  const stateKey = "passagePathPrototypeState";
  const legacyStateKey = "authorsPurposePrototypeState";
  const progressKey = "authorsPurposePrototypeProgress";
  const selectionProgressKey = "passagePathSelectionProgress";
  const unlockKey = "authorsPurposePrototypePremiumUnlocked";
  const liveGrades = [3, 4, 5];
  const defaultGrade = 4;

  const appRoot = document.getElementById("appRoot");
  const resetBtn = document.getElementById("resetBtn");
  const stopAudioBtn = document.getElementById("stopAudioBtn");

  if (!data || !Array.isArray(data.units)) {
    appRoot.innerHTML = '<div class="empty-state">Content could not be loaded.</div>';
    return;
  }

  const levels = data.units;
  const selections = selectionsData.selections || [];
  const defaultSelectionId = selections.find((selection) => selection.grade === defaultGrade)?.selection_id || selections[0]?.selection_id || "";
  const defaultState = {
    view: "dashboard",
    grade: defaultGrade,
    track: "selections",
    level: 1,
    passage: 0,
    selectionId: defaultSelectionId,
    selectionMode: "level",
    selectionLevel: 1,
  };
  const restoredState = readJson(stateKey, readJson(legacyStateKey, defaultState));
  let state = normalizeState(restoredState);
  let progress = readJson(progressKey, {});
  let selectionProgress = readJson(selectionProgressKey, {});
  let premiumUnlocked = readJson(unlockKey, false);

  const skillCards = [
    {
      title: "Main Idea",
      code: "MI",
      tone: "blue",
      status: "Next",
      meta: "Details and central message",
    },
    {
      title: "Compare Texts",
      code: "CT",
      tone: "amber",
      status: "Next",
      meta: "Similarities and differences",
    },
    {
      title: "Text Features",
      code: "TF",
      tone: "rose",
      status: "Next",
      meta: "Headings, captions, diagrams",
    },
  ];

  const selectionCards = [
    {
      title: selections[0]?.title || "Publisher Selections",
      code: "MV",
      tone: "teal",
      status: selections[0] ? "Ready" : "Planned",
      meta: selections[0]
        ? `${selections[0].curriculum} - Unit ${selections[0].unit}, Week ${selections[0].week}`
        : "Stories, paired texts, and unit selections",
      action: selections[0] ? "open-selection" : "",
      selectionId: selections[0]?.selection_id || "",
    },
    {
      title: "Weekly Reading Tests",
      code: "WT",
      tone: "blue",
      status: "Planned",
      meta: "Selection quizzes by grade and unit",
    },
    {
      title: "Vocabulary in Context",
      code: "VC",
      tone: "amber",
      status: "Planned",
      meta: "Selection words and spelling links",
    },
  ];

  function normalizeState(value) {
    const requestedView = value?.view;
    const requestedGrade = Number(value?.grade) || defaultGrade;
    const grade = liveGrades.includes(requestedGrade) ? requestedGrade : defaultGrade;
    const gradeSelection = selections.find((selection) => selection.grade === grade)?.selection_id || defaultSelectionId;
    return {
      ...defaultState,
      ...value,
      grade,
      track: value?.track === "selections" ? "selections" : "skills",
      view: requestedView === "practice" || requestedView === "selection" ? requestedView : "dashboard",
      level: Number(value?.level) || 1,
      passage: Number(value?.passage) || 0,
      selectionId: value?.selectionId || gradeSelection,
      selectionMode: value?.selectionMode === "standardized" ? "standardized" : "level",
      selectionLevel: Math.min(10, Math.max(1, Number(value?.selectionLevel) || 1)),
    };
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function currentUnit() {
    return levels.find((unit) => unit.level === state.level) || levels[0];
  }

  function currentPassage() {
    const unit = currentUnit();
    return unit.passages[state.passage] || unit.passages[0];
  }

  function itemProgress(itemId) {
    return progress[itemId] || null;
  }

  function selectionItemProgress(itemId) {
    return selectionProgress[itemId] || null;
  }

  function currentGradeSelections() {
    return selections.filter((selection) => selection.grade === state.grade);
  }

  function currentSelection() {
    const gradeSelections = currentGradeSelections();
    return gradeSelections.find((selection) => selection.selection_id === state.selectionId) || gradeSelections[0] || null;
  }

  function selectionAllQuestions(selection) {
    if (!selection) return [];
    const leveled = (selection.assessment_levels || []).flatMap((level) => level.questions || []);
    const standardized = selection.standardized_test?.questions || [];
    if (leveled.length || standardized.length) {
      return [...leveled, ...standardized];
    }
    return selection.questions || [];
  }

  function currentSelectionQuestions(selection) {
    if (!selection) return [];
    if (state.selectionMode === "standardized") {
      return selection.standardized_test?.questions || selection.questions || [];
    }
    const level = (selection.assessment_levels || []).find((entry) => entry.level === state.selectionLevel);
    return level?.questions || selection.questions || [];
  }

  function levelStats(level) {
    const unit = levels.find((entry) => entry.level === level) || levels[0];
    const questions = unit.passages.flatMap((passage) => passage.questions);
    const answered = questions.filter((question) => itemProgress(question.item_id));
    const correct = answered.filter((question) => itemProgress(question.item_id).correct).length;
    return { total: questions.length, answered: answered.length, correct };
  }

  function overallStats() {
    const total = levels.reduce((sum, unit) => sum + unit.item_count, 0);
    const questions = levels.flatMap((unit) => unit.passages.flatMap((passage) => passage.questions));
    const answered = questions.filter((question) => itemProgress(question.item_id)).length;
    const correct = questions.filter((question) => itemProgress(question.item_id)?.correct).length;
    return { total, answered, correct };
  }

  function selectionStats(selection) {
    const questions = selectionAllQuestions(selection);
    const answered = questions.filter((question) => selectionItemProgress(question.item_id));
    const correct = answered.filter((question) => selectionItemProgress(question.item_id).correct).length;
    return { total: questions.length, answered: answered.length, correct };
  }

  function gradeSelectionStats(grade) {
    const gradeSelections = selections.filter((selection) => selection.grade === grade);
    const questions = gradeSelections.flatMap((selection) => selectionAllQuestions(selection));
    const answered = questions.filter((question) => selectionItemProgress(question.item_id));
    const correct = answered.filter((question) => selectionItemProgress(question.item_id)?.correct).length;
    return { total: questions.length, answered: answered.length, correct, selectionCount: gradeSelections.length };
  }

  function passageComplete(passage) {
    return passage.questions.every((question) => itemProgress(question.item_id));
  }

  function isLevelUnlocked(level) {
    return level <= 3 || premiumUnlocked;
  }

  function saveState() {
    writeJson(stateKey, state);
    writeJson(progressKey, progress);
    writeJson(selectionProgressKey, selectionProgress);
    writeJson(unlockKey, premiumUnlocked);
  }

  function completionPercent() {
    const stats = overallStats();
    return stats.total ? Math.round((stats.answered / stats.total) * 100) : 0;
  }

  function selectionCompletionPercent(grade) {
    const stats = gradeSelectionStats(grade);
    return stats.total ? Math.round((stats.answered / stats.total) * 100) : 0;
  }

  function speak(text) {
    if (!("speechSynthesis" in window)) {
      window.alert("Read-aloud is not available in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.92;
    window.speechSynthesis.speak(utterance);
  }

  function stopSpeech() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }

  function render() {
    if (state.view === "practice") {
      appRoot.innerHTML = renderPracticeShell();
      return;
    }
    if (state.view === "selection") {
      appRoot.innerHTML = renderSelectionShell();
      return;
    }
    appRoot.innerHTML = renderDashboard();
  }

  function renderDashboard() {
    const skillStats = overallStats();
    const selectionGradeStatsValue = gradeSelectionStats(state.grade);
    const stats = state.track === "skills" && state.grade === 3 ? skillStats : selectionGradeStatsValue;
    const percent = state.track === "skills" && state.grade === 3 ? completionPercent() : selectionCompletionPercent(state.grade);
    return `
      <section class="dashboard-shell">
        <section class="hero-band">
          <div class="hero-copy">
            <span class="kicker">Grade ${state.grade} Reading Studio</span>
            <h2>PassagePath</h2>
            <p>Reading Skills and Selection Assessments</p>
          </div>
          <div class="hero-meter" aria-label="${percent}% complete">
            <div class="meter-ring" style="--value: ${percent}">
              <strong>${percent}%</strong>
              <span>Complete</span>
            </div>
            <div class="hero-stats">
              <span><strong>${state.track === "skills" && state.grade === 3 ? levels.length : selectionGradeStatsValue.selectionCount}</strong> ${state.track === "skills" && state.grade === 3 ? "levels" : "selection"}</span>
              <span><strong>${state.track === "skills" && state.grade === 3 ? stats.total / 2 : 10}</strong> ${state.track === "skills" && state.grade === 3 ? "passages" : "levels"}</span>
              <span><strong>${stats.total}</strong> questions</span>
            </div>
          </div>
        </section>

        <section class="grade-band" aria-label="Grade">
          <div class="section-label">Grade</div>
          <div class="grade-list">
            ${[1, 2, 3, 4, 5].map((grade) => renderGradeButton(grade)).join("")}
          </div>
        </section>

        <nav class="track-tabs" aria-label="Reading assessment tracks">
          <button class="track-tab ${state.track === "skills" ? "active" : ""}" type="button" data-action="track" data-track="skills">
            <span class="tab-mark skills-mark" aria-hidden="true">RS</span>
            <span>Reading Skills</span>
          </button>
          <button class="track-tab ${state.track === "selections" ? "active" : ""}" type="button" data-action="track" data-track="selections">
            <span class="tab-mark selections-mark" aria-hidden="true">SL</span>
            <span>Reading Selections</span>
          </button>
        </nav>

        <section class="dashboard-grid">
          ${state.track === "skills" ? renderSkillsDashboard(skillStats, completionPercent()) : renderSelectionsDashboard()}
        </section>
      </section>
    `;
  }

  function renderGradeButton(grade) {
    const active = grade === state.grade ? " active" : "";
    const disabled = liveGrades.includes(grade) ? "" : " disabled";
    const label = grade === 3 ? "Skills" : liveGrades.includes(grade) ? "Live" : "Soon";
    return `
      <button class="grade-button${active}" type="button" data-action="grade" data-grade="${grade}"${disabled}>
        <strong>G${grade}</strong>
        <span>${label}</span>
      </button>
    `;
  }

  function renderSkillsDashboard(stats, percent) {
    if (state.grade !== 3) {
      return `
        <article class="selection-hero">
          <div class="module-topline">
            <span class="module-code blue">RS</span>
            <span class="status-pill soft">Planned</span>
          </div>
          <h3>Grade ${state.grade} Reading Skills</h3>
          <p>Skill-by-skill practice for this grade will be added after the selection bank grows.</p>
          <button class="module-action primary" type="button" data-action="track" data-track="selections">Open Reading Selections</button>
        </article>
        <div class="selection-grid">
          ${skillCards.map((card) => renderComingCard({ ...card, status: "Planned" })).join("")}
        </div>
      `;
    }
    return `
      <article class="module-card live-module">
        <div class="module-topline">
          <span class="module-code teal">AP</span>
          <span class="status-pill ready">Ready</span>
        </div>
        <h3>Author's Purpose</h3>
        <p>Inform, persuade, entertain, explain, and prove answers with text evidence.</p>
        <div class="module-metrics">
          <span>${levels.length} levels</span>
          <span>${stats.total / 2} passages</span>
          <span>${stats.total} questions</span>
        </div>
        <div class="progress-track" aria-label="${percent}% complete">
          <span style="width: ${percent}%"></span>
        </div>
        <button class="module-action primary" type="button" data-action="open-module">Start Practice</button>
      </article>

      <div class="module-stack">
        ${skillCards.map((card) => renderComingCard(card)).join("")}
      </div>

      <aside class="map-panel">
        <div class="map-title">
          <span class="module-code green">G3</span>
          <div>
            <h3>Reading Skills Map</h3>
            <p>${stats.answered}/${stats.total} questions answered</p>
          </div>
        </div>
        <div class="level-ribbon">
          ${levels.map((unit) => renderRibbonLevel(unit.level)).join("")}
        </div>
      </aside>
    `;
  }

  function renderSelectionsDashboard() {
    const gradeSelections = currentGradeSelections();
    const selection = currentSelection();
    const stats = gradeSelectionStats(state.grade);
    const cards = gradeSelections.length
      ? gradeSelections.map((entry, index) => {
          const total = selectionAllQuestions(entry).length;
          const perLevel = entry.assessment_levels?.[0]?.item_count || 0;
          return {
            title: entry.title,
            code: `W${entry.week}`,
            tone: index % 3 === 0 ? "teal" : index % 3 === 1 ? "blue" : "amber",
            status: entry.selection_id === state.selectionId ? "Open" : "Ready",
            meta: `Unit ${entry.unit}, Week ${entry.week} - ${perLevel} per level - ${total} questions`,
            action: "open-selection",
            selectionId: entry.selection_id,
          };
        })
      : [
          {
            title: "Publisher Selections",
            code: "SL",
            tone: "teal",
            status: "Planned",
            meta: "Stories, paired texts, and unit selections",
          },
        ];
    return `
      <article class="selection-hero">
        <div class="module-topline">
          <span class="module-code rose">MV</span>
          <span class="status-pill ready">${selection ? "Ready" : "Planned"}</span>
        </div>
        <h3>Grade ${state.grade} Selection Assessments</h3>
        <p>${selection ? `${escapeHtml(selection.curriculum)} selections by unit and week, with leveled practice and standardized tests.` : "Publisher stories, paired passages, vocabulary, and spelling-linked reading checks."}</p>
        ${selection ? `
          <div class="module-metrics">
            <span>${gradeSelections.length} selections</span>
            <span>${stats.total} questions</span>
            <span>${stats.answered}/${stats.total} answered</span>
          </div>
          <button class="module-action primary" type="button" data-action="open-selection" data-selection="${selection.selection_id}">Continue Current Selection</button>
        ` : ""}
      </article>

      <div class="selection-grid">
        ${cards.map((card) => renderComingCard(card)).join("")}
      </div>
    `;
  }

  function renderComingCard(card) {
    const actionAttrs = card.action ? ` role="button" tabindex="0" data-action="${card.action}" data-selection="${card.selectionId}"` : "";
    return `
      <article class="mini-card${card.action ? " clickable" : ""}"${actionAttrs}>
        <span class="module-code ${card.tone}">${escapeHtml(card.code)}</span>
        <div>
          <h3>${escapeHtml(card.title)}</h3>
          <p>${escapeHtml(card.meta)}</p>
        </div>
        <span class="status-pill soft">${escapeHtml(card.status)}</span>
      </article>
    `;
  }

  function renderRibbonLevel(level) {
    const stats = levelStats(level);
    const complete = stats.answered === stats.total ? " complete" : "";
    const locked = isLevelUnlocked(level) ? "" : " locked";
    return `<span class="ribbon-node${complete}${locked}">${level}</span>`;
  }

  function renderSelectionShell() {
    const selection = currentSelection();
    if (!selection) {
      return '<div class="empty-state">No reading selection has been loaded yet.</div>';
    }

    const stats = selectionStats(selection);
    const questions = currentSelectionQuestions(selection);
    const currentLevel = (selection.assessment_levels || []).find((level) => level.level === state.selectionLevel);
    const currentLabel = state.selectionMode === "standardized"
      ? "Standardized Test"
      : `${currentLevel?.level_name || `Level ${state.selectionLevel}`} - ${currentLevel?.difficulty_band || "practice"}`;
    return `
      <div class="selection-shell">
        <section class="selection-header">
          <button class="back-button" type="button" data-action="dashboard">
            <span aria-hidden="true"></span>
            Map
          </button>
          <div>
            <p class="practice-kicker">${escapeHtml(selection.curriculum)} - Grade ${selection.grade}</p>
            <h2>${escapeHtml(selection.title)}</h2>
            <div class="practice-meta">Unit ${selection.unit}, Week ${selection.week} - ${escapeHtml(selection.genre)}</div>
          </div>
          <div class="score-box">
            <strong>${stats.correct}/${stats.total}</strong>
            <span>${stats.answered} answered</span>
          </div>
        </section>

        <section class="selection-overview">
          <article class="selection-text-card">
            <div class="block-head">
              <h3>Textbook Reading</h3>
              <button class="listen-button" type="button" data-speak="${escapeHtml(selection.read_aloud)}">Listen</button>
            </div>
            <div class="publisher-note">
              <strong>Publisher text not included.</strong>
              <p>${escapeHtml(selection.text_policy)}</p>
            </div>
            <dl class="selection-facts">
              <div><dt>Essential Question</dt><dd>${escapeHtml(selection.essential_question)}</dd></div>
              <div><dt>Weekly Question</dt><dd>${escapeHtml(selection.weekly_question)}</dd></div>
              <div><dt>Reading Skill</dt><dd>${escapeHtml(selection.reading_skill)}</dd></div>
              <div><dt>Strategy</dt><dd>${escapeHtml(selection.reading_strategy)}</dd></div>
            </dl>
            <div class="vocab-strip">
              ${selection.vocabulary.map((word) => `<span>${escapeHtml(word)}</span>`).join("")}
            </div>
          </article>

          <div class="selection-question-list">
            <div class="selection-mode-tabs" aria-label="Assessment mode">
              <button class="${state.selectionMode === "level" ? "active" : ""}" type="button" data-action="selection-mode" data-mode="level">10 Levels</button>
              <button class="${state.selectionMode === "standardized" ? "active" : ""}" type="button" data-action="selection-mode" data-mode="standardized">Standardized Test</button>
            </div>
            ${state.selectionMode === "level" ? `
              <div class="selection-level-strip" aria-label="Selection levels">
                ${selection.assessment_levels.map((level) => renderSelectionLevelButton(level)).join("")}
              </div>
            ` : ""}
            <div class="question-set-heading">
              <strong>${escapeHtml(currentLabel)}</strong>
              <span>${questions.length} questions</span>
            </div>
            ${questions.map((question) => renderSelectionQuestion(question)).join("")}
          </div>
        </section>
      </div>
    `;
  }

  function renderSelectionLevelButton(level) {
    const active = level.level === state.selectionLevel ? " active" : "";
    return `
      <button class="selection-level-button${active}" type="button" data-action="selection-level" data-level="${level.level}">
        <strong>${level.level}</strong>
        <span>${level.item_count}</span>
      </button>
    `;
  }

  function renderSelectionQuestion(question) {
    const saved = selectionItemProgress(question.item_id);
    const feedback = saved ? renderSelectionFeedback(question, saved) : "";
    const choices = Object.entries(question.choices)
      .map(([letter, text]) => {
        const selected = saved?.selected === letter;
        const correct = question.correct_choice === letter;
        let className = "choice-button";
        if (saved && selected && correct) className += " correct";
        else if (saved && selected && !correct) className += " incorrect";
        else if (saved && correct) className += " correct";
        else if (selected) className += " selected";

        return `
          <button class="${className}" type="button" data-action="selection-answer" data-item="${question.item_id}" data-choice="${letter}">
            <span class="choice-letter">${letter}</span>
            <span>${escapeHtml(text)}</span>
          </button>
        `;
      })
      .join("");

    return `
      <section class="question-block">
        <div class="question-title">
          <button class="listen-button" type="button" data-speak="${escapeHtml(question.read_aloud)}">Listen</button>
          <div>
            ${question.excerpt ? `<p class="question-excerpt">${escapeHtml(question.excerpt)}</p>` : ""}
            <p>${escapeHtml(question.stem)}</p>
          </div>
        </div>
        <div class="choice-list">${choices}</div>
        ${feedback}
      </section>
    `;
  }

  function renderSelectionFeedback(question, saved) {
    const isCorrect = saved.correct;
    const label = isCorrect ? "Correct" : "Try again";
    const className = isCorrect ? "correct" : "incorrect";
    const correctText = question.choices[question.correct_choice];
    return `
      <div class="feedback ${className}">
        <strong>${label}.</strong>
        ${isCorrect ? "" : `Correct answer: ${escapeHtml(question.correct_choice)}. ${escapeHtml(correctText)}`}
        <br>${escapeHtml(question.rationale)}
        <br><strong>Evidence habit:</strong> ${escapeHtml(question.text_evidence)}
      </div>
    `;
  }

  function renderPracticeShell() {
    const stats = overallStats();
    return `
      <div class="practice-layout">
        <aside class="level-panel" aria-label="Levels">
          <div class="panel-heading">
            <button class="back-button" type="button" data-action="dashboard">
              <span aria-hidden="true"></span>
              Map
            </button>
            <strong>${stats.correct}/${stats.total}</strong>
          </div>
          <div class="level-list">${renderLevels()}</div>
        </aside>
        <section class="practice-panel" aria-live="polite">${renderPracticePanel()}</section>
      </div>
    `;
  }

  function renderLevels() {
    return levels
      .map((unit) => {
        const stats = levelStats(unit.level);
        const active = unit.level === state.level ? " active" : "";
        const unlocked = isLevelUnlocked(unit.level);
        const locked = unlocked ? "" : " locked";
        const badgeClass = unit.level <= 3 || unlocked ? "free" : "locked";
        const badgeText = unit.level <= 3 ? "Free" : unlocked ? "Open" : "Locked";
        return `
          <button class="level-card${active}${locked}" type="button" data-action="level" data-level="${unit.level}">
            <span class="level-number">${unit.level}</span>
            <span>
              <span class="level-title">Level ${unit.level}</span>
              <span class="level-meta">${stats.answered}/${stats.total} answered - ${stats.correct} correct</span>
            </span>
            <span class="badge ${badgeClass}">${badgeText}</span>
          </button>
        `;
      })
      .join("");
  }

  function renderPracticePanel() {
    const unit = currentUnit();
    const stats = levelStats(unit.level);
    if (!isLevelUnlocked(unit.level)) {
      return renderLockedLevel(unit, stats);
    }

    const passage = currentPassage();
    const passageNumber = state.passage + 1;
    const allDone = unit.passages.every((entry) => passageComplete(entry));

    return `
      <div class="practice-header">
        <div>
          <p class="practice-kicker">Author's Purpose</p>
          <h2>Level ${unit.level}</h2>
          <div class="practice-meta">${unit.level_name || "Author's Purpose Practice"} - Passage ${passageNumber} of ${unit.passages.length}</div>
        </div>
        <div class="score-box">
          <strong>${stats.correct}/${stats.total}</strong>
          <span>${stats.answered} answered in this level</span>
        </div>
      </div>

      <div class="passage-nav">
        <button class="nav-button" type="button" data-action="prev" ${state.passage === 0 ? "disabled" : ""}>Previous</button>
        <div class="passage-dots" aria-label="Passages">${renderPassageDots(unit)}</div>
        <button class="nav-button" type="button" data-action="next" ${state.passage === unit.passages.length - 1 ? "disabled" : ""}>Next</button>
      </div>

      <div class="content-grid">
        <article class="passage-block">
          <div class="block-head">
            <h3>${escapeHtml(passage.title)}</h3>
            <button class="listen-button" type="button" data-speak="${escapeHtml(passage.passage_read_aloud)}">Listen</button>
          </div>
          <div class="passage-text">${escapeHtml(passage.passage_text)}</div>
        </article>

        <div class="question-stack">
          ${passage.questions.map((question) => renderQuestion(question)).join("")}
        </div>

        ${allDone ? renderLevelComplete(unit.level, stats) : ""}
      </div>
    `;
  }

  function renderLockedLevel(unit, stats) {
    return `
      <div class="practice-header">
        <div>
          <p class="practice-kicker">Author's Purpose</p>
          <h2>Level ${unit.level}</h2>
          <div class="practice-meta">${unit.level_name || "Author's Purpose Practice"} - Premium level</div>
        </div>
        <div class="score-box">
          <strong>${stats.correct}/${stats.total}</strong>
          <span>${stats.answered} answered in this level</span>
        </div>
      </div>

      <div class="locked-panel">
        <div class="lock-mark" aria-hidden="true">L${unit.level}</div>
        <h3>Level ${unit.level} is locked</h3>
        <p>Unlock Levels 4-10 for this topic with a small topic pass, by watching short ads, or through teacher preview access.</p>
        <div class="unlock-actions">
          <button class="nav-button primary" type="button" data-action="preview-unlock">$2 Topic Pass</button>
          <button class="nav-button" type="button" data-action="preview-unlock">Watch 2 Ads</button>
          <button class="nav-button" type="button" data-action="preview-unlock">Teacher Preview</button>
        </div>
      </div>
    `;
  }

  function renderPassageDots(unit) {
    return unit.passages
      .map((passage, index) => {
        const current = index === state.passage ? " current" : "";
        const done = passageComplete(passage) ? " done" : "";
        return `<button class="dot-button${current}${done}" type="button" data-action="jump" data-passage="${index}" aria-label="Passage ${index + 1}">${index + 1}</button>`;
      })
      .join("");
  }

  function renderQuestion(question) {
    const saved = itemProgress(question.item_id);
    const feedback = saved ? renderFeedback(question, saved) : "";
    const choices = Object.entries(question.choices)
      .map(([letter, text]) => {
        const selected = saved?.selected === letter;
        const correct = question.correct_choice === letter;
        let className = "choice-button";
        if (saved && selected && correct) className += " correct";
        else if (saved && selected && !correct) className += " incorrect";
        else if (saved && correct) className += " correct";
        else if (selected) className += " selected";

        return `
          <button class="${className}" type="button" data-action="answer" data-item="${question.item_id}" data-choice="${letter}">
            <span class="choice-letter">${letter}</span>
            <span>${escapeHtml(text)}</span>
          </button>
        `;
      })
      .join("");

    return `
      <section class="question-block">
        <div class="question-title">
          <button class="listen-button" type="button" data-speak="${escapeHtml(question.read_aloud)}">Listen</button>
          <p>${escapeHtml(question.stem)}</p>
        </div>
        <div class="choice-list">${choices}</div>
        ${feedback}
      </section>
    `;
  }

  function renderFeedback(question, saved) {
    const isCorrect = saved.correct;
    const label = isCorrect ? "Correct" : "Try again";
    const className = isCorrect ? "correct" : "incorrect";
    const correctText = question.choices[question.correct_choice];
    return `
      <div class="feedback ${className}">
        <strong>${label}.</strong>
        ${isCorrect ? "" : `Correct answer: ${escapeHtml(question.correct_choice)}. ${escapeHtml(correctText)}`}
        <br>${escapeHtml(question.rationale)}
        <br><strong>Evidence:</strong> ${escapeHtml(question.text_evidence)}
      </div>
    `;
  }

  function renderLevelComplete(level, stats) {
    return `
      <div class="level-complete">
        <h3>Level ${level} Complete</h3>
        <p>You answered all questions in this level. Score: <strong>${stats.correct}/${stats.total}</strong>.</p>
      </div>
    `;
  }

  function chooseAnswer(itemId, choice) {
    const question = levels
      .flatMap((unit) => unit.passages)
      .flatMap((passage) => passage.questions)
      .find((entry) => entry.item_id === itemId);

    if (!question) return;
    progress[itemId] = {
      selected: choice,
      correct: choice === question.correct_choice,
      answered_at: new Date().toISOString(),
    };
    saveState();
    render();
  }

  function chooseSelectionAnswer(itemId, choice) {
    const question = selections
      .flatMap((selection) => selectionAllQuestions(selection))
      .find((entry) => entry.item_id === itemId);

    if (!question) return;
    selectionProgress[itemId] = {
      selected: choice,
      correct: choice === question.correct_choice,
      answered_at: new Date().toISOString(),
    };
    saveState();
    render();
  }

  document.addEventListener("click", (event) => {
    const speakButton = event.target.closest("[data-speak]");
    if (speakButton) {
      speak(speakButton.dataset.speak);
      return;
    }

    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) return;

    const action = actionButton.dataset.action;
    if (action === "dashboard") {
      state.view = "dashboard";
      saveState();
      stopSpeech();
      render();
    }
    if (action === "track") {
      state.track = actionButton.dataset.track === "selections" ? "selections" : "skills";
      state.view = "dashboard";
      saveState();
      stopSpeech();
      render();
    }
    if (action === "grade") {
      const grade = Number(actionButton.dataset.grade);
      if (!liveGrades.includes(grade)) return;
      state.grade = grade;
      state.view = "dashboard";
      state.track = grade === 4 ? "selections" : "skills";
      state.selectionId = selections.find((selection) => selection.grade === grade)?.selection_id || defaultSelectionId;
      state.selectionMode = "level";
      state.selectionLevel = 1;
      saveState();
      stopSpeech();
      render();
    }
    if (action === "open-module") {
      state.view = "practice";
      state.track = "skills";
      state.level = 1;
      state.passage = 0;
      saveState();
      stopSpeech();
      render();
    }
    if (action === "open-selection") {
      state.view = "selection";
      state.track = "selections";
      state.selectionId = actionButton.dataset.selection || defaultSelectionId;
      state.selectionMode = "level";
      state.selectionLevel = 1;
      saveState();
      stopSpeech();
      render();
    }
    if (action === "selection-mode") {
      state.selectionMode = actionButton.dataset.mode === "standardized" ? "standardized" : "level";
      saveState();
      stopSpeech();
      render();
    }
    if (action === "selection-level") {
      state.selectionMode = "level";
      state.selectionLevel = Math.min(10, Math.max(1, Number(actionButton.dataset.level) || 1));
      saveState();
      stopSpeech();
      render();
    }
    if (action === "level") {
      state.level = Number(actionButton.dataset.level);
      state.passage = 0;
      state.view = "practice";
      saveState();
      stopSpeech();
      render();
    }
    if (action === "prev") {
      state.passage = Math.max(0, state.passage - 1);
      saveState();
      stopSpeech();
      render();
    }
    if (action === "next") {
      const unit = currentUnit();
      state.passage = Math.min(unit.passages.length - 1, state.passage + 1);
      saveState();
      stopSpeech();
      render();
    }
    if (action === "jump") {
      state.passage = Number(actionButton.dataset.passage);
      saveState();
      stopSpeech();
      render();
    }
    if (action === "answer") {
      chooseAnswer(actionButton.dataset.item, actionButton.dataset.choice);
    }
    if (action === "selection-answer") {
      chooseSelectionAnswer(actionButton.dataset.item, actionButton.dataset.choice);
    }
    if (action === "preview-unlock") {
      premiumUnlocked = true;
      saveState();
      stopSpeech();
      render();
    }
  });

  resetBtn.addEventListener("click", () => {
    if (!window.confirm("Reset all local progress for this prototype?")) return;
    progress = {};
    selectionProgress = {};
    premiumUnlocked = false;
    state = { ...defaultState };
    saveState();
    stopSpeech();
    render();
  });

  stopAudioBtn.addEventListener("click", stopSpeech);

  render();
})();
