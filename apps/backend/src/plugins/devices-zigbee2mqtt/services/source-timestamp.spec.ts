import { SOURCE_TIMESTAMP_MAX_FUTURE_SKEW_MS, parseSourceTimestamp } from './source-timestamp';

describe('parseSourceTimestamp', () => {
	const receivedAt = new Date('2026-10-13T12:00:00Z');

	it.each([
		['ISO_8601', '2026-10-13T11:00:00.000Z', '2026-10-13T11:00:00.000Z'],
		['ISO_8601_local', '2026-10-13T13:00:00+02:00', '2026-10-13T11:00:00.000Z'],
		['epoch', Date.parse('2026-10-13T11:00:00Z'), '2026-10-13T11:00:00.000Z'],
	])('parses the %s format', (_format, raw, expected) => {
		expect(parseSourceTimestamp(raw, receivedAt)?.toISOString()).toBe(expected);
	});

	it.each([undefined, null, 'invalid', {}, true, 0, -1, '1970-01-01T00:00:00Z'])(
		'returns null for a missing, invalid, or epoch-0 value %p',
		(raw) => {
			expect(parseSourceTimestamp(raw, receivedAt)).toBeNull();
		},
	);

	it('caps a small forward clock skew at the receive time and refuses a larger one', () => {
		expect(parseSourceTimestamp('2026-10-13T12:00:05Z', receivedAt)).toEqual(receivedAt);
		expect(
			parseSourceTimestamp(
				new Date(receivedAt.getTime() + SOURCE_TIMESTAMP_MAX_FUTURE_SKEW_MS + 1).toISOString(),
				receivedAt,
			),
		).toBeNull();
	});
});
