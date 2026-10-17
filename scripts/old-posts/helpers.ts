// Small pure helper for the old-post import (unit-tested in tests/old-posts.test.ts).

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/**
 * The first day mentioned in a free-text date, as "YYYY-MM-DD":
 *   "March 22, 2024" -> 2024-03-22 · "June 3rd-9th" -> 2024-06-03 · "July 23rd-August 9th, 2024" -> 2024-07-23
 * The year is the first four-digit year in the text, or `defaultYear` when there is none.
 */
export function parseStartDate(text: string, defaultYear: number): string | null {
  const lower = text.toLowerCase();
  const month = lower.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b/);
  if (!month) return null;
  const monthIndex = MONTHS.findIndex((m) => m.startsWith(month[1].slice(0, 3)));
  // First day number after the month name ("July, 7th-8th" -> 7).
  const day = lower.slice(month.index! + month[0].length).match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (!day) return null;
  const d = Number(day[1]);
  if (d < 1 || d > 31) return null;
  const year = Number(lower.match(/\b(19|20)\d{2}\b/)?.[0] ?? defaultYear);
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
