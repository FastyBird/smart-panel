import { describe, expect, it } from 'vitest';

import { NotificationsModuleNotificationSeverity } from '../../../openapi.constants';

import { NotificationsFilterSchema } from './list.schemas';

describe('NotificationsFilterSchema', () => {
	it('applies every default when the query string carries nothing', () => {
		const parsed = NotificationsFilterSchema.parse({});

		expect(parsed).toEqual({
			status: 'all',
			severity: [],
			source: undefined,
			unread: false,
		});
	});

	it('round-trips a fully populated query string back into typed filters', () => {
		// Shaped exactly as `route.query` would hand it back: every value a string, the
		// multi-select value already coerced to an array by `useListQuery` before it reaches
		// the schema.
		const fromQueryString = {
			status: 'active',
			severity: [NotificationsModuleNotificationSeverity.error, NotificationsModuleNotificationSeverity.critical],
			source: 'devices-home-assistant-plugin',
			unread: 'true',
		};

		const parsed = NotificationsFilterSchema.parse(fromQueryString);

		expect(parsed).toEqual({
			status: 'active',
			severity: [NotificationsModuleNotificationSeverity.error, NotificationsModuleNotificationSeverity.critical],
			source: 'devices-home-assistant-plugin',
			unread: true,
		});

		// Serializing back the way `useListQuery` does (`String(value)` for a scalar, mapped
		// over an array) must reproduce the exact strings that came in - that is the round trip.
		expect(String(parsed.status)).toBe(fromQueryString.status);
		expect(parsed.severity.map(String)).toEqual(fromQueryString.severity);
		expect(String(parsed.source)).toBe(fromQueryString.source);
		expect(String(parsed.unread)).toBe(fromQueryString.unread);
	});

	it('accepts a real boolean for unread as well as the query string form', () => {
		expect(NotificationsFilterSchema.parse({ unread: false }).unread).toBe(false);
		expect(NotificationsFilterSchema.parse({ unread: true }).unread).toBe(true);
		expect(NotificationsFilterSchema.parse({ unread: 'false' }).unread).toBe(false);
		expect(NotificationsFilterSchema.parse({ unread: 'true' }).unread).toBe(true);
	});

	it('rejects a severity value outside the known enum', () => {
		const parsed = NotificationsFilterSchema.safeParse({ severity: ['not-a-severity'] });

		expect(parsed.success).toBe(false);
	});

	it('rejects a status value outside the known enum', () => {
		const parsed = NotificationsFilterSchema.safeParse({ status: 'not-a-status' });

		expect(parsed.success).toBe(false);
	});
});
