// Hectic — Smart Brain (Local Personalization & Suggestion Engine)
// 100% Organic, Deterministic Math, Local Statistics, Real-Time Autocomplete

import db from '../db.js';
import { parseDatePhrase, formatDate, daysUntil, isTomorrow, isToday, getLocalDateStr } from './date-parser.js';

export class SmartBrain {
  constructor() {}

  // 1. Real-time predictive autocomplete as user types
  async predictFromText(text) {
    const raw = (text || '').trim();
    if (!raw) return null;

    const timetable = await db.getTimetable();
    const patterns = await db.getPatterns();
    const allTasks = await db.getTasks();

    const lower = raw.toLowerCase();

    // 1.1 Match Subject (fuzzy substring match)
    const allSubjects = [...new Set([
      ...timetable.map(b => b.subject),
      ...patterns.map(p => p.subject),
      ...allTasks.map(t => t.subject)
    ])].filter(Boolean);

    let matchedSubject = null;
    for (const sub of allSubjects) {
      if (lower.includes(sub.toLowerCase())) {
        matchedSubject = sub;
        break;
      }
    }

    // If not in title, check prefix matching
    if (!matchedSubject) {
      const words = lower.split(/\s+/);
      for (const w of words) {
        if (w.length >= 2) {
          const found = allSubjects.find(s => s.toLowerCase().startsWith(w) || s.toLowerCase().includes(w));
          if (found) {
            matchedSubject = found;
            break;
          }
        }
      }
    }

    // 1.2 Natural date extraction from text (e.g. "due friday", "in 2 days", "tomorrow")
    let extractedDate = null;
    let extractedDateStr = null;
    const parsedDate = parseDatePhrase(raw);
    if (parsedDate && parsedDate.dateStr) {
      extractedDate = parsedDate.date;
      extractedDateStr = parsedDate.dateStr;
    }

    // 1.3 If subject found and no explicit date in text, resolve from confirmed pattern / habit
    let ruleSuggestion = null;
    if (matchedSubject && !extractedDateStr) {
      ruleSuggestion = await this.resolveSubjectDeadline(matchedSubject);
      if (ruleSuggestion) {
        extractedDate = ruleSuggestion.date;
        extractedDateStr = ruleSuggestion.dateStr;
      }
    }

    // 1.4 Infer Priority based on proximity
    let inferredPriority = 'Medium';
    if (extractedDate) {
      const diff = daysUntil(extractedDate);
      if (diff <= 1) inferredPriority = 'High';
      else if (diff <= 3) inferredPriority = 'Medium';
      else inferredPriority = 'Low';
    }

    // 1.5 Best open study window today to work on it
    const todayGaps = await this.getTodayFreeWindows();
    const bestGap = todayGaps.length > 0 ? todayGaps[0] : null;

    return {
      rawText: raw,
      subject: matchedSubject,
      date: extractedDate,
      dateStr: extractedDateStr,
      formattedDate: extractedDate ? formatDate(extractedDate) : null,
      priority: inferredPriority,
      ruleText: ruleSuggestion ? ruleSuggestion.ruleText : null,
      reasoning: ruleSuggestion ? ruleSuggestion.reasoning : null,
      bestStudyWindow: bestGap ? `${bestGap.startTime} – ${bestGap.endTime} (${bestGap.durationText} free)` : null
    };
  }

  // 2. Resolve confirmed deadline rule or statistical habit for a subject
  async resolveSubjectDeadline(subjectName, referenceDate = new Date()) {
    if (!subjectName) return null;
    const clean = subjectName.trim().toLowerCase();

    // Check confirmed rule first
    const pattern = await db.getPatternBySubject(subjectName);
    const timetable = await db.getTimetable();
    const matchingClasses = timetable.filter(b => b.subject.trim().toLowerCase() === clean);

    const ref = new Date(referenceDate);
    const refDay = ref.getDay();

    if (pattern && pattern.status === 'confirmed') {
      const anchorBlock = matchingClasses.find(b => b.type.toLowerCase() === (pattern.anchorType || 'lab').toLowerCase()) || matchingClasses[0];

      if (anchorBlock) {
        let daysUntilClass = (anchorBlock.dayOfWeek - refDay + 7) % 7;
        const classDate = new Date(ref);
        classDate.setDate(classDate.getDate() + daysUntilClass);
        classDate.setHours(0, 0, 0, 0);

        const targetDate = new Date(classDate);
        targetDate.setDate(targetDate.getDate() + pattern.offsetDays);

        const dayName = classDate.toLocaleDateString('en-US', { weekday: 'short' });
        return {
          date: targetDate,
          dateStr: getLocalDateStr(targetDate),
          ruleText: pattern.ruleText,
          reasoning: `${pattern.offsetDays}d after ${dayName} ${anchorBlock.type}`
        };
      } else {
        const targetDate = new Date(ref);
        targetDate.setDate(targetDate.getDate() + pattern.offsetDays);
        return {
          date: targetDate,
          dateStr: getLocalDateStr(targetDate),
          ruleText: pattern.ruleText,
          reasoning: `Due in ${pattern.offsetDays} days`
        };
      }
    }

    // If no confirmed pattern, check learned habits in preferences
    const prefKey = `deadline_pts_${clean}`;
    const pref = await db.getPreference(prefKey);
    if (pref && pref.value && pref.value.length >= 2) {
      const offsets = pref.value.map(p => p.offset);
      const avg = Math.round(offsets.reduce((a, b) => a + b, 0) / offsets.length);
      const targetDate = new Date(ref);
      targetDate.setDate(targetDate.getDate() + avg);

      return {
        date: targetDate,
        dateStr: getLocalDateStr(targetDate),
        ruleText: `Habit: ~${avg} days after class`,
        reasoning: `Based on your past ${pref.value.length} submissions`
      };
    }

    return null;
  }

  // 3. Calculate today's free study gaps between classes
  async getTodayFreeWindows(dayOfWeek = new Date().getDay()) {
    const allBlocks = await db.getTimetable();
    const todayBlocks = allBlocks
      .filter(b => b.dayOfWeek === dayOfWeek)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    if (todayBlocks.length === 0) {
      return [{
        startTime: '09:00',
        endTime: '18:00',
        durationMinutes: 540,
        durationText: '9h',
        label: 'Entire day open'
      }];
    }

    const gaps = [];
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);

    // Day boundaries: 08:00 to 20:00
    const dayStart = '08:00';
    const dayEnd = '20:00';

    // Gap before first class
    if (todayBlocks[0].startTime > dayStart) {
      const mins = this._timeDiffMinutes(dayStart, todayBlocks[0].startTime);
      if (mins >= 45) {
        gaps.push({
          startTime: dayStart,
          endTime: todayBlocks[0].startTime,
          durationMinutes: mins,
          durationText: this._formatDuration(mins),
          label: `Before ${todayBlocks[0].subject}`
        });
      }
    }

    // Gaps between consecutive classes
    for (let i = 0; i < todayBlocks.length - 1; i++) {
      const current = todayBlocks[i];
      const next = todayBlocks[i + 1];
      if (next.startTime > current.endTime) {
        const mins = this._timeDiffMinutes(current.endTime, next.startTime);
        if (mins >= 30) {
          gaps.push({
            startTime: current.endTime,
            endTime: next.startTime,
            durationMinutes: mins,
            durationText: this._formatDuration(mins),
            label: `Between ${current.subject} & ${next.subject}`
          });
        }
      }
    }

    // Gap after last class
    const lastClass = todayBlocks[todayBlocks.length - 1];
    if (lastClass.endTime < dayEnd) {
      const mins = this._timeDiffMinutes(lastClass.endTime, dayEnd);
      if (mins >= 45) {
        gaps.push({
          startTime: lastClass.endTime,
          endTime: dayEnd,
          durationMinutes: mins,
          durationText: this._formatDuration(mins),
          label: `After ${lastClass.subject}`
        });
      }
    }

    // Filter out past gaps if viewing today
    return gaps.filter(g => g.endTime > currentTime || dayOfWeek !== new Date().getDay());
  }

  // 4. Workload Radar & Bottleneck Detector (7-day forecast)
  async getWorkloadRadar() {
    const tasks = await db.getTasks();
    const openTasks = tasks.filter(t => t.status === 'open' && t.deadline);
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const daysForecast = [];
    let heavyDayCount = 0;
    const bottleneckDates = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      const dateStr = getLocalDateStr(d);
      const dayTasks = openTasks.filter(t => t.deadline.startsWith(dateStr));
      const highTasks = dayTasks.filter(t => (t.priority || '').toLowerCase() === 'high');

      const isHeavy = dayTasks.length >= 3 || highTasks.length >= 2;
      if (isHeavy) {
        heavyDayCount++;
        bottleneckDates.push({
          date: d,
          dateStr,
          dayName: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
          taskCount: dayTasks.length,
          tasks: dayTasks
        });
      }

      daysForecast.push({
        date: d,
        dateStr,
        dayName: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short' }),
        taskCount: dayTasks.length,
        highCount: highTasks.length,
        isHeavy
      });
    }

    return {
      forecast: daysForecast,
      hasBottleneck: heavyDayCount > 0,
      bottleneckDates,
      advice: heavyDayCount > 0
        ? `⚠️ Bottleneck detected on ${bottleneckDates[0].dayName} (${bottleneckDates[0].taskCount} tasks). Recommend spreading workload earlier.`
        : `✅ Workload is evenly balanced across the week!`
    };
  }

  _timeDiffMinutes(t1, t2) {
    const [h1, m1] = t1.split(':').map(Number);
    const [h2, m2] = t2.split(':').map(Number);
    return (h2 * 60 + m2) - (h1 * 60 + m1);
  }

  _formatDuration(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  }
}

const smartBrain = new SmartBrain();
export default smartBrain;
