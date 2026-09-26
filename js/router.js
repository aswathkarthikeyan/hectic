// Hectic — Streamlined Hash Router
// Routes: today, tasks, timetable, brain (patterns & radar), settings

class Router {
  constructor() {
    this.routes = {
      '#/': 'today',
      '#/tasks': 'tasks',
      '#/timetable': 'timetable',
      '#/brain': 'brain',
      '#/patterns': 'brain', // backwards compat
      '#/settings': 'settings'
    };

    this.currentRoute = '#/';
    this.callbacks = [];

    window.addEventListener('hashchange', () => this.handleHashChange());
  }

  start() {
    if (!window.location.hash || !this.routes[window.location.hash]) {
      window.location.hash = '#/';
    }
    this.handleHashChange();
  }

  handleHashChange() {
    let hash = window.location.hash || '#/';

    if (!this.routes[hash]) {
      hash = '#/';
      window.location.hash = hash;
      return;
    }

    this.currentRoute = hash;
    const screenId = this.routes[hash];

    // Hide all screens
    document.querySelectorAll('.screen').forEach(s => {
      s.classList.remove('active');
      s.style.display = 'none';
    });

    // Show target screen
    const target = document.getElementById(`screen-${screenId}`);
    if (target) {
      target.classList.add('active');
      target.style.display = 'block';
    }

    // Update bottom nav active state
    document.querySelectorAll('.nav-btn').forEach(btn => {
      const href = btn.dataset.route;
      if (href === hash || (hash === '#/patterns' && href === '#/brain')) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Header title
    const titles = {
      'today': 'Hectic 🐩',
      'tasks': 'Tasks 📝',
      'timetable': 'Timetable 📚',
      'brain': 'Smart Brain 🧠',
      'settings': 'Settings ⚙️'
    };
    const titleEl = document.querySelector('.top-bar__title');
    if (titleEl) {
      titleEl.textContent = titles[screenId] || 'Hectic';
    }

    // Reset scroll
    const mainContainer = document.querySelector('.screen-container');
    if (mainContainer) {
      mainContainer.scrollTop = 0;
    }

    this.callbacks.forEach(cb => cb(hash, screenId));
  }

  navigate(route) {
    if (!route.startsWith('#')) {
      route = '#' + (route.startsWith('/') ? route : '/' + route);
    }
    window.location.hash = route;
  }

  getCurrentRoute() {
    return {
      hash: this.currentRoute,
      screenId: this.routes[this.currentRoute] || 'today'
    };
  }

  onRouteChange(callback) {
    if (typeof callback === 'function') {
      this.callbacks.push(callback);
    }
  }
}

const router = new Router();
export default router;
