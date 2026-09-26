// Hectic — Tasks Screen
// High Utility, List & Interactive Calendar Views, Subject Autocomplete, Pattern Autofills, 3-Way Deadline Input

import db from '../db.js';
import { parseDatePhrase, formatDate, daysUntil, isToday, isTomorrow, getQuickChips, getLocalDateStr } from '../utils/date-parser.js';
import deadlineLearner from '../utils/deadline-learner.js';

let currentContainer = null;
let currentFilter = 'all';
let viewMode = 'list'; // 'list' | 'calendar'
let expandedTaskId = null;

// Calendar navigation state
const initialDate = new Date();
let calYear = initialDate.getFullYear();
let calMonth = initialDate.getMonth();
let selectedDateStr = getLocalDateStr(initialDate);

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function render(container) {
  currentContainer = container;
  container.innerHTML = `
    <div style="padding: 0 var(--space-lg) var(--space-lg);">
      <!-- Header & Add Button -->
      <div class="section-header" style="margin-top: var(--space-sm);">
        <div class="section-title">📝 Tasks & Deadlines</div>
        <button class="btn btn--primary btn--sm" id="new-task-btn">+ New Task</button>
      </div>

      <!-- Segmented View Switcher: List vs Calendar -->
      <div class="view-switcher" id="view-switcher">
        <button class="view-switch-btn ${viewMode === 'list' ? 'active' : ''}" id="view-mode-list-btn">📋 List View</button>
        <button class="view-switch-btn ${viewMode === 'calendar' ? 'active' : ''}" id="view-mode-calendar-btn">📅 Calendar View</button>
      </div>

      <!-- New Task Drawer (hidden by default) -->
      <div id="new-task-drawer" class="card hidden" style="border: 2px solid var(--purple-light); background: var(--bg-card); margin-bottom: var(--space-lg);">
        <div style="font-weight: 800; font-size: var(--font-size-md); margin-bottom: var(--space-sm); color: var(--purple-deep);">
          ⚡ Quick Task Creator
        </div>

        <!-- Quick Template Buttons -->
        <div style="margin-bottom: var(--space-sm);">
          <div class="text-sm text-muted" style="font-weight: 700; margin-bottom: 4px;">1-Tap Templates:</div>
          <div class="chip-row" id="task-template-chips">
            <button type="button" class="chip template-chip" data-title="Lab Report" data-prio="High">🔬 Lab Report</button>
            <button type="button" class="chip template-chip" data-title="Problem Set" data-prio="Medium">📐 Problem Set</button>
            <button type="button" class="chip template-chip" data-title="Project Presentation" data-prio="High">📊 Project</button>
            <button type="button" class="chip template-chip" data-title="Chapter Reading" data-prio="Low">📖 Reading</button>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Task Title</label>
          <input type="text" class="form-input" id="new-task-title" placeholder="e.g. Operating Systems Lab 2" autocomplete="off" />
        </div>

        <div class="form-group">
          <label class="form-label">Subject / Class (Autofills Deadline!)</label>
          <div style="display: flex; gap: var(--space-sm);">
            <select class="form-input" id="new-task-subject-select" style="flex: 1;">
              <option value="">Select a Subject...</option>
            </select>
            <input type="text" class="form-input" id="new-task-subject-custom" placeholder="Or type new..." style="flex: 1;" />
          </div>
          <div id="new-task-pattern-suggestion" class="hidden" style="margin-top: 6px;"></div>
        </div>

        <div class="form-group">
          <label class="form-label">Deadline</label>
          <!-- Natural Text & Date Picker -->
          <div style="display: flex; gap: var(--space-sm); margin-bottom: var(--space-sm);">
            <input type="text" class="form-input" id="new-task-natural" placeholder='e.g. "due in 2 days", "next fri"...' style="flex: 1;" />
            <input type="date" class="form-input" id="new-task-date" style="flex: 1;" />
          </div>
          <div id="new-task-date-preview" class="hidden" style="margin-bottom: 6px;"></div>
          <!-- Quick Chips -->
          <div class="chip-row" id="new-task-chips"></div>
        </div>

        <div class="form-group">
          <label class="form-label">Priority</label>
          <div class="priority-toggle" id="new-task-priority-toggle">
            <button type="button" class="priority-toggle__option high" data-prio="High">🔴 High</button>
            <button type="button" class="priority-toggle__option medium active" data-prio="Medium">🟡 Medium</button>
            <button type="button" class="priority-toggle__option low" data-prio="Low">🔵 Low</button>
          </div>
        </div>

        <div style="display: flex; gap: var(--space-sm); margin-top: var(--space-md);">
          <button class="btn btn--secondary btn--sm" id="cancel-new-task-btn" style="flex: 1;">Cancel</button>
          <button class="btn btn--primary btn--sm" id="save-new-task-btn" style="flex: 1;">💾 Add Task</button>
        </div>
      </div>

      <!-- ================= LIST VIEW ================= -->
      <div id="tasks-list-view" class="${viewMode === 'list' ? '' : 'hidden'}">
        <!-- Filter Bar -->
        <div class="filter-bar" id="tasks-filter-bar">
          <button class="filter-btn active" data-filter="all">All</button>
          <button class="filter-btn" data-filter="high">🔴 High</button>
          <button class="filter-btn" data-filter="soon">⏰ Due Soon</button>
          <button class="filter-btn" data-filter="overdue">🚨 Overdue</button>
          <select id="subject-filter" class="filter-btn" style="border: 1.5px solid var(--border-light); background: var(--bg-card); padding: 6px 12px; border-radius: var(--radius-pill);">
            <option value="">By Subject...</option>
          </select>
        </div>

        <!-- Sort Control -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-sm);">
          <span class="text-sm text-muted" id="active-filter-label">Showing all open tasks</span>
          <select id="sort-control" class="text-sm" style="border: none; background: none; color: var(--text-muted); font-weight: 700;">
            <option value="deadline">Sort: Deadline ↑</option>
            <option value="priority">Sort: Priority ↓</option>
            <option value="created">Sort: Newest First</option>
          </select>
        </div>

        <!-- Open Tasks List -->
        <div id="open-tasks"></div>

        <!-- Completed Tasks Collapsible -->
        <details class="mt-lg" id="done-section">
          <summary style="font-weight: 700; color: var(--text-secondary); cursor: pointer; padding: var(--space-sm) 0;">
            ✅ Completed (<span id="done-count">0</span>)
          </summary>
          <div id="done-tasks" style="margin-top: var(--space-sm);"></div>
        </details>

        <!-- Dismissed Tasks Collapsible -->
        <details class="mt-md" id="dismissed-section">
          <summary style="font-weight: 700; color: var(--text-muted); cursor: pointer; padding: var(--space-sm) 0;">
            🚫 Dismissed (<span id="dismissed-count">0</span>)
          </summary>
          <div id="dismissed-tasks" style="margin-top: var(--space-sm);"></div>
        </details>
      </div>

      <!-- ================= CALENDAR VIEW ================= -->
      <div id="tasks-calendar-view" class="${viewMode === 'calendar' ? '' : 'hidden'}">
        <!-- Calendar Container Card -->
        <div class="calendar-card">
          <div class="calendar-header">
            <div class="calendar-month-title" id="calendar-month-label">Month Year</div>
            <div class="calendar-nav-group">
              <button class="calendar-today-btn" id="calendar-today-btn">Today</button>
              <button class="calendar-nav-btn" id="calendar-prev-btn" title="Previous Month">◀</button>
              <button class="calendar-nav-btn" id="calendar-next-btn" title="Next Month">▶</button>
            </div>
          </div>

          <div class="calendar-weekdays">
            <div class="calendar-weekday">Su</div>
            <div class="calendar-weekday">Mo</div>
            <div class="calendar-weekday">Tu</div>
            <div class="calendar-weekday">We</div>
            <div class="calendar-weekday">Th</div>
            <div class="calendar-weekday">Fr</div>
            <div class="calendar-weekday">Sa</div>
          </div>

          <div class="calendar-grid" id="calendar-grid"></div>
        </div>

        <!-- Selected Day Tasks Panel -->
        <div class="calendar-day-panel" id="calendar-day-panel">
          <div class="calendar-day-panel__header">
            <div class="calendar-day-panel__title" id="calendar-day-title">Selected Date</div>
            <button class="btn btn--secondary btn--sm" id="calendar-add-for-day-btn">+ Add for this day</button>
          </div>
          <div id="calendar-day-tasks"></div>
        </div>
      </div>
    </div>
  `;
}

export async function init() {
  if (!currentContainer) return;
  setupViewSwitcher();
  setupNewTaskDrawer();
  setupFilters();
  setupCalendarControls();
  await loadSubjects();
  await renderCurrentView();
}

function setupViewSwitcher() {
  const listBtn = currentContainer.querySelector('#view-mode-list-btn');
  const calBtn = currentContainer.querySelector('#view-mode-calendar-btn');
  const listView = currentContainer.querySelector('#tasks-list-view');
  const calView = currentContainer.querySelector('#tasks-calendar-view');

  listBtn.addEventListener('click', async () => {
    viewMode = 'list';
    listBtn.classList.add('active');
    calBtn.classList.remove('active');
    listView.classList.remove('hidden');
    calView.classList.add('hidden');
    await loadAllTasks();
  });

  calBtn.addEventListener('click', async () => {
    viewMode = 'calendar';
    calBtn.classList.add('active');
    listBtn.classList.remove('active');
    calView.classList.remove('hidden');
    listView.classList.add('hidden');
    await renderCalendar();
  });
}

async function renderCurrentView() {
  if (viewMode === 'calendar') {
    await renderCalendar();
  } else {
    await loadAllTasks();
  }
}

/* ================= CALENDAR LOGIC ================= */
function setupCalendarControls() {
  const prevBtn = currentContainer.querySelector('#calendar-prev-btn');
  const nextBtn = currentContainer.querySelector('#calendar-next-btn');
  const todayBtn = currentContainer.querySelector('#calendar-today-btn');
  const addDayBtn = currentContainer.querySelector('#calendar-add-for-day-btn');

  prevBtn.addEventListener('click', async () => {
    calMonth--;
    if (calMonth < 0) {
      calMonth = 11;
      calYear--;
    }
    await renderCalendar();
  });

  nextBtn.addEventListener('click', async () => {
    calMonth++;
    if (calMonth > 11) {
      calMonth = 0;
      calYear++;
    }
    await renderCalendar();
  });

  todayBtn.addEventListener('click', async () => {
    const now = new Date();
    calYear = now.getFullYear();
    calMonth = now.getMonth();
    selectedDateStr = getLocalDateStr(now);
    await renderCalendar();
  });

  addDayBtn.addEventListener('click', () => {
    const drawer = currentContainer.querySelector('#new-task-drawer');
    const dateInput = currentContainer.querySelector('#new-task-date');
    const titleInput = currentContainer.querySelector('#new-task-title');
    dateInput.value = selectedDateStr;
    drawer.classList.remove('hidden');
    drawer.scrollIntoView({ behavior: 'smooth' });
    titleInput.focus();
  });
}

async function renderCalendar() {
  const monthLabel = currentContainer.querySelector('#calendar-month-label');
  const grid = currentContainer.querySelector('#calendar-grid');
  if (!monthLabel || !grid) return;

  monthLabel.textContent = `${MONTH_NAMES[calMonth]} ${calYear}`;

  const allTasks = await db.getTasks();
  const todayStr = getLocalDateStr(new Date());

  // Map tasks by YYYY-MM-DD
  const tasksByDate = {};
  allTasks.forEach(task => {
    if (!task.deadline) return;
    const dStr = task.deadline.split('T')[0];
    if (!tasksByDate[dStr]) tasksByDate[dStr] = [];
    tasksByDate[dStr].push(task);
  });

  // Calculate calendar grid days
  const firstDayIndex = new Date(calYear, calMonth, 1).getDay(); // 0=Sun..6=Sat
  const daysInCurrentMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(calYear, calMonth, 0).getDate();

  let html = '';

  // 1. Previous month trailing days
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const prevM = calMonth === 0 ? 11 : calMonth - 1;
    const prevY = calMonth === 0 ? calYear - 1 : calYear;
    const dStr = `${prevY}-${String(prevM + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    html += buildCalendarCellHTML(d, dStr, true, todayStr, tasksByDate[dStr] || []);
  }

  // 2. Current month days
  for (let d = 1; d <= daysInCurrentMonth; d++) {
    const dStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    html += buildCalendarCellHTML(d, dStr, false, todayStr, tasksByDate[dStr] || []);
  }

  // 3. Next month leading days (fill up to 35 or 42 cells)
  const totalCellsSoFar = firstDayIndex + daysInCurrentMonth;
  const nextCellsCount = (totalCellsSoFar <= 35 ? 35 : 42) - totalCellsSoFar;
  for (let d = 1; d <= nextCellsCount; d++) {
    const nextM = calMonth === 11 ? 0 : calMonth + 1;
    const nextY = calMonth === 11 ? calYear + 1 : calYear;
    const dStr = `${nextY}-${String(nextM + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    html += buildCalendarCellHTML(d, dStr, true, todayStr, tasksByDate[dStr] || []);
  }

  grid.innerHTML = html;

  // Bind cell clicks
  grid.querySelectorAll('.calendar-cell').forEach(cell => {
    cell.addEventListener('click', async () => {
      const dStr = cell.dataset.date;
      selectedDateStr = dStr;
      grid.querySelectorAll('.calendar-cell').forEach(c => c.classList.remove('selected'));
      cell.classList.add('selected');
      await renderCalendarDayTasks(allTasks);
    });
  });

  await renderCalendarDayTasks(allTasks);
}

function buildCalendarCellHTML(dayNum, dateStr, isOtherMonth, todayStr, tasks) {
  const isToday = dateStr === todayStr;
  const isSelected = dateStr === selectedDateStr;
  const hasTasks = tasks.length > 0;
  const hasOverdue = hasTasks && dateStr < todayStr && tasks.some(t => t.status === 'open');

  let cellClasses = ['calendar-cell'];
  if (isOtherMonth) cellClasses.push('other-month');
  if (isToday) cellClasses.push('today');
  if (isSelected) cellClasses.push('selected');
  if (hasTasks) cellClasses.push('has-tasks');
  if (hasOverdue) cellClasses.push('has-overdue');

  // Build task dots (up to 3 dots)
  let dotsHtml = '';
  if (hasTasks) {
    const openTasks = tasks.filter(t => t.status === 'open');
    const doneTasks = tasks.filter(t => t.status === 'done');
    const visibleDots = openTasks.slice(0, 3);
    dotsHtml = `
      <div class="calendar-cell__dots">
        ${visibleDots.map(t => `<div class="calendar-dot ${(t.priority || 'medium').toLowerCase()}"></div>`).join('')}
        ${visibleDots.length < 3 && doneTasks.length > 0 ? `<div class="calendar-dot done"></div>` : ''}
      </div>
    `;
  }

  return `
    <div class="${cellClasses.join(' ')}" data-date="${dateStr}">
      <div class="calendar-cell__day">${dayNum}</div>
      ${dotsHtml}
    </div>
  `;
}

async function renderCalendarDayTasks(allTasks = null) {
  if (!allTasks) allTasks = await db.getTasks();

  const titleEl = currentContainer.querySelector('#calendar-day-title');
  const listEl = currentContainer.querySelector('#calendar-day-tasks');
  if (!titleEl || !listEl) return;

  const selDate = new Date(selectedDateStr + 'T00:00:00');
  const formattedDay = selDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });

  const dayTasks = allTasks.filter(t => t.deadline && t.deadline.split('T')[0] === selectedDateStr);

  titleEl.innerHTML = `📅 ${formattedDay} <span class="badge badge--subject" style="margin-left: 6px;">${dayTasks.length} task${dayTasks.length !== 1 ? 's' : ''}</span>`;

  if (dayTasks.length === 0) {
    const mascot = window.getMascotSVG ? window.getMascotSVG('sleeping') : '😴';
    listEl.innerHTML = `
      <div class="empty-state" style="padding: var(--space-md);">
        <div class="mascot--sm">${mascot}</div>
        <div class="empty-state__text" style="font-size: var(--font-size-base); margin-top: 6px;">No tasks due on this date</div>
        <div class="empty-state__sub" style="font-size: var(--font-size-sm);">Schedule is clear! Tap "+ Add for this day" to plan a deadline.</div>
      </div>
    `;
    return;
  }

  renderTaskCardsInto(listEl, dayTasks, true);
}

/* ================= NEW TASK DRAWER ================= */
function setupNewTaskDrawer() {
  const drawer = currentContainer.querySelector('#new-task-drawer');
  const openBtn = currentContainer.querySelector('#new-task-btn');
  const cancelBtn = currentContainer.querySelector('#cancel-new-task-btn');
  const saveBtn = currentContainer.querySelector('#save-new-task-btn');
  const titleInput = currentContainer.querySelector('#new-task-title');
  const naturalInput = currentContainer.querySelector('#new-task-natural');
  const dateInput = currentContainer.querySelector('#new-task-date');
  const previewDiv = currentContainer.querySelector('#new-task-date-preview');
  const subSelect = currentContainer.querySelector('#new-task-subject-select');
  const subCustom = currentContainer.querySelector('#new-task-subject-custom');
  const patternSuggestionDiv = currentContainer.querySelector('#new-task-pattern-suggestion');

  // Quick Chips
  const chipsContainer = currentContainer.querySelector('#new-task-chips');
  const chips = getQuickChips();
  chipsContainer.innerHTML = chips.map(c => `
    <button type="button" class="chip chip--new-date" data-date="${c.dateStr}">
      ${c.label} <span style="font-size: 11px; opacity: 0.8; margin-left: 2px;">(${formatDate(c.date)})</span>
    </button>
  `).join('');

  openBtn.addEventListener('click', () => {
    drawer.classList.remove('hidden');
    drawer.scrollIntoView({ behavior: 'smooth' });
    titleInput.focus();
  });

  cancelBtn.addEventListener('click', () => {
    drawer.classList.add('hidden');
  });

  // Template buttons
  currentContainer.querySelectorAll('.template-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const templateTitle = btn.dataset.title;
      const prio = btn.dataset.prio;
      titleInput.value = templateTitle;
      setDrawerPriority(prio);
      titleInput.focus();
    });
  });

  // Priority toggle
  drawer.querySelectorAll('.priority-toggle__option').forEach(btn => {
    btn.addEventListener('click', () => {
      drawer.querySelectorAll('.priority-toggle__option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Date chip clicks
  chipsContainer.querySelectorAll('.chip--new-date').forEach(chip => {
    chip.addEventListener('click', () => {
      chipsContainer.querySelectorAll('.chip--new-date').forEach(c => c.classList.remove('chip--selected'));
      chip.classList.add('chip--selected');
      dateInput.value = chip.dataset.date;
      naturalInput.value = '';
      previewDiv.classList.add('hidden');
    });
  });

  // Natural language date input
  naturalInput.addEventListener('input', () => {
    const val = naturalInput.value.trim();
    if (val) {
      const parsed = parseDatePhrase(val);
      if (parsed) {
        previewDiv.classList.remove('hidden');
        previewDiv.innerHTML = `<span class="date-parse-preview">⚡ Autofilled: <strong>${formatDate(parsed.date)}</strong></span>`;
        dateInput.value = parsed.dateStr;
        const days = daysUntil(parsed.date);
        if (days <= 1) setDrawerPriority('High');
        else if (days <= 3) setDrawerPriority('Medium');
        else setDrawerPriority('Low');
      } else {
        previewDiv.classList.add('hidden');
      }
    } else {
      previewDiv.classList.add('hidden');
    }
  });

  // Auto-detect subject as user types title
  titleInput.addEventListener('input', async () => {
    const val = titleInput.value.trim();
    if (val) {
      const detected = await deadlineLearner.detectSubjectInText(val);
      if (detected && !subSelect.value && !subCustom.value) {
        subSelect.value = detected;
        checkSubjectSuggestion(detected);
      }
      const nat = parseDatePhrase(val);
      if (nat && !dateInput.value) {
        dateInput.value = nat.dateStr;
        previewDiv.classList.remove('hidden');
        previewDiv.innerHTML = `<span class="date-parse-preview">⚡ Auto-detected date: <strong>${formatDate(nat.date)}</strong></span>`;
      }
    }
  });

  async function checkSubjectSuggestion(subName) {
    if (!subName) {
      patternSuggestionDiv.classList.add('hidden');
      return;
    }
    const suggestion = await deadlineLearner.suggestDeadlineForSubject(subName);
    if (suggestion) {
      dateInput.value = suggestion.dateStr;
      patternSuggestionDiv.classList.remove('hidden');
      patternSuggestionDiv.innerHTML = `
        <div class="chip chip--suggestion" id="apply-new-task-suggestion" style="cursor: pointer; width: 100%; justify-content: center; padding: 6px 12px;">
          <span>⚡ <strong>Autofilled by Rule:</strong> ${formatDate(suggestion.suggestedDate)} (${suggestion.reasoning})</span>
        </div>
      `;
    } else {
      patternSuggestionDiv.classList.add('hidden');
    }
  }

  subSelect.addEventListener('change', () => {
    if (subSelect.value) {
      subCustom.value = '';
      checkSubjectSuggestion(subSelect.value);
    }
  });

  subCustom.addEventListener('input', () => {
    if (subCustom.value.trim()) {
      subSelect.value = '';
      checkSubjectSuggestion(subCustom.value.trim());
    }
  });

  // Save task
  saveBtn.addEventListener('click', async () => {
    const title = titleInput.value.trim();
    if (!title) {
      if (window.showToast) window.showToast('Please enter a task title!', 'error');
      return;
    }

    const subject = subSelect.value || subCustom.value.trim() || null;
    const dateVal = dateInput.value;
    const activePrioBtn = drawer.querySelector('.priority-toggle__option.active');
    const priority = activePrioBtn ? activePrioBtn.dataset.prio : 'Medium';
    const deadline = dateVal ? new Date(dateVal).toISOString() : null;

    await db.addTask({
      title,
      subject,
      priority,
      deadline,
      status: 'open',
      createdAt: new Date().toISOString()
    });

    if (subject && dateVal) {
      await deadlineLearner.logDeadlineDataPoint(subject, dateVal);
    }

    titleInput.value = '';
    dateInput.value = '';
    naturalInput.value = '';
    subSelect.value = '';
    subCustom.value = '';
    previewDiv.classList.add('hidden');
    patternSuggestionDiv.classList.add('hidden');
    drawer.classList.add('hidden');

    if (window.showToast) window.showToast(`Added "${title}" ✅`, 'success');

    await loadSubjects();
    await renderCurrentView();
  });
}

function setDrawerPriority(prio) {
  const drawer = currentContainer.querySelector('#new-task-drawer');
  drawer.querySelectorAll('.priority-toggle__option').forEach(b => {
    b.classList.toggle('active', b.dataset.prio.toLowerCase() === prio.toLowerCase());
  });
}

/* ================= LIST VIEW LOGIC ================= */
function setupFilters() {
  currentContainer.querySelectorAll('.filter-btn:not(select)').forEach(btn => {
    btn.addEventListener('click', () => {
      currentContainer.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      currentContainer.querySelector('#subject-filter').value = '';
      loadAllTasks();
    });
  });

  currentContainer.querySelector('#subject-filter').addEventListener('change', (e) => {
    if (e.target.value) {
      currentContainer.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      currentFilter = `subject:${e.target.value}`;
      loadAllTasks();
    } else {
      currentFilter = 'all';
      currentContainer.querySelector('.filter-btn[data-filter="all"]').classList.add('active');
      loadAllTasks();
    }
  });

  currentContainer.querySelector('#sort-control').addEventListener('change', () => {
    loadAllTasks();
  });
}

async function loadSubjects() {
  const timetable = await db.getTimetable();
  const patterns = await db.getPatterns();
  const allTasks = await db.getTasks();

  const subjects = [
    ...new Set([
      ...timetable.map(b => b.subject),
      ...patterns.map(p => p.subject),
      ...allTasks.map(t => t.subject)
    ])
  ].filter(Boolean);

  const filterSelect = currentContainer.querySelector('#subject-filter');
  if (filterSelect) {
    filterSelect.innerHTML = '<option value="">By Subject...</option>' +
      subjects.map(s => `<option value="${s}">${s}</option>`).join('');
  }

  const newSelect = currentContainer.querySelector('#new-task-subject-select');
  if (newSelect) {
    newSelect.innerHTML = '<option value="">Select a Subject...</option>' +
      subjects.map(s => `<option value="${s}">${s}</option>`).join('');
  }
}

async function loadAllTasks() {
  const allTasks = await db.getTasks();
  const now = new Date();
  const todayStr = getLocalDateStr(now);
  const sortBy = currentContainer.querySelector('#sort-control')?.value || 'deadline';

  let openTasks = allTasks.filter(t => t.status === 'open');
  const doneTasks = allTasks.filter(t => t.status === 'done');
  const dismissedTasks = allTasks.filter(t => t.status === 'dismissed');

  const labelEl = currentContainer.querySelector('#active-filter-label');
  if (currentFilter === 'high') {
    openTasks = openTasks.filter(t => (t.priority || '').toLowerCase() === 'high');
    if (labelEl) labelEl.textContent = 'Showing High Priority tasks';
  } else if (currentFilter === 'soon') {
    openTasks = openTasks.filter(t => t.deadline && daysUntil(new Date(t.deadline)) <= 3 && daysUntil(new Date(t.deadline)) >= 0);
    if (labelEl) labelEl.textContent = 'Showing tasks due within 3 days';
  } else if (currentFilter === 'overdue') {
    openTasks = openTasks.filter(t => t.deadline && t.deadline.split('T')[0] < todayStr);
    if (labelEl) labelEl.textContent = 'Showing overdue tasks';
  } else if (currentFilter.startsWith('subject:')) {
    const sub = currentFilter.split(':')[1];
    openTasks = openTasks.filter(t => t.subject === sub);
    if (labelEl) labelEl.textContent = `Showing tasks for ${sub}`;
  } else {
    if (labelEl) labelEl.textContent = 'Showing all open tasks';
  }

  // Sort
  openTasks.sort((a, b) => {
    if (sortBy === 'priority') {
      const pm = { 'High': 3, 'high': 3, 'Medium': 2, 'medium': 2, 'Low': 1, 'low': 1 };
      return (pm[b.priority] || 0) - (pm[a.priority] || 0);
    }
    if (sortBy === 'created') {
      return new Date(b.createdAt) - new Date(a.createdAt);
    }
    const aOverdue = a.deadline && a.deadline.split('T')[0] < todayStr;
    const bOverdue = b.deadline && b.deadline.split('T')[0] < todayStr;
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;
    if (a.deadline && b.deadline) return new Date(a.deadline) - new Date(b.deadline);
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return 0;
  });

  const openContainer = currentContainer.querySelector('#open-tasks');
  const doneContainer = currentContainer.querySelector('#done-tasks');
  const disContainer = currentContainer.querySelector('#dismissed-tasks');

  if (openContainer) renderTaskCardsInto(openContainer, openTasks, true);
  if (doneContainer) renderTaskCardsInto(doneContainer, doneTasks, false);
  if (disContainer) renderTaskCardsInto(disContainer, dismissedTasks, false);

  const doneCountEl = currentContainer.querySelector('#done-count');
  const disCountEl = currentContainer.querySelector('#dismissed-count');
  if (doneCountEl) doneCountEl.textContent = doneTasks.length;
  if (disCountEl) disCountEl.textContent = dismissedTasks.length;
}

/* ================= SHARED TASK CARDS RENDERER ================= */
function renderTaskCardsInto(container, tasks, isOpenGroup) {
  const now = new Date();
  const todayStr = getLocalDateStr(now);

  if (tasks.length === 0) {
    if (isOpenGroup && currentFilter === 'all') {
      const mascot = window.getMascotSVG ? window.getMascotSVG('happy') : '🐩';
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__mascot">${mascot}</div>
          <div class="empty-state__text">All clear! 🐩</div>
          <div class="empty-state__sub">No open tasks right now. Tap "+ New Task" to create one.</div>
        </div>
      `;
    } else if (isOpenGroup) {
      const mascot = window.getMascotSVG ? window.getMascotSVG('thinking') : '🔍';
      container.innerHTML = `
        <div class="empty-state" style="padding: var(--space-lg);">
          <div class="mascot--sm">${mascot}</div>
          <div class="text-sm text-muted" style="margin-top: 8px;">No tasks match this filter.</div>
        </div>
      `;
    } else {
      container.innerHTML = `<div class="text-sm text-muted text-center" style="padding: var(--space-sm);">None</div>`;
    }
    return;
  }

  container.innerHTML = tasks.map(t => {
    const isOverdue = t.status === 'open' && t.deadline && t.deadline.split('T')[0] < todayStr;
    const isExpanded = expandedTaskId === t.id;
    const priorityClass = t.priority ? `priority-${t.priority.toLowerCase()}` : '';
    const isDone = t.status === 'done';

    let deadlineLabel = '';
    if (!t.deadline) deadlineLabel = 'No deadline';
    else if (isOverdue) deadlineLabel = `⚠️ Overdue (${formatDate(new Date(t.deadline))})`;
    else deadlineLabel = `Due ${formatDate(new Date(t.deadline))}`;

    const chips = getQuickChips();

    return `
      <div class="card card--task ${priorityClass} ${isOverdue ? 'overdue' : ''} ${isDone ? 'done' : ''}"
        data-task-id="${t.id}">
        <div class="task-card-header" data-toggle="${t.id}" style="cursor: pointer;">
          <div style="display: flex; align-items: center; gap: var(--space-md);">
            <button class="task-checkbox ${isDone ? 'checked' : ''}" data-done-id="${t.id}" aria-label="Done">✓</button>
            <div style="flex: 1; min-width: 0;">
              <div class="task-title" style="${isDone ? 'text-decoration: line-through; opacity: 0.6;' : ''}">
                ${isDone ? '🎉 ' : ''}${t.title}
              </div>
              <div class="task-meta">
                ${t.priority ? `<span class="badge badge--${t.priority.toLowerCase()}">${t.priority}</span>` : ''}
                <span class="task-deadline ${isOverdue ? 'overdue' : ''}">${deadlineLabel}</span>
                ${t.subject ? `<span class="badge badge--subject">${t.subject}</span>` : ''}
              </div>
            </div>
            <span style="color: var(--text-muted); font-size: 13px;">${isExpanded ? '▲' : '▼'}</span>
          </div>
        </div>

        <div class="task-detail ${isExpanded ? 'open' : ''}" id="detail-${t.id}">
          <div class="form-group">
            <label class="form-label">Title</label>
            <input class="form-input" id="edit-title-${t.id}" value="${t.title}" />
          </div>

          <div class="form-group">
            <label class="form-label">Deadline</label>
            <div style="display: flex; gap: var(--space-sm); margin-bottom: var(--space-sm);">
              <input type="date" class="form-input" id="edit-date-${t.id}"
                value="${t.deadline ? t.deadline.split('T')[0] : ''}" style="flex: 1;" />
              <input type="text" class="form-input" id="edit-natural-${t.id}"
                placeholder='Type: "in 2 days", "next fri"...' style="flex: 1;" />
            </div>
            <div class="chip-row">
              ${chips.map(c => `<button type="button" class="chip chip-date-pick" data-task="${t.id}" data-date="${c.dateStr}">${c.label} <span style="font-size: 11px; opacity: 0.8; margin-left: 2px;">(${formatDate(c.date)})</span></button>`).join('')}
            </div>
            <div id="date-preview-${t.id}" class="hidden"></div>
          </div>

          <div class="form-group">
            <label class="form-label">Priority</label>
            <div class="priority-toggle" id="priority-toggle-${t.id}">
              <button type="button" class="priority-toggle__option high ${(t.priority || '').toLowerCase() === 'high' ? 'active' : ''}" data-prio="High">🔴 High</button>
              <button type="button" class="priority-toggle__option medium ${(t.priority || '').toLowerCase() === 'medium' ? 'active' : ''}" data-prio="Medium">🟡 Medium</button>
              <button type="button" class="priority-toggle__option low ${(t.priority || '').toLowerCase() === 'low' ? 'active' : ''}" data-prio="Low">🔵 Low</button>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Subject / Venture</label>
            <input class="form-input" id="edit-subject-${t.id}" value="${t.subject || ''}" placeholder="e.g. Physics 101" />
          </div>

          <div style="display: flex; gap: var(--space-sm); flex-wrap: wrap; margin-top: var(--space-md);">
            <button class="btn btn--primary btn--sm save-task-btn" data-id="${t.id}">💾 Save Changes</button>
            ${t.status === 'open' ? `<button class="btn btn--success btn--sm done-task-btn" data-id="${t.id}">✅ Mark Done</button>` : ''}
            ${t.status === 'open' ? `<button class="btn btn--ghost btn--sm dismiss-task-btn" data-id="${t.id}">🚫 Dismiss</button>` : ''}
            ${t.status !== 'open' ? `<button class="btn btn--secondary btn--sm reopen-task-btn" data-id="${t.id}">↩️ Reopen</button>` : ''}
            <button class="btn btn--danger btn--sm delete-task-btn" data-id="${t.id}">🗑️ Delete</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  bindTaskEvents(container);
}

function bindTaskEvents(container) {
  container.querySelectorAll('[data-toggle]').forEach(header => {
    header.addEventListener('click', (e) => {
      if (e.target.closest('.task-checkbox')) return;
      const id = Number(header.dataset.toggle);
      const detail = currentContainer.querySelector(`#detail-${id}`);
      if (detail) {
        const isOpen = detail.classList.contains('open');
        currentContainer.querySelectorAll('.task-detail.open').forEach(d => d.classList.remove('open'));
        if (!isOpen) {
          detail.classList.add('open');
          expandedTaskId = id;
        } else {
          expandedTaskId = null;
        }
        currentContainer.querySelectorAll('[data-toggle]').forEach(h => {
          const arrow = h.querySelector('span:last-child');
          if (arrow) arrow.textContent = Number(h.dataset.toggle) === expandedTaskId ? '▲' : '▼';
        });
      }
    });
  });

  container.querySelectorAll('[data-done-id]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = Number(btn.dataset.doneId);
      const task = await db.getTask(id);
      if (task) {
        task.status = task.status === 'done' ? 'open' : 'done';
        await db.updateTask(task);
        if (task.status === 'done') {
          if (window.showToast) window.showToast('Task completed! 🐩🎉', 'success');
          if (window.showConfetti) window.showConfetti();
        } else {
          if (window.showToast) window.showToast('Task reopened ↩️', 'info');
        }
        await renderCurrentView();
      }
    });
  });

  container.querySelectorAll('.priority-toggle__option').forEach(opt => {
    opt.addEventListener('click', (e) => {
      e.stopPropagation();
      const toggle = opt.closest('.priority-toggle');
      toggle.querySelectorAll('.priority-toggle__option').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
    });
  });

  container.querySelectorAll('.chip-date-pick').forEach(chip => {
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      const taskId = chip.dataset.task;
      const dateInput = currentContainer.querySelector(`#edit-date-${taskId}`);
      if (dateInput) dateInput.value = chip.dataset.date;
      const natInput = currentContainer.querySelector(`#edit-natural-${taskId}`);
      if (natInput) natInput.value = '';
    });
  });

  container.querySelectorAll('[id^="edit-natural-"]').forEach(input => {
    input.addEventListener('input', () => {
      const taskId = input.id.replace('edit-natural-', '');
      const preview = currentContainer.querySelector(`#date-preview-${taskId}`);
      const val = input.value.trim();
      if (val) {
        const parsed = parseDatePhrase(val);
        if (parsed && preview) {
          preview.classList.remove('hidden');
          preview.innerHTML = `<span class="date-parse-preview">⚡ Autofilled: <strong>${formatDate(parsed.date)}</strong></span>`;
          const dateInput = currentContainer.querySelector(`#edit-date-${taskId}`);
          if (dateInput) dateInput.value = parsed.dateStr;
        } else if (preview) {
          preview.classList.add('hidden');
        }
      } else if (preview) {
        preview.classList.add('hidden');
      }
    });
  });

  container.querySelectorAll('.save-task-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = Number(btn.dataset.id);
      const task = await db.getTask(id);
      if (!task) return;

      const prevDeadline = task.deadline;
      const newTitle = currentContainer.querySelector(`#edit-title-${id}`)?.value.trim() || task.title;
      const dateVal = currentContainer.querySelector(`#edit-date-${id}`)?.value;
      const newSubject = currentContainer.querySelector(`#edit-subject-${id}`)?.value.trim() || null;

      const activePrio = currentContainer.querySelector(`#priority-toggle-${id} .priority-toggle__option.active`);
      const newPriority = activePrio ? activePrio.dataset.prio : task.priority;

      task.title = newTitle;
      task.deadline = dateVal ? new Date(dateVal).toISOString() : null;
      task.subject = newSubject;
      task.priority = newPriority;

      await db.updateTask(task);

      if (newSubject && dateVal && dateVal !== (prevDeadline ? prevDeadline.split('T')[0] : '')) {
        await deadlineLearner.logOverride(newSubject, dateVal);
      }

      if (window.showToast) window.showToast('Task updated! 💾', 'success');
      expandedTaskId = null;
      await loadSubjects();
      await renderCurrentView();
    });
  });

  container.querySelectorAll('.done-task-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const task = await db.getTask(Number(btn.dataset.id));
      if (task) {
        task.status = 'done';
        await db.updateTask(task);
        if (window.showToast) window.showToast('Task done! 🎉', 'success');
        if (window.showConfetti) window.showConfetti();
        await renderCurrentView();
      }
    });
  });

  container.querySelectorAll('.dismiss-task-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const task = await db.getTask(Number(btn.dataset.id));
      if (task) {
        task.status = 'dismissed';
        await db.updateTask(task);
        if (window.showToast) window.showToast('Task dismissed 🚫', 'info');
        await renderCurrentView();
      }
    });
  });

  container.querySelectorAll('.reopen-task-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const task = await db.getTask(Number(btn.dataset.id));
      if (task) {
        task.status = 'open';
        await db.updateTask(task);
        if (window.showToast) window.showToast('Task reopened ↩️', 'info');
        await renderCurrentView();
      }
    });
  });

  container.querySelectorAll('.delete-task-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm('Delete this task forever? 🗑️')) {
        await db.deleteTask(Number(btn.dataset.id));
        if (window.showToast) window.showToast('Task deleted', 'warning');
        await renderCurrentView();
      }
    });
  });
}
