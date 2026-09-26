// Hectic — Smart Brain Screen (Patterns, Habits & Workload Radar)
// 100% Organic, Local Statistics, Bottleneck Forecast, Verified Deadline Rules

import db from '../db.js';
import smartBrain from '../utils/smart-brain.js';
import { formatDate } from '../utils/date-parser.js';

let currentContainer = null;

export function render(container) {
  currentContainer = container;
  container.innerHTML = `
    <div style="padding: 0 var(--space-lg) var(--space-lg);">
      <div class="greeting" style="justify-content: center; flex-direction: column; align-items: center; text-align: center; padding: var(--space-md) 0;">
        <div class="mascot--md">${window.getMascotSVG ? window.getMascotSVG('thinking') : '🧠'}</div>
        <div class="greeting__hello" style="font-size: var(--font-size-xl);">Smart Brain 🧠</div>
        <div class="greeting__sub">Your workload forecast, learned habits, and verified deadline rules.</div>
      </div>

      <!-- 7-Day Workload Radar -->
      <div class="card" style="margin-bottom: var(--space-lg); border: 2px solid var(--purple-light);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-sm);">
          <div style="font-weight: 800; font-size: var(--font-size-md); color: var(--purple-deep);">
            📊 7-Day Workload Radar
          </div>
          <span class="badge badge--confirmed" id="radar-status-badge">Balanced</span>
        </div>
        <div id="radar-bars" style="display: flex; gap: 6px; justify-content: space-between; margin-top: 12px; align-items: flex-end; height: 80px; padding-bottom: 20px; position: relative;"></div>
        <div id="radar-advice" class="text-sm text-muted" style="margin-top: 8px; border-top: 1px dashed var(--border-light); padding-top: 6px;"></div>
      </div>

      <!-- Free Study Windows Today -->
      <div class="card" style="margin-bottom: var(--space-lg);">
        <div style="font-weight: 800; font-size: var(--font-size-md); margin-bottom: 6px;">
          ⏱️ Today's Free Study Windows
        </div>
        <div id="brain-free-windows"></div>
      </div>

      <!-- Learned & Proposed Rules -->
      <div id="proposed-section" class="hidden" style="margin-bottom: var(--space-lg);">
        <div class="section-title" style="color: var(--orange-warm); font-size: var(--font-size-base); margin-bottom: var(--space-sm);">
          ✨ Habit Detected (Ready to Save as Rule)
        </div>
        <div id="proposed-list"></div>
      </div>

      <!-- Confirmed Deadline Rules -->
      <div class="section-header">
        <div class="section-title">✅ Confirmed Deadline Rules</div>
        <span class="section-count" id="confirmed-count">0 rules</span>
      </div>
      <div id="confirmed-list"></div>

      <!-- Add Manual Rule Button -->
      <button class="add-block-btn" id="add-pattern-btn" style="margin-top: var(--space-lg);">
        + Add Verified Rule
      </button>
    </div>

    <!-- Modal for Add/Edit Rule -->
    <div id="pattern-modal" class="modal-overlay hidden">
      <div class="modal">
        <div class="modal__handle"></div>
        <div class="modal__title" id="modal-title">Add Verified Rule</div>

        <div class="form-group">
          <label class="form-label">Subject</label>
          <input type="text" class="form-input" id="pat-subject" placeholder="e.g. Physics 101" />
        </div>

        <div class="form-group">
          <label class="form-label">Offset Days</label>
          <input type="number" class="form-input" id="pat-offset" value="6" min="1" max="30" />
        </div>

        <div class="form-group">
          <label class="form-label">Anchor Class Type</label>
          <div class="segmented" id="pat-anchor-seg">
            <button type="button" class="segmented__option active" data-anchor="Lab">🔬 Lab</button>
            <button type="button" class="segmented__option" data-anchor="Lecture">📖 Lecture</button>
            <button type="button" class="segmented__option" data-anchor="Elective">📝 Elective</button>
            <button type="button" class="segmented__option" data-anchor="Any">📌 Any</button>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Description</label>
          <input type="text" class="form-input" id="pat-desc" placeholder='e.g. "Due 6 days after each lab"' />
        </div>

        <input type="hidden" id="pat-edit-id" />

        <div style="display: flex; gap: var(--space-sm); margin-top: var(--space-lg);">
          <button class="btn btn--secondary btn--sm" id="pat-cancel" style="flex: 1;">Cancel</button>
          <button class="btn btn--primary btn--sm" id="pat-save" style="flex: 1;">💾 Save Rule</button>
        </div>
      </div>
    </div>
  `;
}

export async function init() {
  if (!currentContainer) return;
  setupModal();
  await loadRadar();
  await loadFreeWindows();
  await loadPatterns();
}

async function loadRadar() {
  const radar = await smartBrain.getWorkloadRadar();
  const barsEl = currentContainer.querySelector('#radar-bars');
  const adviceEl = currentContainer.querySelector('#radar-advice');
  const statusBadge = currentContainer.querySelector('#radar-status-badge');

  if (radar.hasBottleneck) {
    statusBadge.className = 'badge badge--high';
    statusBadge.textContent = 'Bottleneck';
  } else {
    statusBadge.className = 'badge badge--confirmed';
    statusBadge.textContent = 'Balanced';
  }

  adviceEl.textContent = radar.advice;

  const maxTasks = Math.max(1, ...radar.forecast.map(f => f.taskCount));

  barsEl.innerHTML = radar.forecast.map(f => {
    const heightPercent = f.taskCount === 0 ? 12 : Math.max(20, Math.round((f.taskCount / maxTasks) * 100));
    const barColor = f.isHeavy ? 'var(--coral)' : f.taskCount > 0 ? 'var(--purple-deep)' : 'var(--border-medium)';

    return `
      <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; position: relative;">
        <span style="font-size: 11px; font-weight: 700; color: ${f.isHeavy ? 'var(--coral)' : 'var(--text-secondary)'}; margin-bottom: 2px;">
          ${f.taskCount > 0 ? f.taskCount : ''}
        </span>
        <div style="width: 100%; max-width: 28px; height: ${heightPercent}%; background: ${barColor}; border-radius: 6px 6px 0 0; transition: height 0.3s ease;"></div>
        <span style="font-size: 10px; font-weight: 700; color: var(--text-muted); position: absolute; bottom: 0;">
          ${f.dayName.slice(0, 3)}
        </span>
      </div>
    `;
  }).join('');
}

async function loadFreeWindows() {
  const gapsEl = currentContainer.querySelector('#brain-free-windows');
  const gaps = await smartBrain.getTodayFreeWindows();

  if (gaps.length === 0) {
    gapsEl.innerHTML = '<div class="text-sm text-muted">No major free gaps between classes today.</div>';
    return;
  }

  gapsEl.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 6px;">
      ${gaps.map(g => `
        <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-primary); padding: 8px 12px; border-radius: var(--radius-md);">
          <div>
            <div style="font-weight: 700; font-size: 13px;">${g.startTime} – ${g.endTime}</div>
            <div class="text-sm text-muted" style="font-size: 11px;">${g.label}</div>
          </div>
          <span class="badge badge--subject">${g.durationText} open</span>
        </div>
      `).join('')}
    </div>
  `;
}

function setupModal() {
  const modal = currentContainer.querySelector('#pattern-modal');
  const addBtn = currentContainer.querySelector('#add-pattern-btn');

  addBtn.addEventListener('click', () => {
    currentContainer.querySelector('#modal-title').textContent = 'Add Verified Rule';
    currentContainer.querySelector('#pat-edit-id').value = '';
    currentContainer.querySelector('#pat-subject').value = '';
    currentContainer.querySelector('#pat-desc').value = '';
    currentContainer.querySelector('#pat-offset').value = '6';

    currentContainer.querySelectorAll('#pat-anchor-seg .segmented__option').forEach(o => o.classList.remove('active'));
    currentContainer.querySelector('#pat-anchor-seg .segmented__option[data-anchor="Lab"]').classList.add('active');

    modal.classList.remove('hidden');
  });

  currentContainer.querySelectorAll('#pat-anchor-seg .segmented__option').forEach(opt => {
    opt.addEventListener('click', () => {
      currentContainer.querySelectorAll('#pat-anchor-seg .segmented__option').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      updateAutoDescription();
    });
  });

  currentContainer.querySelector('#pat-offset').addEventListener('input', () => {
    updateAutoDescription();
  });

  function updateAutoDescription() {
    const offset = currentContainer.querySelector('#pat-offset').value || '6';
    const activeAnchor = currentContainer.querySelector('#pat-anchor-seg .segmented__option.active');
    const anchor = activeAnchor ? activeAnchor.dataset.anchor : 'Lab';
    currentContainer.querySelector('#pat-desc').placeholder = `Due ${offset} days after every ${anchor.toLowerCase()}`;
  }

  currentContainer.querySelector('#pat-cancel').addEventListener('click', () => {
    modal.classList.add('hidden');
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.add('hidden');
  });

  currentContainer.querySelector('#pat-save').addEventListener('click', async () => {
    const editId = currentContainer.querySelector('#pat-edit-id').value;
    const subject = currentContainer.querySelector('#pat-subject').value.trim();
    const offsetDays = parseInt(currentContainer.querySelector('#pat-offset').value, 10) || 6;
    const activeAnchor = currentContainer.querySelector('#pat-anchor-seg .segmented__option.active');
    const anchorType = activeAnchor ? activeAnchor.dataset.anchor : 'Lab';

    if (!subject) {
      if (window.showToast) window.showToast('Please enter a subject name!', 'error');
      return;
    }

    let desc = currentContainer.querySelector('#pat-desc').value.trim();
    if (!desc) {
      desc = `Due ${offsetDays} days after every ${anchorType.toLowerCase()}`;
    }

    const patternData = {
      subject,
      description: desc,
      ruleText: desc,
      offsetDays,
      anchorType,
      status: 'confirmed',
      dataPoints: 1,
      createdAt: new Date().toISOString()
    };

    if (editId) {
      patternData.id = Number(editId);
      await db.updatePattern(patternData);
      if (window.showToast) window.showToast('Rule updated! 📅', 'success');
    } else {
      await db.addPattern(patternData);
      if (window.showToast) window.showToast('Rule confirmed! 📅', 'success');
    }

    modal.classList.add('hidden');
    await loadPatterns();
  });
}

async function loadPatterns() {
  const confirmedListEl = currentContainer.querySelector('#confirmed-list');
  const proposedListEl = currentContainer.querySelector('#proposed-list');
  const proposedSection = currentContainer.querySelector('#proposed-section');
  const confirmedCountEl = currentContainer.querySelector('#confirmed-count');

  const allPatterns = await db.getPatterns();

  const confirmed = allPatterns.filter(p => p.status === 'confirmed');
  const learning = allPatterns.filter(p => p.status === 'learning');

  confirmedCountEl.textContent = `${confirmed.length} rule${confirmed.length !== 1 ? 's' : ''}`;

  if (learning.length > 0) {
    proposedSection.classList.remove('hidden');
    proposedListEl.innerHTML = learning.map(p => `
      <div class="card card--pattern-new" data-id="${p.id}" style="margin-bottom: var(--space-md); border-width: 2px;">
        <div>
          <div style="font-weight: 800; font-size: var(--font-size-md);">${p.subject}</div>
          <div class="text-sm" style="color: var(--text-primary); margin-top: 2px;">
            "${p.description || `Due ${p.offsetDays} days after ${p.anchorType}`}"
          </div>
          <div style="margin-top: 6px; display: flex; gap: 6px;">
            <span class="badge badge--learning">📊 Observed in ${p.dataPoints || 2} entries</span>
            <span class="badge badge--subject">+${p.offsetDays}d offset</span>
          </div>
        </div>

        <div style="display: flex; gap: var(--space-sm); margin-top: var(--space-md);">
          <button class="btn btn--success btn--sm accept-btn" data-id="${p.id}" style="flex: 1;">
            ✅ Save as Rule
          </button>
          <button class="btn btn--secondary btn--sm edit-btn" data-id="${p.id}">
            ✏️ Adjust
          </button>
          <button class="btn btn--ghost btn--sm dismiss-btn" data-id="${p.id}">
            Dismiss
          </button>
        </div>
      </div>
    `).join('');
  } else {
    proposedSection.classList.add('hidden');
    proposedListEl.innerHTML = '';
  }

  if (confirmed.length === 0) {
    const mascot = window.getMascotSVG ? window.getMascotSVG('thinking') : '🔍';
    confirmedListEl.innerHTML = `
      <div class="empty-state" style="padding: var(--space-lg);">
        <div class="empty-state__mascot">${mascot}</div>
        <div class="empty-state__text">No rules set yet! 🔍</div>
        <div class="empty-state__sub">Add tasks tagged to subjects, and Hectic will automatically detect your submission rhythms!</div>
      </div>
    `;
  } else {
    const cards = [];
    for (const p of confirmed) {
      let previewHtml = '';
      try {
        const resolved = await smartBrain.resolveSubjectDeadline(p.subject);
        if (resolved) {
          previewHtml = `<div class="text-sm text-muted" style="margin-top: 6px; font-size: 12px;">
            Next calculated deadline: <strong>${formatDate(resolved.date)}</strong> (${resolved.reasoning})
          </div>`;
        }
      } catch (e) {}

      cards.push(`
        <div class="card" data-id="${p.id}" style="margin-bottom: var(--space-md);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div style="flex: 1;">
              <div style="font-weight: 800; font-size: var(--font-size-md);">${p.subject}</div>
              <div class="text-sm" style="color: var(--text-secondary); margin-top: 2px;">
                "${p.description || `Due ${p.offsetDays} days after ${p.anchorType}`}"
              </div>
              <div style="margin-top: 6px; display: flex; gap: 6px; flex-wrap: wrap;">
                <span class="badge badge--confirmed">Verified Rule ✅</span>
                <span class="badge badge--subject">${p.offsetDays}d after ${p.anchorType}</span>
              </div>
              ${previewHtml}
            </div>
          </div>

          <div style="display: flex; gap: var(--space-sm); margin-top: var(--space-md);">
            <button class="btn btn--secondary btn--sm edit-btn" data-id="${p.id}">✏️ Edit</button>
            <button class="btn btn--danger btn--sm delete-btn" data-id="${p.id}">🗑️ Delete</button>
          </div>
        </div>
      `);
    }
    confirmedListEl.innerHTML = cards.join('');
  }

  bindPatternEvents();
}

function bindPatternEvents() {
  currentContainer.querySelectorAll('.accept-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.dataset.id);
      const pattern = await db.getPattern(id);
      if (pattern) {
        pattern.status = 'confirmed';
        await db.updatePattern(pattern);
        if (window.showToast) window.showToast(`Saved rule for ${pattern.subject}! ✅`, 'success');
        if (window.showConfetti) window.showConfetti();
        await loadPatterns();
      }
    });
  });

  currentContainer.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.dataset.id);
      const pattern = await db.getPattern(id);
      if (!pattern) return;

      const modal = currentContainer.querySelector('#pattern-modal');
      currentContainer.querySelector('#modal-title').textContent = 'Edit Rule';
      currentContainer.querySelector('#pat-edit-id').value = pattern.id;
      currentContainer.querySelector('#pat-subject').value = pattern.subject || '';
      currentContainer.querySelector('#pat-desc').value = pattern.description || '';
      currentContainer.querySelector('#pat-offset').value = pattern.offsetDays || 6;

      currentContainer.querySelectorAll('#pat-anchor-seg .segmented__option').forEach(o => {
        o.classList.toggle('active', o.dataset.anchor === pattern.anchorType);
      });

      modal.classList.remove('hidden');
    });
  });

  currentContainer.querySelectorAll('.dismiss-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.dataset.id);
      await db.deletePattern(id);
      if (window.showToast) window.showToast('Dismissed', 'info');
      await loadPatterns();
    });
  });

  currentContainer.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('Delete this deadline rule?')) {
        await db.deletePattern(Number(btn.dataset.id));
        if (window.showToast) window.showToast('Rule removed', 'warning');
        await loadPatterns();
      }
    });
  });
}
