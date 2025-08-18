import { describe, it, expect } from 'vitest';
import { 
  dateToProjectDays, 
  projectDaysToDate, 
  datetimeInputToProjectDays, 
  projectDaysToDatetimeInput,
  formatProjectDateTime,
  getCurrentTimeInProjectDays
} from '../../utils/datetime';

describe('datetime utilities', () => {
  const baseDate = new Date('2024-01-01T00:00:00');

  describe('dateToProjectDays', () => {
    it('should convert date to project-relative format (days since base)', () => {
      const testDate = new Date('2024-01-02T12:00:00'); // 1.5 days after base
      const result = dateToProjectDays(testDate, baseDate);
      expect(result).toBe(1.5);
    });

    it('should handle negative days for dates before base', () => {
      const testDate = new Date('2023-12-31T00:00:00'); // 1 day before base
      const result = dateToProjectDays(testDate, baseDate);
      expect(result).toBe(-1);
    });
  });

  describe('projectDaysToDate', () => {
    it('should convert project-relative format back to date', () => {
      const result = projectDaysToDate(1.5, baseDate);
      const expected = new Date('2024-01-02T12:00:00');
      expect(result.getTime()).toBe(expected.getTime());
    });

    it('should handle negative project-relative values', () => {
      const result = projectDaysToDate(-1, baseDate);
      const expected = new Date('2023-12-31T00:00:00');
      expect(result.getTime()).toBe(expected.getTime());
    });
  });

  describe('datetimeInputToProjectDays', () => {
    it('should convert datetime-local string to project-relative format', () => {
      const datetimeString = '2024-01-02T12:00';
      const result = datetimeInputToProjectDays(datetimeString, baseDate);
      expect(result).toBeCloseTo(1.5, 5);
    });

    it('should return 0 for empty string', () => {
      const result = datetimeInputToProjectDays('', baseDate);
      expect(result).toBe(0);
    });
  });

  describe('projectDaysToDatetimeInput', () => {
    it('should convert project-relative format to datetime-local string', () => {
      const result = projectDaysToDatetimeInput(1.5, baseDate);
      expect(result).toBe('2024-01-02T12:00');
    });

    it('should return empty string for null/undefined', () => {
      expect(projectDaysToDatetimeInput(null as any, baseDate)).toBe('');
      expect(projectDaysToDatetimeInput(undefined as any, baseDate)).toBe('');
    });
  });

  describe('formatProjectDateTime', () => {
    it('should format project-relative datetime as readable string', () => {
      const result = formatProjectDateTime(1.5, baseDate);
      expect(result).toBeTruthy();
      expect(result).toContain('2024');
    });

    it('should return empty string for null/undefined', () => {
      expect(formatProjectDateTime(null as any, baseDate)).toBe('');
      expect(formatProjectDateTime(undefined as any, baseDate)).toBe('');
    });
  });

  describe('getCurrentTimeInProjectDays', () => {
    it('should return a number representing current time', () => {
      const result = getCurrentTimeInProjectDays(baseDate);
      expect(typeof result).toBe('number');
      // Should be positive since current date is after 2024-01-01
      expect(result).toBeGreaterThan(0);
    });
  });

  describe('roundtrip conversion', () => {
    it('should preserve datetime through roundtrip conversion', () => {
      const originalDate = new Date('2024-06-15T14:30:00');
      const projectDaysValue = dateToProjectDays(originalDate, baseDate);
      const convertedBack = projectDaysToDate(projectDaysValue, baseDate);
      
      expect(convertedBack.getTime()).toBe(originalDate.getTime());
    });

    it('should preserve datetime input through roundtrip conversion', () => {
      const datetimeInput = '2024-06-15T14:30';
      const projectDaysValue = datetimeInputToProjectDays(datetimeInput, baseDate);
      const convertedBack = projectDaysToDatetimeInput(projectDaysValue, baseDate);
      
      expect(convertedBack).toBe(datetimeInput);
    });
  });
});