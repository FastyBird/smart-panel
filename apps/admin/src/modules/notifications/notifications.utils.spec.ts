import { describe, expect, it } from 'vitest';

import { formatRelativeTime } from './notifications.utils';

const now = new Date('2026-11-23T12:00:00.000Z');
const ago = (seconds: number): Date => new Date(now.getTime() - seconds * 1000);

describe('formatRelativeTime', () => {
	it('speaks the language of the application', () => {
		expect(formatRelativeTime(ago(5 * 60), 'en-US', now)).toBe('5 minutes ago');
		expect(formatRelativeTime(ago(5 * 60), 'de-DE', now)).toBe('vor 5 Minuten');
		expect(formatRelativeTime(ago(2 * 60 * 60), 'cs-CZ', now)).toBe('před 2 hodinami');
	});

	it('picks the largest whole unit', () => {
		expect(formatRelativeTime(ago(3 * 24 * 60 * 60), 'en-US', now)).toBe('3 days ago');
		expect(formatRelativeTime(ago(24 * 60 * 60), 'en-US', now)).toBe('yesterday');
		expect(formatRelativeTime(ago(40 * 24 * 60 * 60), 'en-US', now)).toBe('last month');
	});

	it('says now for anything under a minute', () => {
		expect(formatRelativeTime(ago(10), 'en-US', now)).toBe('now');
	});
});
