// Hectic — IndexedDB Wrapper
// All data is local, on-device, fully offline

export class HecticDB {
  constructor() {
    this.dbName = 'hectic-db';
    this.dbVersion = 2;
    this.db = null;
  }

  init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = (event) => {
        console.error('[HecticDB] Error opening database:', event.target.error);
        reject(event.target.error);
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        console.log('[HecticDB] Initialized successfully (v' + this.dbVersion + ')');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // 1. timetable (fixed weekly schedule)
        if (!db.objectStoreNames.contains('timetable')) {
          const store = db.createObjectStore('timetable', { keyPath: 'id', autoIncrement: true });
          store.createIndex('dayOfWeek', 'dayOfWeek', { unique: false });
          store.createIndex('subject', 'subject', { unique: false });
        }

        // 2. deadline_patterns (learned/confirmed rules per subject)
        if (!db.objectStoreNames.contains('deadline_patterns')) {
          const store = db.createObjectStore('deadline_patterns', { keyPath: 'id', autoIncrement: true });
          store.createIndex('subject', 'subject', { unique: false });
          store.createIndex('status', 'status', { unique: false });
        }

        // 3. tasks
        if (!db.objectStoreNames.contains('tasks')) {
          const store = db.createObjectStore('tasks', { keyPath: 'id', autoIncrement: true });
          store.createIndex('subject', 'subject', { unique: false });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('deadline', 'deadline', { unique: false });
          store.createIndex('priority', 'priority', { unique: false });
        }

        // 4. locations (learned & confirmed places)
        if (!db.objectStoreNames.contains('locations')) {
          const store = db.createObjectStore('locations', { keyPath: 'id', autoIncrement: true });
          store.createIndex('name', 'name', { unique: false });
          store.createIndex('uses', 'uses', { unique: false });
          store.createIndex('confirmed', 'confirmed', { unique: false });
        }

        // 5. preferences_learned (gradual-learning store)
        if (!db.objectStoreNames.contains('preferences_learned')) {
          db.createObjectStore('preferences_learned', { keyPath: 'key' });
        }

        // 6. clarification_log (clarification history for graduation)
        if (!db.objectStoreNames.contains('clarification_log')) {
          const store = db.createObjectStore('clarification_log', { keyPath: 'id', autoIncrement: true });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('question', 'question', { unique: false });
        }
      };
    });
  }

  // ─── Generic Helpers ─────────────────────────────
  _tx(storeName, mode = 'readonly') {
    if (!this.db) {
      throw new Error('[HecticDB] Database not initialized. Call init() first.');
    }
    const tx = this.db.transaction([storeName], mode);
    return tx.objectStore(storeName);
  }

  add(storeName, data) {
    return new Promise((resolve, reject) => {
      try {
        const store = this._tx(storeName, 'readwrite');
        const req = store.add(data);
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => reject(e.target.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  put(storeName, data) {
    return new Promise((resolve, reject) => {
      try {
        const store = this._tx(storeName, 'readwrite');
        const req = store.put(data);
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => reject(e.target.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  get(storeName, key) {
    return new Promise((resolve, reject) => {
      try {
        const store = this._tx(storeName, 'readonly');
        const parsedKey = typeof key === 'string' && !isNaN(Number(key)) && storeName !== 'preferences_learned' ? Number(key) : key;
        const req = store.get(parsedKey);
        req.onsuccess = (e) => resolve(e.target.result || null);
        req.onerror = (e) => reject(e.target.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  getAll(storeName) {
    return new Promise((resolve, reject) => {
      try {
        const store = this._tx(storeName, 'readonly');
        const req = store.getAll();
        req.onsuccess = (e) => resolve(e.target.result || []);
        req.onerror = (e) => reject(e.target.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  getAllByIndex(storeName, indexName, value) {
    return new Promise((resolve, reject) => {
      try {
        const store = this._tx(storeName, 'readonly');
        const index = store.index(indexName);
        const req = index.getAll(value);
        req.onsuccess = (e) => resolve(e.target.result || []);
        req.onerror = (e) => reject(e.target.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  deleteRecord(storeName, key) {
    return new Promise((resolve, reject) => {
      try {
        const store = this._tx(storeName, 'readwrite');
        const parsedKey = typeof key === 'string' && !isNaN(Number(key)) && storeName !== 'preferences_learned' ? Number(key) : key;
        const req = store.delete(parsedKey);
        req.onsuccess = () => resolve();
        req.onerror = (e) => reject(e.target.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  clear(storeName) {
    return new Promise((resolve, reject) => {
      try {
        const store = this._tx(storeName, 'readwrite');
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = (e) => reject(e.target.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  count(storeName) {
    return new Promise((resolve, reject) => {
      try {
        const store = this._tx(storeName, 'readonly');
        const req = store.count();
        req.onsuccess = (e) => resolve(e.target.result || 0);
        req.onerror = (e) => reject(e.target.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  // ─── Tasks Helpers ───────────────────────────────
  async getTasks() {
    const tasks = await this.getAll('tasks');
    return tasks.map(t => this._normalizeTask(t));
  }

  async getTask(id) {
    const task = await this.get('tasks', Number(id));
    return task ? this._normalizeTask(task) : null;
  }

  async addTask(task) {
    const normalized = {
      title: task.title || '',
      subject: task.subject || null,
      priority: task.priority || 'Medium',
      deadline: task.deadline || null,
      status: task.status || 'open',
      createdAt: task.createdAt || new Date().toISOString()
    };
    const id = await this.add('tasks', normalized);
    return { ...normalized, id };
  }

  async updateTask(task) {
    if (!task.id) throw new Error('Task ID required for update');
    const normalized = this._normalizeTask(task);
    await this.put('tasks', normalized);
    return normalized;
  }

  async deleteTask(id) {
    return this.deleteRecord('tasks', Number(id));
  }

  async getTasksDueOnDate(dateStr) {
    const tasks = await this.getTasks();
    return tasks.filter(t => {
      if (!t.deadline || t.status !== 'open') return false;
      return t.deadline.startsWith(dateStr);
    });
  }

  async getTasksDueInRange(startDate, endDate) {
    const tasks = await this.getTasks();
    return tasks.filter(t => {
      if (!t.deadline || t.status !== 'open') return false;
      const d = t.deadline.split('T')[0];
      return d >= startDate && d <= endDate;
    });
  }

  _normalizeTask(t) {
    return {
      id: Number(t.id),
      title: t.title || '',
      subject: t.subject || t.subject_id || null,
      priority: t.priority || 'Medium',
      deadline: t.deadline || t.deadline_date || null,
      status: t.status || 'open',
      createdAt: t.createdAt || t.created_at || new Date().toISOString()
    };
  }

  // ─── Timetable Helpers ───────────────────────────
  async getTimetable() {
    const list = await this.getAll('timetable');
    return list.map(b => this._normalizeBlock(b));
  }

  async getTimetableBlock(id) {
    const block = await this.get('timetable', Number(id));
    return block ? this._normalizeBlock(block) : null;
  }

  async addTimetableBlock(block) {
    const normalized = {
      dayOfWeek: Number(block.dayOfWeek ?? block.day_of_week ?? 1),
      subject: block.subject || '',
      startTime: block.startTime || block.start_time || '09:00',
      endTime: block.endTime || block.end_time || '10:00',
      type: block.type || block.block_type || 'Lecture'
    };
    const id = await this.add('timetable', normalized);
    return { ...normalized, id };
  }

  async updateTimetableBlock(block) {
    if (!block.id) throw new Error('Block ID required for update');
    const normalized = this._normalizeBlock(block);
    await this.put('timetable', normalized);
    return normalized;
  }

  async deleteTimetableBlock(id) {
    return this.deleteRecord('timetable', Number(id));
  }

  async getTodayTimetable(dayOfWeek) {
    const all = await this.getTimetable();
    return all.filter(b => b.dayOfWeek === Number(dayOfWeek));
  }

  async getRemainingTimetableToday(dayOfWeek, currentTime) {
    const blocks = await this.getTodayTimetable(dayOfWeek);
    return blocks
      .filter(b => b.endTime > currentTime)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  _normalizeBlock(b) {
    return {
      id: Number(b.id),
      dayOfWeek: Number(b.dayOfWeek ?? b.day_of_week ?? 1),
      subject: b.subject || '',
      startTime: b.startTime || b.start_time || '09:00',
      endTime: b.endTime || b.end_time || '10:00',
      type: b.type || b.block_type || 'Lecture'
    };
  }

  // ─── Deadline Patterns Helpers ───────────────────
  async getPatterns() {
    const list = await this.getAll('deadline_patterns');
    return list.map(p => this._normalizePattern(p));
  }

  async getPattern(id) {
    const pat = await this.get('deadline_patterns', Number(id));
    return pat ? this._normalizePattern(pat) : null;
  }

  async getPatternBySubject(subjectName) {
    if (!subjectName) return null;
    const all = await this.getPatterns();
    const clean = subjectName.trim().toLowerCase();
    return all.find(p => p.subject.trim().toLowerCase() === clean) || null;
  }

  async addPattern(pattern) {
    const normalized = {
      subject: pattern.subject || '',
      ruleText: pattern.ruleText || pattern.rule_text || pattern.description || `Due ${pattern.offsetDays || 6} days after ${pattern.anchorType || 'Lab'}`,
      description: pattern.description || pattern.ruleText || `Due ${pattern.offsetDays || 6} days after ${pattern.anchorType || 'Lab'}`,
      offsetDays: Number(pattern.offsetDays || pattern.offset_days || pattern.offset || 6),
      anchorType: pattern.anchorType || pattern.anchor || 'Lab',
      status: pattern.status || pattern.confidence || 'confirmed',
      dataPoints: Number(pattern.dataPoints || pattern.data_points || 1),
      createdAt: pattern.createdAt || new Date().toISOString()
    };
    const id = await this.add('deadline_patterns', normalized);
    return { ...normalized, id };
  }

  async updatePattern(pattern) {
    if (!pattern.id) throw new Error('Pattern ID required for update');
    const normalized = this._normalizePattern(pattern);
    await this.put('deadline_patterns', normalized);
    return normalized;
  }

  async deletePattern(id) {
    return this.deleteRecord('deadline_patterns', Number(id));
  }

  _normalizePattern(p) {
    return {
      id: Number(p.id),
      subject: p.subject || p.subject_id || '',
      ruleText: p.ruleText || p.rule_text || p.description || '',
      description: p.description || p.ruleText || p.rule_text || '',
      offsetDays: Number(p.offsetDays || p.offset_days || p.offset || 6),
      anchorType: p.anchorType || p.anchor || 'Lab',
      status: p.status || p.confidence || 'confirmed',
      dataPoints: Number(p.dataPoints || p.data_points || 1),
      createdAt: p.createdAt || new Date().toISOString()
    };
  }

  // ─── Locations Helpers ───────────────────────────
  async getLocations() {
    const list = await this.getAll('locations');
    return list.map(l => this._normalizeLocation(l));
  }

  async getLocation(id) {
    const loc = await this.get('locations', Number(id));
    return loc ? this._normalizeLocation(loc) : null;
  }

  async addLocation(loc) {
    const normalized = {
      name: loc.name || loc.label || 'Saved Place',
      address: loc.address || '',
      lat: Number(loc.lat || 0),
      lng: Number(loc.lng || 0),
      uses: Number(loc.uses || loc.times_used || 0),
      confirmed: loc.confirmed !== false,
      lastUsed: loc.lastUsed || loc.last_used_at || new Date().toISOString()
    };
    const id = await this.add('locations', normalized);
    return { ...normalized, id };
  }

  async updateLocation(loc) {
    if (!loc.id) throw new Error('Location ID required for update');
    const normalized = this._normalizeLocation(loc);
    await this.put('locations', normalized);
    return normalized;
  }

  async deleteLocation(id) {
    return this.deleteRecord('locations', Number(id));
  }

  async getTopLocations(limit = 5) {
    const all = await this.getLocations();
    return all
      .filter(l => l.confirmed === true)
      .sort((a, b) => b.uses - a.uses)
      .slice(0, limit);
  }

  async incrementLocationUsage(locationIdOrName) {
    let loc = null;
    if (typeof locationIdOrName === 'number' || (!isNaN(Number(locationIdOrName)) && typeof locationIdOrName !== 'string')) {
      loc = await this.getLocation(Number(locationIdOrName));
    } else {
      const all = await this.getLocations();
      loc = all.find(l => l.name.toLowerCase() === String(locationIdOrName).toLowerCase());
    }

    if (loc) {
      loc.uses = (loc.uses || 0) + 1;
      loc.lastUsed = new Date().toISOString();
      return this.updateLocation(loc);
    }
    return null;
  }

  _normalizeLocation(l) {
    return {
      id: Number(l.id),
      name: l.name || l.label || 'Saved Place',
      address: l.address || '',
      lat: Number(l.lat || 0),
      lng: Number(l.lng || 0),
      uses: Number(l.uses || l.times_used || 0),
      confirmed: l.confirmed !== false,
      lastUsed: l.lastUsed || l.last_used_at || new Date().toISOString()
    };
  }

  // ─── Preferences Helpers ─────────────────────────
  async getPreference(key) {
    return this.get('preferences_learned', key);
  }

  async setPreference(key, value, evidenceCount = 1) {
    return this.put('preferences_learned', {
      key,
      value,
      evidence_count: evidenceCount,
      last_updated: new Date().toISOString()
    });
  }

  async getAllPreferences() {
    return this.getAll('preferences_learned');
  }

  // ─── Clarification Log Helpers ───────────────────
  async logClarification(question, answer, context = '') {
    return this.add('clarification_log', {
      question,
      answer,
      context,
      timestamp: new Date().toISOString()
    });
  }

  async getClarificationLog() {
    return this.getAll('clarification_log');
  }
}

const db = new HecticDB();
export default db;
