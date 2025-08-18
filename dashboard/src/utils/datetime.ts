/**
 * Utilities for converting between JavaScript dates and project-relative datetime format
 * where datetime is represented as floating-point days elapsed since the project's base date
 */

/**
 * Converts a JavaScript Date to project-relative format (days since base date)
 * @param date The JavaScript Date to convert
 * @param baseDate The base date (T0) for the project
 * @returns Number of days (with fractional part for time) since base date
 */
export function dateToProjectDays(date: Date, baseDate: Date): number {
  const timeDifference = date.getTime() - baseDate.getTime();
  // Convert milliseconds to days (1 day = 24 * 60 * 60 * 1000 ms)
  return timeDifference / (24 * 60 * 60 * 1000);
}

/**
 * Converts project-relative format (days since base date) to JavaScript Date
 * @param daysSinceBase Number of days (with fractional part) since base date
 * @param baseDate The base date (T0) for the project
 * @returns JavaScript Date object
 */
export function projectDaysToDate(daysSinceBase: number, baseDate: Date): Date {
  const milliseconds = daysSinceBase * 24 * 60 * 60 * 1000;
  return new Date(baseDate.getTime() + milliseconds);
}

/**
 * Converts a datetime-local input string to project-relative format
 * @param datetimeString String in format "YYYY-MM-DDTHH:MM"
 * @param baseDate The base date (T0) for the project
 * @returns Number of days since base date
 */
export function datetimeInputToProjectDays(datetimeString: string, baseDate: Date): number {
  if (!datetimeString) return 0;
  const date = new Date(datetimeString);
  return dateToProjectDays(date, baseDate);
}

/**
 * Converts project-relative format to datetime-local input string
 * @param daysSinceBase Number of days since base date
 * @param baseDate The base date (T0) for the project
 * @returns String in format "YYYY-MM-DDTHH:MM"
 */
export function projectDaysToDatetimeInput(daysSinceBase: number, baseDate: Date): string {
  if (daysSinceBase === null || daysSinceBase === undefined) return '';
  const date = projectDaysToDate(daysSinceBase, baseDate);
  
  // Format as YYYY-MM-DDTHH:MM (required for datetime-local input)
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Formats a project-relative datetime as a human-readable string
 * @param daysSinceBase Number of days since base date
 * @param baseDate The base date (T0) for the project
 * @returns Formatted date string
 */
export function formatProjectDateTime(daysSinceBase: number, baseDate: Date): string {
  if (daysSinceBase === null || daysSinceBase === undefined) return '';
  const date = projectDaysToDate(daysSinceBase, baseDate);
  
  return date.toLocaleString();
}

/**
 * Formats a project-relative date (without time) as a human-readable string
 * @param daysSinceBase Number of days since base date
 * @param baseDate The base date (T0) for the project
 * @returns Formatted date string
 */
export function formatProjectDate(daysSinceBase: number, baseDate: Date): string {
  if (daysSinceBase === null || daysSinceBase === undefined) return '';
  const date = projectDaysToDate(daysSinceBase, baseDate);
  
  return date.toLocaleDateString();
}

/**
 * Gets the current time in project-relative format
 * @param baseDate The base date (T0) for the project
 * @returns Current time as days since base date
 */
export function getCurrentTimeInProjectDays(baseDate: Date): number {
  return dateToProjectDays(new Date(), baseDate);
}