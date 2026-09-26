// Hectic — Local Date Parser & Time Utilities
// Pure local logic, timezone-safe local date string formatters, NO AI calls

export function getLocalDateStr(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseToLocalDate(val) {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  if (typeof val === 'string') {
    // If it's pure YYYY-MM-DD format, parse as local midnight
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      const [y, m, d] = val.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

export function parseDatePhrase(phrase, referenceDate = new Date()) {
  const text = (phrase || '').toLowerCase().trim();
  const ref = parseToLocalDate(referenceDate);
  ref.setHours(0, 0, 0, 0); // Normalize reference date to local midnight
  
  const result = (date, confidence = 'exact', label = text) => ({
    date,
    label,
    confidence,
    dateStr: getLocalDateStr(date)
  });

  if (text === 'today') {
    return result(ref);
  }
  
  if (text === 'tomorrow') {
    const d = new Date(ref);
    d.setDate(d.getDate() + 1);
    return result(d);
  }
  
  if (text === 'day after tomorrow') {
    const d = new Date(ref);
    d.setDate(d.getDate() + 2);
    return result(d);
  }
  
  const inDaysMatch = text.match(/^(?:due )?in (\d+) days?$/);
  if (inDaysMatch) {
    const days = parseInt(inDaysMatch[1], 10);
    const d = new Date(ref);
    d.setDate(d.getDate() + days);
    return result(d, 'exact', `In ${days} days`);
  }

  const plusDaysMatch = text.match(/^\+(\d+)d?$/);
  if (plusDaysMatch) {
    const days = parseInt(plusDaysMatch[1], 10);
    const d = new Date(ref);
    d.setDate(d.getDate() + days);
    return result(d, 'exact', `In ${days} days`);
  }
  
  if (text === 'this week') {
    const d = new Date(ref);
    const day = d.getDay();
    // End of current week (Sunday). Sunday is 0.
    const daysUntilSunday = day === 0 ? 0 : 7 - day;
    d.setDate(d.getDate() + daysUntilSunday);
    return result(d, 'inferred', 'End of this week');
  }
  
  if (text === 'next week') {
    const d = new Date(ref);
    const day = d.getDay();
    const daysUntilSunday = day === 0 ? 0 : 7 - day;
    d.setDate(d.getDate() + daysUntilSunday + 7);
    return result(d, 'inferred', 'End of next week');
  }
  
  if (text === 'end of month') {
    const d = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
    return result(d, 'inferred', 'End of month');
  }
  
  if (text === 'next month') {
    const d = new Date(ref.getFullYear(), ref.getMonth() + 2, 0);
    return result(d, 'inferred', 'End of next month');
  }

  const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  
  const nextWeekdayMatch = text.match(/^next (sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/);
  if (nextWeekdayMatch) {
    const targetDay = weekdays.indexOf(nextWeekdayMatch[1]);
    const currentDay = ref.getDay();
    let daysToAdd = (targetDay - currentDay + 7) % 7;
    if (daysToAdd === 0) daysToAdd = 7;
    daysToAdd += 7; // Next week
    const d = new Date(ref);
    d.setDate(d.getDate() + daysToAdd);
    return result(d, 'exact');
  }

  const weekdayMatch = text.match(/^(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/);
  if (weekdayMatch) {
    const targetDay = weekdays.indexOf(weekdayMatch[1]);
    const currentDay = ref.getDay();
    let daysToAdd = (targetDay - currentDay + 7) % 7;
    if (daysToAdd === 0) daysToAdd = 7;
    const d = new Date(ref);
    d.setDate(d.getDate() + daysToAdd);
    return result(d, 'exact');
  }

  // Fallback to standard parsing
  const parsedTime = Date.parse(text);
  if (!isNaN(parsedTime)) {
    const d = new Date(parsedTime);
    // If year is in the past, assume it means upcoming occurrence in current/next year
    if (d < ref && text.indexOf(ref.getFullYear().toString()) === -1) {
       d.setFullYear(ref.getFullYear());
       if (d < ref) {
           d.setFullYear(ref.getFullYear() + 1);
       }
    }
    return result(d, 'exact', text);
  }

  return null;
}

export function formatDate(date) {
  const d = parseToLocalDate(date);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatDateFull(date) {
  const d = parseToLocalDate(date);
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

export function daysUntil(targetDate, referenceDate = new Date()) {
  const ref = parseToLocalDate(referenceDate);
  ref.setHours(0, 0, 0, 0);
  const target = parseToLocalDate(targetDate);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - ref.getTime()) / (1000 * 60 * 60 * 24));
}

export function isToday(date, referenceDate = new Date()) {
  return daysUntil(date, referenceDate) === 0;
}

export function isTomorrow(date, referenceDate = new Date()) {
  return daysUntil(date, referenceDate) === 1;
}

export function isThisWeek(date, referenceDate = new Date()) {
  const days = daysUntil(date, referenceDate);
  const ref = parseToLocalDate(referenceDate);
  const currentDay = ref.getDay();
  const daysUntilSunday = currentDay === 0 ? 0 : 7 - currentDay;
  return days >= 0 && days <= daysUntilSunday;
}

export function getQuickChips(referenceDate = new Date()) {
  const ref = parseToLocalDate(referenceDate);
  ref.setHours(0, 0, 0, 0);
  
  const chips = [
    { label: 'Today', phrase: 'today' },
    { label: 'Tomorrow', phrase: 'tomorrow' },
    { label: 'In 2 days', phrase: 'in 2 days' },
    { label: 'In 3 days', phrase: 'in 3 days' },
    { label: 'This week', phrase: 'this week' },
    { label: 'Next week', phrase: 'next week' }
  ];
  
  return chips.map(chip => {
    const parsed = parseDatePhrase(chip.phrase, ref);
    return {
      label: chip.label,
      date: parsed.date,
      dateStr: parsed.dateStr,
      formattedDate: formatDate(parsed.date)
    };
  });
}
