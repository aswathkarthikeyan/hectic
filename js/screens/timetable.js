// Hectic — Timetable Setup Screen
// Weekly grid entry for fixed schedule, type tagging (Lecture/Lab/Elective), import/export

import db from '../db.js';

let currentContainer = null;
let currentDay = new Date().getDay() || 1; // Default to today, or Mon if Sun
const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const dayShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function render(container) {
  currentContainer = container;
  const mascot = window.getMascotSVG ? window.getMascotSVG('thinking') : '🤓';

  container.innerHTML = `
    <div style="padding: 0 var(--space-lg) var(--space-lg);">
      <div class="greeting" style="justify-content: center; flex-direction: column; align-items: center; text-align: center; padding: var(--space-md) 0;">
        <div class="mascot--md">${mascot}</div>
        <div class="greeting__hello" style="font-size: var(--font-size-lg);">Your Weekly Grind 📚</div>
        <div class="greeting__sub">Set up your fixed timetable once. Edit anytime!</div>
      </div>

      <!-- Day Tabs -->
      <div class="day-tabs" id="day-tabs">
        ${[1, 2, 3, 4, 5, 6, 0].map(d => `
          <button class="day-tab ${d === currentDay ? 'active' : ''} ${d === 0 ? 'hidden' : ''}"
            data-day="${d}">${dayShort[d]}</button>
        `).join('')}
        <button class="day-tab" id="toggle-sun-btn" style="font-size: 12px; padding: 6px 10px;" title="Toggle Sunday">
          👁️ Sun
        </button>
      </div>

      <!-- Day Title -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin: var(--space-md) 0 var(--space-sm);">
        <div style="font-weight: 800; font-size: var(--font-size-md);" id="day-title">
          ${dayNames[currentDay]}
        </div>
        <span class="text-sm text-muted" id="day-block-count">0 classes</span>
      </div>

      <!-- Class Blocks List -->
      <div id="blocks-list"></div>

      <!-- Add Block Button -->
      <button class="add-block-btn" id="add-block-btn">
        + Add a class to ${dayNames[currentDay]}
      </button>

      <!-- Import / Export Section -->
      <div style="margin-top: var(--space-2xl); border-top: 1px dashed var(--border-medium); padding-top: var(--space-lg);">
        <div class="section-title" style="font-size: var(--font-size-base); margin-bottom: var(--space-sm);">
          💾 Backup & Sync
        </div>
        <div class="io-buttons">
          <button class="btn btn--secondary btn--sm" id="export-tt-btn" style="flex: 1;">📤 Export Timetable</button>
          <button class="btn btn--secondary btn--sm" id="import-tt-btn" style="flex: 1;">📥 Import Timetable</button>
          <input type="file" id="import-file" accept=".json" style="display: none;" />
        </div>
      </div>
    </div>
  `;
}

export async function init() {
  if (!currentContainer) return;
  setupDayTabs();
  setupAddBlock();
  setupImportExport();
  await loadBlocks();
}

function setupDayTabs() {
  currentContainer.querySelectorAll('.day-tab[data-day]').forEach(tab => {
    tab.addEventListener('click', () => {
      currentContainer.querySelectorAll('.day-tab[data-day]').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentDay = Number(tab.dataset.day);
      currentContainer.querySelector('#day-title').textContent = dayNames[currentDay];
      currentContainer.querySelector('#add-block-btn').textContent = `+ Add a class to ${dayNames[currentDay]}`;
      loadBlocks();
    });
  });

  // Toggle Sunday visibility
  const sunTab = currentContainer.querySelector('.day-tab[data-day="0"]');
  const toggleBtn = currentContainer.querySelector('#toggle-sun-btn');
  if (toggleBtn && sunTab) {
    toggleBtn.addEventListener('click', () => {
      sunTab.classList.toggle('hidden');
      toggleBtn.textContent = sunTab.classList.contains('hidden') ? '👁️ Sun' : '🙈 Hide Sun';
    });
  }
}

function setupAddBlock() {
  currentContainer.querySelector('#add-block-btn').addEventListener('click', async () => {
    // Pick standard default time after previous block
    const allBlocks = await db.getTimetable();
    const dayBlocks = allBlocks.filter(b => b.dayOfWeek === currentDay).sort((a, b) => a.startTime.localeCompare(b.startTime));

    let defaultStart = '09:00';
    let defaultEnd = '10:00';
    if (dayBlocks.length > 0) {
      const last = dayBlocks[dayBlocks.length - 1];
      defaultStart = last.endTime;
      const [h, m] = defaultStart.split(':').map(Number);
      defaultEnd = `${String(Math.min(23, h + 1)).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    await db.addTimetableBlock({
      dayOfWeek: currentDay,
      subject: '',
      startTime: defaultStart,
      endTime: defaultEnd,
      type: 'Lecture'
    });

    await loadBlocks();

    setTimeout(() => {
      const inputs = currentContainer.querySelectorAll('.block-subject');
      if (inputs.length > 0) inputs[inputs.length - 1].focus();
    }, 100);
  });
}

function setupImportExport() {
  // Export
  currentContainer.querySelector('#export-tt-btn').addEventListener('click', async () => {
    const data = await db.getTimetable();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hectic-timetable.json';
    a.click();
    URL.revokeObjectURL(url);
    if (window.showToast) window.showToast('Timetable exported! 📤', 'success');
  });

  // Import
  const fileInput = currentContainer.querySelector('#import-file');
  currentContainer.querySelector('#import-tt-btn').addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!Array.isArray(data)) throw new Error('Invalid format: expected array');
        if (!confirm(`Import ${data.length} class blocks? This will replace your current timetable schedule.`)) return;

        // Clear existing
        const existing = await db.getTimetable();
        for (const b of existing) await db.deleteTimetableBlock(b.id);

        // Add imported
        for (const b of data) {
          delete b.id;
          await db.addTimetableBlock(b);
        }

        await loadBlocks();
        if (window.showToast) window.showToast(`Successfully imported ${data.length} classes! 📥`, 'success');
      } catch (err) {
        if (window.showToast) window.showToast('Invalid JSON file format 😕', 'error');
      }
    };
    reader.readAsText(file);
    fileInput.value = '';
  });
}

async function loadBlocks() {
  const listEl = currentContainer.querySelector('#blocks-list');
  const countEl = currentContainer.querySelector('#day-block-count');
  const allBlocks = await db.getTimetable();
  const dayBlocks = allBlocks
    .filter(b => b.dayOfWeek === currentDay)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  countEl.textContent = `${dayBlocks.length} class${dayBlocks.length !== 1 ? 'es' : ''}`;

  if (dayBlocks.length === 0) {
    const mascot = window.getMascotSVG ? window.getMascotSVG('happy') : '🎉';
    listEl.innerHTML = `
      <div class="empty-state" style="padding: var(--space-xl);">
        <div class="empty-state__mascot">${mascot}</div>
        <div class="empty-state__text">No classes on ${dayNames[currentDay]}! 🎉</div>
        <div class="empty-state__sub">Schedule is free. Tap "+ Add a class" below to enter your routine.</div>
      </div>
    `;
    return;
  }

  // Autocomplete list from other subjects
  const existingSubjects = [...new Set(allBlocks.map(b => b.subject).filter(Boolean))];

  listEl.innerHTML = dayBlocks.map(b => `
    <div class="block-entry" data-block-id="${b.id}">
      <div class="block-entry__row">
        <input type="text" class="form-input block-subject" value="${b.subject || ''}"
          placeholder="Subject name... e.g. Data Structures" list="subject-suggestions" style="flex: 1; font-weight: 700;" />
        <button class="btn btn--icon btn--danger delete-block-btn" data-id="${b.id}" title="Delete class">🗑️</button>
      </div>

      <div class="block-entry__row block-entry__time">
        <input type="time" class="form-input block-start" value="${b.startTime}" style="flex: 1;" />
        <span class="block-entry__time-sep">→</span>
        <input type="time" class="form-input block-end" value="${b.endTime}" style="flex: 1;" />
      </div>

      <div class="block-entry__row">
        <div class="segmented" style="width: 100%;">
          <button type="button" class="segmented__option ${b.type === 'Lecture' ? 'active' : ''}" data-type="Lecture">📖 Lecture</button>
          <button type="button" class="segmented__option ${b.type === 'Lab' ? 'active' : ''}" data-type="Lab">🔬 Lab</button>
          <button type="button" class="segmented__option ${b.type === 'Elective' ? 'active' : ''}" data-type="Elective">📝 Elective</button>
          <button type="button" class="segmented__option ${b.type === 'Other' ? 'active' : ''}" data-type="Other">📌 Other</button>
        </div>
      </div>
    </div>
  `).join('') + `
    <datalist id="subject-suggestions">
      ${existingSubjects.map(s => `<option value="${s}">`).join('')}
    </datalist>
  `;

  // Bind events for live saving
  listEl.querySelectorAll('.block-entry').forEach(entry => {
    const blockId = Number(entry.dataset.blockId);

    const saveBlock = async () => {
      const block = await db.getTimetableBlock(blockId);
      if (!block) return;
      block.subject = entry.querySelector('.block-subject').value.trim();
      block.startTime = entry.querySelector('.block-start').value;
      block.endTime = entry.querySelector('.block-end').value;
      await db.updateTimetableBlock(block);
    };

    entry.querySelectorAll('input').forEach(input => {
      input.addEventListener('change', saveBlock);
      input.addEventListener('blur', saveBlock);
    });

    // Segmented type control
    entry.querySelectorAll('.segmented__option').forEach(opt => {
      opt.addEventListener('click', async () => {
        entry.querySelectorAll('.segmented__option').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        const block = await db.getTimetableBlock(blockId);
        if (block) {
          block.type = opt.dataset.type;
          await db.updateTimetableBlock(block);
        }
      });
    });

    // Delete
    entry.querySelector('.delete-block-btn').addEventListener('click', async () => {
      if (confirm('Remove this class?')) {
        await db.deleteTimetableBlock(blockId);
        await loadBlocks();
        if (window.showToast) window.showToast('Class removed', 'warning');
      }
    });
  });
}
