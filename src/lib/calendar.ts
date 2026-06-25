// Lightweight date helpers for calendar mode. Everything works in local
// time and represents a day as a 'YYYY-MM-DD' string.

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const pad = (n: number) => String(n).padStart(2, '0');

/** Format a Date as a local 'YYYY-MM-DD' key. */
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parse a 'YYYY-MM-DD' key into a local Date (midnight). */
export function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** The Monday on or before the given date. */
export function startOfWeekMonday(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = r.getDay(); // 0 Sun … 6 Sat
  const diff = (day + 6) % 7; // days since Monday
  return addDays(r, -diff);
}

/** Build `count` consecutive Monday-start weeks beginning at the week of `from`. */
export function buildWeeks(from: Date, count: number): Date[][] {
  const start = startOfWeekMonday(from);
  const weeks: Date[][] = [];
  for (let w = 0; w < count; w += 1) {
    const weekStart = addDays(start, w * 7);
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)));
  }
  return weeks;
}

export function dayName(d: Date): string {
  return DAY_NAMES[d.getDay()];
}

export function shortDate(d: Date): string {
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function isSameYmd(a: Date, key: string): boolean {
  return ymd(a) === key;
}

/**
 * Group dated posts into Monday-start weeks for the client calendar view.
 * Only posts with a `date` are included. Returns weeks (each with a label
 * and its posts in day order), sorted chronologically.
 */
export function groupByWeek<T extends { date?: string }>(
  posts: T[],
): { weekStart: string; weekLabel: string; items: { date: string; post: T }[] }[] {
  const dated = posts.filter((p) => p.date);
  const byWeek = new Map<string, { date: string; post: T }[]>();

  for (const post of dated) {
    const d = parseYmd(post.date as string);
    const key = ymd(startOfWeekMonday(d));
    if (!byWeek.has(key)) byWeek.set(key, []);
    byWeek.get(key)!.push({ date: post.date as string, post });
  }

  return [...byWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, items]) => {
      const start = parseYmd(weekStart);
      const end = addDays(start, 6);
      return {
        weekStart,
        weekLabel: `${shortDate(start)} – ${shortDate(end)}`,
        items: items.sort((a, b) => a.date.localeCompare(b.date)),
      };
    });
}
