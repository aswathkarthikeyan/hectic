import db from '../db.js';
import { getLocalDateStr } from './date-parser.js';

export class ReminderEngine {
  constructor() {
    this.scheduledTimers = new Map();
  }

  async requestPermission() {
    if (!('Notification' in window)) {
      return 'unsupported';
    }
    if (Notification.permission === 'granted') {
      return 'granted';
    }
    return await Notification.requestPermission();
  }

  async showNotification(title, body, tag, silent = false) {
    if (Notification.permission === 'granted') {
      try {
        const registration = await navigator.serviceWorker.ready;
        return registration.showNotification(title, {
          body,
          tag,
          silent,
          icon: '/icons/icon-192x192.png'
        });
      } catch (err) {
        // Fallback if no SW
        return new Notification(title, { body, tag, silent });
      }
    }
  }

  cancelReminders(taskId) {
    const timers = this.scheduledTimers.get(taskId);
    if (timers) {
      timers.forEach(timer => clearTimeout(timer));
      this.scheduledTimers.delete(taskId);
    }
  }

  inferPriority(deadlineDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dDate = new Date(deadlineDate);
    dDate.setHours(0, 0, 0, 0);
    
    const daysUntil = Math.round((dDate - today) / (1000 * 60 * 60 * 24));
    
    if (daysUntil <= 1) return 'high';
    if (daysUntil <= 3) return 'medium';
    return 'low';
  }

  async scheduleReminders(task) {
    if (!task.id || !task.deadline) return;
    
    this.cancelReminders(task.id);
    
    const priority = task.priority || this.inferPriority(task.deadline);
    const deadlineTime = new Date(task.deadline).getTime();
    const now = Date.now();
    const timers = [];
    
    const schedule = (timeMs, title, body, silent = false) => {
      const delay = timeMs - now;
      if (delay > 0 && delay < 2147483647) { // Max setTimeout delay
        const timerId = setTimeout(() => {
          this.showNotification(title, body, `task-${task.id}-${timeMs}`, silent);
        }, delay);
        timers.push(timerId);
      }
    };

    const oneHour = 1000 * 60 * 60;
    
    if (priority === 'high') {
      // 24h before
      schedule(deadlineTime - (24 * oneHour), 'Due in 24 hours', task.title);
      // 3h before
      schedule(deadlineTime - (3 * oneHour), 'Due in 3 hours', task.title);
      // At deadline
      schedule(deadlineTime, 'Task Due Now', task.title);
    } else if (priority === 'medium') {
      // 24h before
      schedule(deadlineTime - (24 * oneHour), 'Due in 24 hours', task.title);
      // At deadline
      schedule(deadlineTime, 'Task Due Now', task.title);
    } else {
      // Low priority: silent at deadline
      schedule(deadlineTime, 'Task Due', task.title, true);
    }
    
    this.scheduledTimers.set(task.id, timers);
  }

  async checkSameDayLoad(dateStr) {
    const tasks = await db.getTasksDueOnDate(dateStr);
    let highCount = 0;
    
    for (const task of tasks) {
      const priority = task.priority || this.inferPriority(task.deadline);
      if (priority === 'high') highCount++;
    }
    
    if (highCount >= 2) {
      return {
        shouldNudge: true,
        message: `You have ${highCount} high-priority tasks due tomorrow. You might want to start on them tonight.`,
        taskCount: highCount
      };
    }
    
    return { shouldNudge: false, message: '', taskCount: highCount };
  }

  async getEveningNudges() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = getLocalDateStr(tomorrow);
    
    const load = await this.checkSameDayLoad(dateStr);
    if (load.shouldNudge) {
      return [{
        title: 'Heads up for tomorrow',
        body: load.message,
        tag: 'evening-nudge'
      }];
    }
    
    return [];
  }
}
