// Hectic — Main App Controller
// Bootstraps DB, router, screens, poodle mascot system, notifications, and settings
// 100% Local, Fast & Organically Smart

import db from './db.js';
import router from './router.js';

// Screen modules
import * as todayScreen from './screens/today.js';
import * as tasksScreen from './screens/tasks.js';
import * as timetableScreen from './screens/timetable.js';
import * as brainScreen from './screens/patterns.js';

// ─── Mascot SVG System ──────────────────────────
function createMascotSVG(mood = 'happy') {
  const moods = {
    happy: { eyes: '◕', mouth: 'ᴗ', ears: 'up', tail: 'wag', tongue: true, blush: true },
    waving: { eyes: '◕', mouth: 'ᴗ', ears: 'up', tail: 'wag', tongue: false, blush: true, wave: true },
    worried: { eyes: '◉', mouth: '~', ears: 'down', tail: 'tuck', tongue: false, blush: false, sweat: true },
    thinking: { eyes: '◑', mouth: '·', ears: 'tilt', tail: 'still', tongue: false, blush: false, glasses: true },
    sleeping: { eyes: '–', mouth: '○', ears: 'down', tail: 'still', tongue: false, blush: false, zzz: true },
    celebrating: { eyes: '★', mouth: 'D', ears: 'up', tail: 'wag', tongue: true, blush: true, sparkles: true },
  };

  const m = moods[mood] || moods.happy;

  const bodyColor = '#FDF6ED';
  const bodyDark = '#EFE0D0';
  const noseColor = '#2D3436';
  const cheekColor = '#FFB8B8';
  const tongueColor = '#FF6B6B';
  const accentColor = '#6C5CE7';

  let svg = `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 3px 6px rgba(108,92,231,0.12));">`;

  // Tail
  if (m.tail === 'wag') {
    svg += `<path d="M 95 75 Q 115 55 105 40" stroke="${bodyColor}" stroke-width="6" fill="none" stroke-linecap="round">
      <animateTransform attributeName="transform" type="rotate" values="-12 95 75;12 95 75;-12 95 75" dur="0.5s" repeatCount="indefinite"/>
    </path>`;
  } else if (m.tail === 'tuck') {
    svg += `<path d="M 90 80 Q 95 90 85 95" stroke="${bodyColor}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  } else {
    svg += `<path d="M 95 72 Q 110 60 108 48" stroke="${bodyColor}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  }

  // Body
  svg += `<ellipse cx="60" cy="82" rx="30" ry="22" fill="${bodyColor}" stroke="${bodyDark}" stroke-width="1.5"/>`;
  svg += `<circle cx="48" cy="72" r="10" fill="${bodyDark}" opacity="0.4"/>`;
  svg += `<circle cx="72" cy="72" r="10" fill="${bodyDark}" opacity="0.4"/>`;
  svg += `<circle cx="60" cy="68" r="12" fill="${bodyColor}"/>`;

  // Legs & Paws
  svg += `<rect x="42" y="96" width="8" height="14" rx="4" fill="${bodyColor}" stroke="${bodyDark}" stroke-width="1"/>`;
  svg += `<rect x="70" y="96" width="8" height="14" rx="4" fill="${bodyColor}" stroke="${bodyDark}" stroke-width="1"/>`;
  svg += `<ellipse cx="46" cy="111" rx="6" ry="3" fill="${bodyDark}"/>`;
  svg += `<ellipse cx="74" cy="111" rx="6" ry="3" fill="${bodyDark}"/>`;

  // Waving Paw
  if (m.wave) {
    svg += `<g>
      <rect x="28" y="68" width="7" height="16" rx="3.5" fill="${bodyColor}" stroke="${bodyDark}" stroke-width="1" transform="rotate(-30, 31, 76)">
        <animateTransform attributeName="transform" type="rotate" values="-35 31 76;-10 31 76;-35 31 76" dur="0.75s" repeatCount="indefinite"/>
      </rect>
      <ellipse cx="24" cy="64" rx="5" ry="3" fill="${bodyDark}">
        <animateTransform attributeName="transform" type="rotate" values="-35 31 76;-10 31 76;-35 31 76" dur="0.75s" repeatCount="indefinite"/>
      </ellipse>
    </g>`;
  }

  // Head
  svg += `<circle cx="60" cy="42" r="24" fill="${bodyColor}" stroke="${bodyDark}" stroke-width="1.5"/>`;
  svg += `<circle cx="52" cy="22" r="9" fill="${bodyColor}"/>`;
  svg += `<circle cx="68" cy="22" r="9" fill="${bodyColor}"/>`;
  svg += `<circle cx="60" cy="18" r="11" fill="${bodyColor}"/>`;
  svg += `<circle cx="55" cy="16" r="7" fill="${bodyDark}" opacity="0.35"/>`;
  svg += `<circle cx="65" cy="16" r="7" fill="${bodyDark}" opacity="0.35"/>`;

  // Ears
  if (m.ears === 'up') {
    svg += `<ellipse cx="38" cy="28" rx="6" ry="14" fill="${bodyDark}" transform="rotate(-15, 38, 28)"/>`;
    svg += `<ellipse cx="82" cy="28" rx="6" ry="14" fill="${bodyDark}" transform="rotate(15, 82, 28)"/>`;
  } else if (m.ears === 'down') {
    svg += `<ellipse cx="36" cy="42" rx="5" ry="13" fill="${bodyDark}" transform="rotate(-40, 36, 42)"/>`;
    svg += `<ellipse cx="84" cy="42" rx="5" ry="13" fill="${bodyDark}" transform="rotate(40, 84, 42)"/>`;
  } else {
    svg += `<ellipse cx="38" cy="30" rx="6" ry="13" fill="${bodyDark}" transform="rotate(-25, 38, 30)"/>`;
    svg += `<ellipse cx="82" cy="32" rx="6" ry="13" fill="${bodyDark}" transform="rotate(8, 82, 32)"/>`;
  }

  // Eyes
  const leftEyeX = 50, rightEyeX = 70, eyeY = 40;
  if (m.eyes === '–') {
    svg += `<line x1="${leftEyeX - 5}" y1="${eyeY}" x2="${leftEyeX + 5}" y2="${eyeY}" stroke="${noseColor}" stroke-width="2.5" stroke-linecap="round"/>`;
    svg += `<line x1="${rightEyeX - 5}" y1="${eyeY}" x2="${rightEyeX + 5}" y2="${eyeY}" stroke="${noseColor}" stroke-width="2.5" stroke-linecap="round"/>`;
  } else if (m.eyes === '★') {
    svg += `<text x="${leftEyeX}" y="${eyeY + 4}" text-anchor="middle" font-size="13" font-weight="bold" fill="${accentColor}">★</text>`;
    svg += `<text x="${rightEyeX}" y="${eyeY + 4}" text-anchor="middle" font-size="13" font-weight="bold" fill="${accentColor}">★</text>`;
  } else if (m.eyes === '◉') {
    svg += `<circle cx="${leftEyeX}" cy="${eyeY}" r="5.5" fill="white" stroke="${noseColor}" stroke-width="1.5"/>`;
    svg += `<circle cx="${leftEyeX + 1}" cy="${eyeY}" r="3" fill="${noseColor}"/>`;
    svg += `<circle cx="${rightEyeX}" cy="${eyeY}" r="5.5" fill="white" stroke="${noseColor}" stroke-width="1.5"/>`;
    svg += `<circle cx="${rightEyeX + 1}" cy="${eyeY}" r="3" fill="${noseColor}"/>`;
  } else if (m.eyes === '◑') {
    svg += `<circle cx="${leftEyeX}" cy="${eyeY}" r="4.5" fill="white" stroke="${noseColor}" stroke-width="1.2"/>`;
    svg += `<circle cx="${leftEyeX + 2}" cy="${eyeY - 1}" r="2.5" fill="${noseColor}"/>`;
    svg += `<circle cx="${rightEyeX}" cy="${eyeY}" r="4.5" fill="white" stroke="${noseColor}" stroke-width="1.2"/>`;
    svg += `<circle cx="${rightEyeX + 2}" cy="${eyeY - 1}" r="2.5" fill="${noseColor}"/>`;
  } else {
    svg += `<circle cx="${leftEyeX}" cy="${eyeY}" r="4" fill="${noseColor}"/>`;
    svg += `<circle cx="${leftEyeX + 1}" cy="${eyeY - 1}" r="1.5" fill="white"/>`;
    svg += `<circle cx="${rightEyeX}" cy="${eyeY}" r="4" fill="${noseColor}"/>`;
    svg += `<circle cx="${rightEyeX + 1}" cy="${eyeY - 1}" r="1.5" fill="white"/>`;
  }

  // Nose
  svg += `<ellipse cx="60" cy="48" rx="4" ry="3" fill="${noseColor}"/>`;
  svg += `<ellipse cx="60" cy="47" rx="1.5" ry="1" fill="#636E72" opacity="0.6"/>`;

  // Mouth
  if (m.mouth === 'ᴗ') {
    svg += `<path d="M 54 52 Q 60 58 66 52" stroke="${noseColor}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
  } else if (m.mouth === 'D') {
    svg += `<path d="M 53 51 Q 60 60 67 51" stroke="${noseColor}" stroke-width="1.8" fill="white" stroke-linecap="round"/>`;
  } else if (m.mouth === '~') {
    svg += `<path d="M 53 53 Q 56 51 60 53 Q 64 55 67 53" stroke="${noseColor}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
  } else if (m.mouth === '○') {
    svg += `<circle cx="60" cy="54" r="3" fill="${noseColor}" opacity="0.35"/>`;
  } else {
    svg += `<circle cx="60" cy="53" r="1.5" fill="${noseColor}"/>`;
  }

  // Tongue
  if (m.tongue) {
    svg += `<ellipse cx="62" cy="57" rx="3" ry="5" fill="${tongueColor}">
      <animate attributeName="ry" values="5;4;5" dur="1.2s" repeatCount="indefinite"/>
    </ellipse>`;
  }

  // Blush
  if (m.blush) {
    svg += `<circle cx="42" cy="48" r="5" fill="${cheekColor}" opacity="0.45"/>`;
    svg += `<circle cx="78" cy="48" r="5" fill="${cheekColor}" opacity="0.45"/>`;
  }

  // Sweat Drop
  if (m.sweat) {
    svg += `<path d="M 83 28 Q 86 24 85 30 Q 84 34 83 28" fill="#74B9FF" opacity="0.8">
      <animateTransform attributeName="transform" type="translate" values="0 0;0 4;0 0" dur="0.9s" repeatCount="indefinite"/>
    </path>`;
  }

  // Glasses
  if (m.glasses) {
    svg += `<circle cx="${leftEyeX}" cy="${eyeY}" r="7.5" fill="none" stroke="${accentColor}" stroke-width="1.8"/>`;
    svg += `<circle cx="${rightEyeX}" cy="${eyeY}" r="7.5" fill="none" stroke="${accentColor}" stroke-width="1.8"/>`;
    svg += `<line x1="${leftEyeX + 7.5}" y1="${eyeY}" x2="${rightEyeX - 7.5}" y2="${eyeY}" stroke="${accentColor}" stroke-width="1.8"/>`;
    svg += `<line x1="${leftEyeX - 7.5}" y1="${eyeY}" x2="${leftEyeX - 13}" y2="${eyeY - 3}" stroke="${accentColor}" stroke-width="1.8"/>`;
    svg += `<line x1="${rightEyeX + 7.5}" y1="${eyeY}" x2="${rightEyeX + 13}" y2="${eyeY - 3}" stroke="${accentColor}" stroke-width="1.8"/>`;
  }

  // ZZZ
  if (m.zzz) {
    svg += `<text x="82" y="24" font-size="11" fill="${accentColor}" font-weight="bold" opacity="0.8">Z
      <animate attributeName="opacity" values="0.8;0.2;0.8" dur="1.8s" repeatCount="indefinite"/>
    </text>`;
    svg += `<text x="91" y="16" font-size="9" fill="${accentColor}" font-weight="bold" opacity="0.6">z
      <animate attributeName="opacity" values="0.6;0.2;0.6" dur="2.2s" repeatCount="indefinite"/>
    </text>`;
  }

  // Sparkles
  if (m.sparkles) {
    const sparklePositions = [[18, 16], [98, 20], [14, 62], [102, 58]];
    sparklePositions.forEach(([x, y], i) => {
      svg += `<text x="${x}" y="${y}" font-size="11" fill="${accentColor}" opacity="0.85">✦
        <animate attributeName="opacity" values="0.85;0.2;0.85" dur="${0.9 + i * 0.25}s" repeatCount="indefinite"/>
      </text>`;
    });
  }

  svg += `</svg>`;
  return svg;
}

window.getMascotSVG = createMascotSVG;

// ─── 4-Screen Registry ──────────────────────────
const screens = {
  today: todayScreen,
  tasks: tasksScreen,
  timetable: timetableScreen,
  brain: brainScreen
};

// ─── Toast Notifications ────────────────────────
function showToast(message, type = 'info', duration = 3000) {
  const existing = document.querySelectorAll('.toast');
  existing.forEach(t => t.remove());

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'fadeIn 0.25s ease reverse forwards';
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

window.showToast = showToast;

// ─── Confetti Celebration ───────────────────────
function showConfetti() {
  const colors = ['#6C5CE7', '#FF6B6B', '#FFEAA7', '#00B894', '#FD79A8', '#74B9FF'];
  for (let i = 0; i < 36; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + 'vw';
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDelay = Math.random() * 0.4 + 's';
    piece.style.animationDuration = (1.4 + Math.random()) + 's';
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 2600);
  }
}

window.showConfetti = showConfetti;

// ─── Settings Screen ────────────────────────────
async function renderSettings(container) {
  let bufferPref = 30;
  try {
    const pref = await db.getPreference('buffer_minutes_before_deadline');
    if (pref && pref.value) bufferPref = Number(pref.value);
  } catch (e) {}

  const mascot = createMascotSVG('thinking');

  container.innerHTML = `
    <div style="padding: 0 var(--space-lg) var(--space-lg);">
      <div class="empty-state" style="padding: var(--space-md) 0;">
        <div class="mascot--md">${mascot}</div>
        <div style="font-weight: 800; font-size: var(--font-size-xl); margin-top: 4px;">Preferences & Data ⚙️</div>
        <div class="text-sm text-muted">Manage time buffer rules, backups, and timetable presets.</div>
      </div>

      <!-- Buffer Rule Settings -->
      <div class="settings-section">
        <div class="settings-title">⏱️ Safety Buffer Rule</div>

        <div class="card" style="margin-bottom: var(--space-md);">
          <div class="form-group">
            <label class="form-label">Safety Buffer Margin</label>
            <div style="display: flex; gap: var(--space-sm); align-items: center; margin-top: 6px;">
              <input type="range" id="buffer-range" min="15" max="120" step="15" value="${bufferPref}" style="flex: 1;" />
              <strong id="buffer-val-label" style="min-width: 60px; text-align: right; color: var(--purple-deep);">${bufferPref} mins</strong>
            </div>
            <div class="text-sm text-muted" style="margin-top: 6px;">
              Target buffer time Hectic reserves before classes or deadlines when evaluating workload.
            </div>
          </div>
        </div>
      </div>

      <!-- Sample College Timetable Preset -->
      <div class="settings-section">
        <div class="settings-title">🪄 Quick Presets</div>
        <button class="btn btn--secondary btn--block" id="seed-sample-btn" style="margin-bottom: var(--space-sm);">
          📚 Load Sample College Schedule & Rules
        </button>
      </div>

      <!-- Data Backup & Reset -->
      <div class="settings-section">
        <div class="settings-title">📊 Data & Cache Controls</div>
        <button class="btn btn--secondary btn--block" id="force-refresh-btn" style="margin-bottom: var(--space-sm);">
          🔄 Force Refresh App & Clear Cache
        </button>
        <button class="btn btn--secondary btn--block" id="export-all-btn" style="margin-bottom: var(--space-sm);">
          📤 Export Full JSON Backup
        </button>
        <button class="btn btn--danger btn--block" id="clear-all-btn">
          🗑️ Clear All Local Data
        </button>
      </div>

      <!-- About App -->
      <div class="settings-section" style="margin-top: var(--space-xl);">
        <div class="card" style="text-align: center; padding: var(--space-lg);">
          <div class="mascot--sm" style="margin: 0 auto var(--space-sm);">${createMascotSVG('celebrating')}</div>
          <div style="font-weight: 800; font-size: var(--font-size-lg);">Hectic 🐩</div>
          <div class="text-sm text-muted">Timetable-Aware Task & Schedule Assistant</div>
          <div class="text-sm text-muted" style="margin-top: 4px;">
            100% Local • Pure Utility • Fast Autocomplete
          </div>
        </div>
      </div>
    </div>
  `;

  // Buffer slider listener
  const bufferSlider = container.querySelector('#buffer-range');
  const bufferLabel = container.querySelector('#buffer-val-label');
  bufferSlider?.addEventListener('input', async () => {
    bufferLabel.textContent = `${bufferSlider.value} mins`;
    await db.setPreference('buffer_minutes_before_deadline', Number(bufferSlider.value));
  });

  // Load sample timetable
  container.querySelector('#seed-sample-btn')?.addEventListener('click', async () => {
    await seedSampleData();
    showToast('Sample timetable & rules loaded! 📚', 'success');
  });

  // Export all data
  container.querySelector('#export-all-btn')?.addEventListener('click', async () => {
    const data = {
      tasks: await db.getTasks(),
      timetable: await db.getTimetable(),
      patterns: await db.getPatterns(),
      preferences: await db.getAllPreferences(),
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hectic-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Backup downloaded! 📤', 'success');
  });

  // Force Refresh & Clear Cache
  container.querySelector('#force-refresh-btn')?.addEventListener('click', async () => {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.unregister();
      }
    }
    showToast('Caches cleared! Reloading...', 'info');
    setTimeout(() => {
      window.location.reload(true);
    }, 500);
  });

  // Nuclear clear
  container.querySelector('#clear-all-btn')?.addEventListener('click', async () => {
    if (confirm('⚠️ Clear all tasks, classes, and patterns?')) {
      if (confirm('Really sure? This resets all local data.')) {
        await db.clear('tasks');
        await db.clear('timetable');
        await db.clear('deadline_patterns');
        await db.clear('preferences_learned');
        showToast('All data cleared 🗑️', 'warning');
      }
    }
  });
}

// ─── Sample Data Seeder ─────────────────────────
async function seedSampleData() {
  const sampleClasses = [
    { dayOfWeek: 1, subject: 'Data Structures', startTime: '09:00', endTime: '10:00', type: 'Lecture' },
    { dayOfWeek: 1, subject: 'Operating Systems', startTime: '10:15', endTime: '11:15', type: 'Lecture' },
    { dayOfWeek: 1, subject: 'Web Dev Lab', startTime: '14:00', endTime: '17:00', type: 'Lab' },
    { dayOfWeek: 2, subject: 'Algorithms', startTime: '09:00', endTime: '10:00', type: 'Lecture' },
    { dayOfWeek: 2, subject: 'Database Systems', startTime: '11:30', endTime: '12:30', type: 'Lecture' },
    { dayOfWeek: 2, subject: 'Physics Lab', startTime: '14:00', endTime: '17:00', type: 'Lab' },
    { dayOfWeek: 3, subject: 'Data Structures', startTime: '10:00', endTime: '11:00', type: 'Lecture' },
    { dayOfWeek: 3, subject: 'Machine Learning', startTime: '11:15', endTime: '12:15', type: 'Elective' },
    { dayOfWeek: 4, subject: 'Operating Systems', startTime: '09:00', endTime: '10:00', type: 'Lecture' },
    { dayOfWeek: 4, subject: 'Database Lab', startTime: '14:00', endTime: '17:00', type: 'Lab' },
    { dayOfWeek: 5, subject: 'Algorithms', startTime: '10:00', endTime: '11:00', type: 'Lecture' },
    { dayOfWeek: 5, subject: 'Machine Learning', startTime: '11:30', endTime: '12:30', type: 'Elective' },
  ];

  for (const c of sampleClasses) {
    await db.addTimetableBlock(c);
  }

  await db.addPattern({
    subject: 'Physics Lab',
    ruleText: 'Due 6 days after every lab',
    description: 'Due 6 days after every lab',
    offsetDays: 6,
    anchorType: 'Lab',
    status: 'confirmed',
    dataPoints: 4,
    createdAt: new Date().toISOString()
  });

  await db.addPattern({
    subject: 'Web Dev Lab',
    ruleText: 'Due 5 days after lab',
    description: 'Due 5 days after lab',
    offsetDays: 5,
    anchorType: 'Lab',
    status: 'confirmed',
    dataPoints: 3,
    createdAt: new Date().toISOString()
  });

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const in3Days = new Date(today);
  in3Days.setDate(in3Days.getDate() + 3);

  await db.addTask({
    title: 'Physics Lab 3 Writeup',
    subject: 'Physics Lab',
    priority: 'High',
    deadline: tomorrow.toISOString(),
    status: 'open',
    createdAt: new Date().toISOString()
  });

  await db.addTask({
    title: 'Data Structures Problem Set 2',
    subject: 'Data Structures',
    priority: 'Medium',
    deadline: in3Days.toISOString(),
    status: 'open',
    createdAt: new Date().toISOString()
  });
}

// ─── Main App Bootstrap ─────────────────────────
async function initApp() {
  try {
    await db.init();
    console.log('[Hectic] Database ready (Pure Local)');

    const taskCount = await db.count('tasks');
    const ttCount = await db.count('timetable');
    if (taskCount === 0 && ttCount === 0) {
      await seedSampleData();
    }

    for (const [id, screen] of Object.entries(screens)) {
      const container = document.getElementById(`screen-${id}`);
      if (container && screen.render) {
        screen.render(container);
      }
    }

    const settingsContainer = document.getElementById('screen-settings');
    if (settingsContainer) {
      await renderSettings(settingsContainer);
    }

    const initScreen = async (screenId) => {
      const screen = screens[screenId];
      if (screen && screen.init) {
        await screen.init();
      } else if (screenId === 'settings' && settingsContainer) {
        await renderSettings(settingsContainer);
      }
    };

    router.onRouteChange(async (hash, screenId) => {
      const container = document.getElementById(`screen-${screenId}`);
      const screen = screens[screenId];
      if (container && screen) {
        screen.render(container);
        if (screen.init) await screen.init();
      } else if (screenId === 'settings' && container) {
        await renderSettings(container);
      }
    });

    router.start();

    const { screenId } = router.getCurrentRoute();
    await initScreen(screenId);

    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const route = btn.dataset.route;
        if (route) router.navigate(route);
      });
    });

    document.querySelector('#top-settings-btn')?.addEventListener('click', () => {
      router.navigate('#/settings');
    });

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(reg => {
        console.log('[Hectic] SW registered:', reg.scope);
        reg.update();
      }).catch(err => {
        console.log('[Hectic] SW registration failed:', err);
      });
    }

    console.log('[Hectic] Smart 4-Tab PWA Loaded! 🐩🧠');
  } catch (error) {
    console.error('[Hectic] Init error:', error);
    document.getElementById('app').innerHTML = `
      <div class="empty-state" style="height: 100vh; justify-content: center;">
        <div class="mascot--xl">${createMascotSVG('worried')}</div>
        <div class="empty-state__text">Oops! Something went wrong 😢</div>
        <div class="empty-state__sub">${error.message}</div>
        <button class="btn btn--primary" onclick="location.reload()" style="margin-top: 16px;">Reload Hectic 🐩</button>
      </div>
    `;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
