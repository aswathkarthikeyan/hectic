// Hectic — Today Screen (Cockpit)
// Predictive Quick-Add, Direct Date & Day Selectors, Timetable Timeline, Due Tasks, Quick Snooze

import db from '../db.js';
import smartBrain from '../utils/smart-brain.js';
import { getQuickChips, isToday, isTomorrow, formatDate, daysUntil, getLocalDateStr } from '../utils/date-parser.js';
import router from '../router.js';

let currentContainer = null;
let currentPrediction = null;

export function render(container) {
  currentContainer = container;
  container.innerHTML = `
    <div style="padding: 0 var(--space-lg) var(--space-lg);">
      <!-- Greeting Header with Mascot -->
      <div id="today-greeting" class="greeting"></div>

      <!-- Predictive Quick Add Bar -->
      <div class="quick-add">
        <div class="quick-add__input-row">
          <input type="text" class="quick-add__input" id="quick-add-input"
            placeholder="Type task or subject... e.g. Physics Lab 3" autocomplete="off" />
          <button class="quick-add__btn" id="quick-add-btn" disabled title="Add Task">+</button>
        </div>

        <!-- Real-Time Smart Brain Prediction Card -->
        <div id="prediction-card-area" class="hidden" style="margin-top: 10px;"></div>

        <!-- Date & Day Options for Adding Task (Visible under enter list) -->
        <div style="margin-top: var(--space-sm);">
          <div class="text-sm text-muted" style="font-size: 11px; font-weight: 700; margin-bottom: 4px; color: var(--purple-deep);">
            🗓️ Deadline Options (Tap to set & save):
          </div>
          <div class="chip-row" id="quick-add-chips"></div>
        </div>
      </div>

      <!-- Workload Radar Banner -->
      <div id="workload-radar-area"></div>

      <!-- Stats Row -->
      <div class="stats-row" id="today-stats"></div>

      <!-- Tasks Due & Assignments (Brought Up) -->
      <div class="section-header" style="margin-top: var(--space-md);">
        <div class="section-title">📋 Due & Assignments</div>
        <span class="section-count" id="task-count">0 tasks</span>
      </div>
      <div id="today-tasks"></div>

      <!-- Today's Schedule Timeline (Moved Down) -->
      <div class="section-header" style="margin-top: var(--space-lg);">
        <div class="section-title">📚 Today's Classes</div>
        <button class="btn btn--ghost btn--sm" id="view-timetable-btn">Edit Classes →</button>
      </div>
      <div id="today-timetable"></div>
    </div>
  `;
}

export async function init() {
  if (!currentContainer) return;
  await renderGreeting();
  await renderWorkloadRadar();
  await renderStats();
  await renderTasks();
  await renderTimetable();
  setupQuickAdd();

  currentContainer.querySelector('#view-timetable-btn')?.addEventListener('click', () => {
    router.navigate('#/timetable');
  });
}

async function renderGreeting() {
  const el = currentContainer.querySelector('#today-greeting');
  const now = new Date();
  const hour = now.getHours();
  let greeting, sub;

  if (hour < 6) { greeting = 'Up late? 🌙'; sub = "Let's check what's on your agenda."; }
  else if (hour < 12) { greeting = 'Good morning! ☀️'; sub = "Here is your plan for today."; }
  else if (hour < 17) { greeting = 'Good afternoon! 🌤️'; sub = "How is your progress today?"; }
  else if (hour < 21) { greeting = 'Good evening! 🌆'; sub = 'Wind-down time. Any tasks left?'; }
  else { greeting = 'Night owl mode 🦉'; sub = 'Still grinding? You got this!'; }

  const todayFormatted = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const mascot = window.getMascotSVG ? window.getMascotSVG('waving') : '🐩';

  el.innerHTML = `
    <div class="greeting__text">
      <div class="greeting__hello">${greeting}</div>
      <div class="greeting__sub">📅 <strong>${todayFormatted}</strong> • ${sub}</div>
    </div>
    <div class="greeting__mascot">${mascot}</div>
  `;
}

async function renderWorkloadRadar() {
  const area = currentContainer.querySelector('#workload-radar-area');
  const radar = await smartBrain.getWorkloadRadar();

  if (radar.hasBottleneck && radar.bottleneckDates.length > 0) {
    const bottleneck = radar.bottleneckDates[0];
    const mascot = window.getMascotSVG ? window.getMascotSVG('worried') : '⚠️';
    area.innerHTML = `
      <div class="card" style="background: var(--yellow-pale); border-color: var(--yellow-bright); display: flex; align-items: center; gap: var(--space-md); margin-bottom: var(--space-md);">
        <div class="mascot--sm">${mascot}</div>
        <div style="flex: 1;">
          <div style="font-weight: 800; color: var(--text-primary);">Heavy Workload on ${bottleneck.dayName} 📚</div>
          <div class="text-sm text-muted">
            You have <strong>${bottleneck.taskCount} tasks</strong> due on ${bottleneck.dayName}. Consider tackling some today!
          </div>
        </div>
      </div>
    `;
  } else {
    area.innerHTML = '';
  }
}

async function renderStats() {
  const el = currentContainer.querySelector('#today-stats');
  const tasks = await db.getTasks();
  const openTasks = tasks.filter(t => t.status === 'open');
  const now = new Date();
  const todayStr = getLocalDateStr(now);

  let dueToday = 0, dueTomorrow = 0, overdue = 0;

  openTasks.forEach(t => {
    if (!t.deadline) return;
    const dStr = t.deadline.split('T')[0];
    if (dStr === todayStr) dueToday++;
    else if (isTomorrow(new Date(t.deadline))) dueTomorrow++;
    else if (dStr < todayStr) overdue++;
  });

  el.innerHTML = `
    <div class="stat-card">
      <div class="stat-number">${dueToday}</div>
      <div class="stat-label">Due Today</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">${dueTomorrow}</div>
      <div class="stat-label">Tomorrow</div>
    </div>
    <div class="stat-card ${overdue > 0 ? 'overdue' : ''}">
      <div class="stat-number">${overdue}</div>
      <div class="stat-label">Overdue</div>
    </div>
  `;
}

async function renderTimetable() {
  const el = currentContainer.querySelector('#today-timetable');
  const allBlocks = await db.getTimetable();
  const todayDay = new Date().getDay();
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5);

  const dayBlocks = allBlocks
    .filter(b => b.dayOfWeek === todayDay)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  if (dayBlocks.length === 0) {
    const mascot = window.getMascotSVG ? window.getMascotSVG('happy') : '🎉';
    el.innerHTML = `
      <div class="empty-state" style="padding: var(--space-lg);">
        <div class="empty-state__mascot">${mascot}</div>
        <div class="empty-state__text">No classes today! 🎉</div>
        <div class="empty-state__sub">Schedule is totally open. Relax or knock out some tasks!</div>
      </div>
    `;
    return;
  }

  el.innerHTML = `<div class="timeline">
    ${dayBlocks.map(b => {
      const isPast = b.endTime < currentTime;
      const isCurrent = b.startTime <= currentTime && b.endTime > currentTime;
      const typeClass = b.type ? `card--${b.type.toLowerCase()}` : '';
      return `
        <div class="timeline-item ${isPast ? 'past' : ''} ${isCurrent ? 'current' : ''}">
          <div class="timeline-time">${b.startTime} — ${b.endTime}</div>
          <div class="card card--timetable ${typeClass}" style="${isPast ? 'opacity: 0.55;' : ''}">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div class="task-title" style="margin-bottom: 0;">${b.subject || 'Unnamed Class'}</div>
              <span class="badge badge--subject">${b.type || 'Class'}</span>
            </div>
            ${isCurrent ? '<div class="badge badge--confirmed" style="margin-top: 6px;">🟢 In Progress Now</div>' : ''}
          </div>
        </div>
      `;
    }).join('')}
  </div>`;
}

async function renderTasks() {
  const el = currentContainer.querySelector('#today-tasks');
  const countEl = currentContainer.querySelector('#task-count');
  const allTasks = await db.getTasks();
  const now = new Date();
  const todayStr = getLocalDateStr(now);

  let relevantTasks = allTasks.filter(t => {
    if (t.status !== 'open') return false;
    if (!t.deadline) return false;
    const dStr = t.deadline.split('T')[0];
    return dStr <= todayStr || isTomorrow(new Date(t.deadline));
  }).sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

  const noDeadlineTasks = allTasks
    .filter(t => t.status === 'open' && !t.deadline)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 3);

  const displayTasks = [...relevantTasks, ...noDeadlineTasks];
  countEl.textContent = `${displayTasks.length} task${displayTasks.length !== 1 ? 's' : ''}`;

  if (displayTasks.length === 0) {
    const mascot = window.getMascotSVG ? window.getMascotSVG('sleeping') : '😴';
    el.innerHTML = `
      <div class="empty-state" style="padding: var(--space-xl);">
        <div class="empty-state__mascot">${mascot}</div>
        <div class="empty-state__text">Nothing due right now! 😴</div>
        <div class="empty-state__sub">All caught up! Quick-add tasks anytime using the bar above.</div>
      </div>
    `;
    return;
  }

  el.innerHTML = displayTasks.map(t => {
    const isOverdue = t.deadline && t.deadline.split('T')[0] < todayStr;
    const isDueToday = t.deadline && t.deadline.split('T')[0] === todayStr;
    const priorityClass = t.priority ? `priority-${t.priority.toLowerCase()}` : '';

    let deadlineLabel = '';
    if (!t.deadline) deadlineLabel = 'No deadline';
    else if (isOverdue) deadlineLabel = `⚠️ Overdue by ${Math.abs(daysUntil(new Date(t.deadline)))}d`;
    else if (isDueToday) deadlineLabel = '🚨 Due today';
    else deadlineLabel = `Due ${formatDate(new Date(t.deadline))}`;

    return `
      <div class="card card--task ${priorityClass} ${isOverdue ? 'overdue' : ''}"
        data-task-id="${t.id}" style="display: flex; align-items: center; gap: var(--space-md);">
        <button class="task-checkbox" data-id="${t.id}" aria-label="Done">✓</button>
        <div style="flex: 1; min-width: 0;" class="task-info-clickable" data-id="${t.id}">
          <div class="task-title">${t.title}</div>
          <div class="task-meta">
            ${t.priority ? `<span class="badge badge--${t.priority.toLowerCase()}">${t.priority}</span>` : ''}
            <span class="task-deadline ${isOverdue ? 'overdue' : ''}">${deadlineLabel}</span>
            ${t.subject ? `<span class="badge badge--subject">${t.subject}</span>` : ''}
          </div>
        </div>
        <!-- 1-Tap Snooze Button -->
        <button class="btn btn--ghost btn--sm snooze-btn" data-id="${t.id}" title="Snooze to tomorrow" style="font-size: 16px; padding: 4px 8px;">
          💤
        </button>
      </div>
    `;
  }).join('');

  // Checkbox handlers
  el.querySelectorAll('.task-checkbox').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = Number(btn.dataset.id);
      const card = btn.closest('.card--task');

      btn.classList.add('checked');
      card.style.transition = 'all 0.4s var(--ease-bounce)';
      card.style.opacity = '0.5';
      card.style.transform = 'translateX(50px)';

      if (window.showConfetti) window.showConfetti();
      if (window.showToast) window.showToast('Task done! 🐩✨', 'success');

      setTimeout(async () => {
        const task = await db.getTask(id);
        if (task) {
          task.status = 'done';
          await db.updateTask(task);
        }
        await renderTasks();
        await renderStats();
        await renderWorkloadRadar();
      }, 500);
    });
  });

  // Snooze to tomorrow
  el.querySelectorAll('.snooze-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = Number(btn.dataset.id);
      const task = await db.getTask(id);
      if (task) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        task.deadline = tomorrow.toISOString();
        await db.updateTask(task);
        if (window.showToast) window.showToast('Snoozed to tomorrow! 💤', 'info');
        await renderTasks();
        await renderStats();
      }
    });
  });

  el.querySelectorAll('.task-info-clickable').forEach(div => {
    div.addEventListener('click', () => {
      router.navigate('#/tasks');
    });
  });
}

function setupQuickAdd() {
  const input = currentContainer.querySelector('#quick-add-input');
  const btn = currentContainer.querySelector('#quick-add-btn');
  const chipsRow = currentContainer.querySelector('#quick-add-chips');
  const predictionArea = currentContainer.querySelector('#prediction-card-area');

  let activeSelectedDate = null;

  // Render chips immediately so day & date options are always available under the enter list
  renderQuickChips();

  input.addEventListener('input', async () => {
    const val = input.value.trim();
    const hasText = val.length > 0;
    btn.disabled = !hasText;

    if (hasText) {
      // Run Smart Brain Predictor
      currentPrediction = await smartBrain.predictFromText(val);

      if (currentPrediction && (currentPrediction.subject || currentPrediction.formattedDate)) {
        predictionArea.classList.remove('hidden');
        predictionArea.innerHTML = `
          <div class="card" style="background: linear-gradient(135deg, var(--purple-pale), #F8F5FF); border: 1.5px solid var(--purple-light); padding: 10px 14px; margin-bottom: 0;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-weight: 800; font-size: 13px; color: var(--purple-deep);">
                🧠 Smart Prediction
              </span>
              ${currentPrediction.priority ? `<span class="badge badge--${currentPrediction.priority.toLowerCase()}">${currentPrediction.priority}</span>` : ''}
            </div>

            <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; align-items: center;">
              ${currentPrediction.subject ? `<span class="badge badge--subject">🏷️ ${currentPrediction.subject}</span>` : ''}
              ${currentPrediction.formattedDate ? `<span class="badge badge--confirmed">📅 ${currentPrediction.formattedDate}</span>` : ''}
              ${currentPrediction.reasoning ? `<span class="text-sm text-muted" style="font-size: 11px;">(${currentPrediction.reasoning})</span>` : ''}
            </div>
          </div>
        `;
      } else {
        predictionArea.classList.add('hidden');
      }
    } else {
      predictionArea.classList.add('hidden');
      currentPrediction = null;
    }
  });

  btn.addEventListener('click', () => addQuickTask());
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addQuickTask();
  });

  async function addQuickTask(explicitDate = null) {
    const rawTitle = input.value.trim();
    if (!rawTitle) {
      if (window.showToast) window.showToast('Please type a task title first! ✍️', 'info');
      input.focus();
      return;
    }

    let finalDeadline = explicitDate || activeSelectedDate;
    let subject = null;
    let priority = 'Medium';

    if (currentPrediction) {
      subject = currentPrediction.subject || null;
      if (!finalDeadline && currentPrediction.dateStr) {
        finalDeadline = currentPrediction.dateStr;
      }
      priority = currentPrediction.priority || 'Medium';
    }

    await db.addTask({
      title: rawTitle,
      subject,
      priority,
      deadline: finalDeadline ? new Date(finalDeadline).toISOString() : null,
      status: 'open',
      createdAt: new Date().toISOString()
    });

    input.value = '';
    btn.disabled = true;
    activeSelectedDate = null;
    currentPrediction = null;
    predictionArea.classList.add('hidden');
    renderQuickChips();

    if (window.showToast) window.showToast(`Task created! ✅`, 'success');

    await renderTasks();
    await renderStats();
    await renderWorkloadRadar();
  }

  function renderQuickChips() {
    const chips = getQuickChips();
    const todayLocal = getLocalDateStr(new Date());

    const isCustomDate = activeSelectedDate && !chips.some(c => c.dateStr === activeSelectedDate);

    chipsRow.innerHTML = `
      ${chips.map(c => `
        <button type="button" class="chip ${activeSelectedDate === c.dateStr ? 'chip--selected' : ''}" data-date="${c.dateStr}">
          ${c.label} <span style="font-size: 11px; opacity: 0.8; margin-left: 2px;">(${formatDate(c.date)})</span>
        </button>
      `).join('')}

      <!-- Direct Calendar Date Picker Option -->
      <label class="chip chip--date-picker ${isCustomDate ? 'chip--selected' : ''}" id="quick-date-picker-label" title="Pick specific calendar date">
        <span>📅 ${isCustomDate ? formatDate(activeSelectedDate) : 'Pick Date...'}</span>
        <input type="date" id="quick-add-date-input" value="${activeSelectedDate || todayLocal}" min="${todayLocal}" />
      </label>

      <button type="button" class="chip" id="quick-add-more-btn" style="border-color: var(--purple-light);">
        More Details →
      </button>
    `;

    // Click handler for day chips
    chipsRow.querySelectorAll('.chip[data-date]').forEach(chip => {
      chip.addEventListener('click', () => {
        const clickedDate = chip.dataset.date;
        activeSelectedDate = clickedDate;

        if (input.value.trim()) {
          addQuickTask(activeSelectedDate);
        } else {
          renderQuickChips();
          input.focus();
        }
      });
    });

    // Change handler for custom date picker
    const dateInput = chipsRow.querySelector('#quick-add-date-input');
    if (dateInput) {
      dateInput.addEventListener('change', (e) => {
        const val = e.target.value;
        if (!val) return;
        activeSelectedDate = val;

        if (input.value.trim()) {
          addQuickTask(activeSelectedDate);
        } else {
          renderQuickChips();
          input.focus();
        }
      });
    }

    chipsRow.querySelector('#quick-add-more-btn')?.addEventListener('click', () => {
      router.navigate('#/tasks');
    });
  }
}
