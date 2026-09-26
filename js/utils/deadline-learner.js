// Hectic — Gradual Deadline-Pattern Learning (§6)
// Pure local math, rolling averages, NO AI calls

import db from '../db.js';
import { getLocalDateStr } from './date-parser.js';

export class DeadlineLearner {
  constructor() {
    this.STORE_PREFS = 'preferences_learned';
    this.STORE_PATTERNS = 'deadline_patterns';
  }

  daysBetween(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    d1.setHours(0, 0, 0, 0);
    d2.setHours(0, 0, 0, 0);
    return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
  }

  // Find the most recent or upcoming class for a subject
  async findAnchorClass(subjectName, taskDeadlineDate = new Date()) {
    if (!subjectName) return null;
    const timetable = await db.getTimetable();
    const cleanSub = subjectName.trim().toLowerCase();
    const matchingClasses = timetable.filter(b => b.subject.trim().toLowerCase() === cleanSub);

    if (matchingClasses.length === 0) return null;

    const ref = new Date(taskDeadlineDate);
    const currentDay = ref.getDay();

    // Prefer labs if available, otherwise any class for this subject
    const labClass = matchingClasses.find(b => b.type.toLowerCase() === 'lab');
    const targetBlock = labClass || matchingClasses[0];

    // Find the class occurrence in the week before the deadline
    let dayDiff = (currentDay - targetBlock.dayOfWeek + 7) % 7;
    if (dayDiff === 0) dayDiff = 7; // prior week occurrence

    const anchorDate = new Date(ref);
    anchorDate.setDate(anchorDate.getDate() - dayDiff);
    anchorDate.setHours(0, 0, 0, 0);

    return {
      block: targetBlock,
      anchorDate,
      anchorDayName: anchorDate.toLocaleDateString('en-US', { weekday: 'long' }),
      blockType: targetBlock.type
    };
  }

  // Step 1 & 2: Log data point when task is added/saved
  async logDeadlineDataPoint(subjectName, taskDeadlineDate, explicitAnchorDate = null) {
    if (!subjectName || !taskDeadlineDate) return null;

    const cleanSubject = subjectName.trim();
    let anchor = explicitAnchorDate;
    let anchorType = 'Lab';

    if (!anchor) {
      const detected = await this.findAnchorClass(cleanSubject, taskDeadlineDate);
      if (detected) {
        anchor = detected.anchorDate;
        anchorType = detected.blockType;
      } else {
        // Fallback anchor: creation day / today
        anchor = new Date();
        anchor.setHours(0, 0, 0, 0);
      }
    }

    const offset = this.daysBetween(anchor, taskDeadlineDate);
    if (offset < 0) return null; // Ignore past deadlines relative to class

    const prefKey = `deadline_pts_${cleanSubject.toLowerCase()}`;
    let pref = await db.getPreference(prefKey);
    let points = pref && pref.value && Array.isArray(pref.value) ? pref.value : [];

    points.push({
      offset,
      anchorDate: anchor instanceof Date ? anchor.toISOString() : anchor,
      deadlineDate: taskDeadlineDate instanceof Date ? taskDeadlineDate.toISOString() : taskDeadlineDate,
      loggedAt: new Date().toISOString()
    });

    // Keep last 10 data points for rolling average
    if (points.length > 10) points = points.slice(-10);

    await db.setPreference(prefKey, points, points.length);

    // Check if we should propose a new pattern
    return this.evaluateLearning(cleanSubject, points, anchorType);
  }

  // Step 3: Compute rolling average and propose/update pattern
  async evaluateLearning(subjectName, points, anchorType = 'Lab') {
    if (!points || points.length < 2) return null;

    const offsets = points.map(p => p.offset);
    const sum = offsets.reduce((a, b) => a + b, 0);
    const avgOffset = Math.round(sum / offsets.length);

    // Check existing pattern
    const existing = await db.getPatternBySubject(subjectName);

    if (!existing) {
      // Propose new learning pattern
      const proposed = {
        subject: subjectName,
        ruleText: `Due ${avgOffset} days after every ${anchorType.toLowerCase()}`,
        description: `Due ${avgOffset} days after every ${anchorType.toLowerCase()}`,
        offsetDays: avgOffset,
        anchorType: anchorType || 'Lab',
        status: 'learning',
        dataPoints: points.length,
        createdAt: new Date().toISOString()
      };
      const saved = await db.addPattern(proposed);
      return { type: 'new_proposal', pattern: saved, avgOffset };
    } else if (existing.status === 'learning') {
      // Update rolling offset on learning pattern
      existing.offsetDays = avgOffset;
      existing.ruleText = `Due ${avgOffset} days after every ${existing.anchorType.toLowerCase()}`;
      existing.description = existing.ruleText;
      existing.dataPoints = points.length;
      await db.updatePattern(existing);
      return { type: 'updated_proposal', pattern: existing, avgOffset };
    }

    return null;
  }

  // Check if subject matches text (e.g. task title "Physics Lab 3" -> "Physics")
  async detectSubjectInText(text) {
    if (!text) return null;
    const timetable = await db.getTimetable();
    const patterns = await db.getPatterns();

    const allSubjectNames = [
      ...new Set([
        ...timetable.map(b => b.subject),
        ...patterns.map(p => p.subject)
      ])
    ].filter(Boolean);

    const lower = text.toLowerCase();
    for (const sub of allSubjectNames) {
      if (lower.includes(sub.toLowerCase())) {
        return sub;
      }
    }
    return null;
  }

  // Step 4: Suggest deadline if confirmed pattern exists (§4.3)
  async suggestDeadlineForSubject(subjectName, referenceDate = new Date()) {
    if (!subjectName) return null;
    const pattern = await db.getPatternBySubject(subjectName);
    if (!pattern || pattern.status !== 'confirmed') return null;

    const timetable = await db.getTimetable();
    const cleanSub = subjectName.trim().toLowerCase();
    const matchingBlocks = timetable.filter(b => b.subject.trim().toLowerCase() === cleanSub);

    if (matchingBlocks.length === 0) {
      // No timetable match, suggest simple offset from reference
      const target = new Date(referenceDate);
      target.setDate(target.getDate() + pattern.offsetDays);
      return {
        suggestedDate: target,
        dateStr: getLocalDateStr(target),
        ruleText: pattern.ruleText || `Due in ${pattern.offsetDays} days`,
        reasoning: `${pattern.offsetDays} days after rule`
      };
    }

    // Find next upcoming class block
    const ref = new Date(referenceDate);
    const refDay = ref.getDay();

    // Prefer lab block if anchor is Lab
    const anchorBlock = matchingBlocks.find(b => b.type.toLowerCase() === pattern.anchorType.toLowerCase()) || matchingBlocks[0];

    // Days until this class occurrence
    let daysUntilClass = (anchorBlock.dayOfWeek - refDay + 7) % 7;
    // If today is the class day and time hasn't passed, use today; otherwise next occurrence
    const classOccurrenceDate = new Date(ref);
    classOccurrenceDate.setDate(classOccurrenceDate.getDate() + daysUntilClass);
    classOccurrenceDate.setHours(0, 0, 0, 0);

    const suggestedDate = new Date(classOccurrenceDate);
    suggestedDate.setDate(suggestedDate.getDate() + pattern.offsetDays);

    const dayName = classOccurrenceDate.toLocaleDateString('en-US', { weekday: 'short' });
    const reasoning = `${pattern.offsetDays} days after ${dayName}'s ${anchorBlock.type}`;

    return {
      suggestedDate,
      dateStr: getLocalDateStr(suggestedDate),
      ruleText: pattern.ruleText,
      reasoning,
      anchorBlock,
      anchorDate: classOccurrenceDate
    };
  }

  // Step 5: Log override when user changes a suggested deadline
  async logOverride(subjectName, actualDate, anchorDate = null) {
    return this.logDeadlineDataPoint(subjectName, actualDate, anchorDate);
  }
}

const deadlineLearner = new DeadlineLearner();
export default deadlineLearner;
