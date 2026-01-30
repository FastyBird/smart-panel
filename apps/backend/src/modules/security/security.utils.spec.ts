import { SecurityLastEvent } from './contracts/security-signal.type';
import { pickNewestEvent } from './security.utils';

describe('pickNewestEvent', () => {
	const old: SecurityLastEvent = { type: 'old', timestamp: '2025-01-01T00:00:00Z' };
	const mid: SecurityLastEvent = { type: 'mid', timestamp: '2025-03-01T00:00:00Z' };
	const newer: SecurityLastEvent = { type: 'new', timestamp: '2025-06-15T12:00:00Z' };
	const invalid: SecurityLastEvent = { type: 'bad', timestamp: 'not-a-date' };

	it('should return candidate when current is undefined', () => {
		expect(pickNewestEvent(undefined, old)).toBe(old);
	});

	it('should return newer candidate over older current', () => {
		expect(pickNewestEvent(old, newer)).toBe(newer);
	});

	it('should keep current when candidate is older', () => {
		expect(pickNewestEvent(newer, old)).toBe(newer);
	});

	it('should skip candidate with invalid timestamp', () => {
		expect(pickNewestEvent(old, invalid)).toBe(old);
	});

	it('should return undefined when candidate has invalid timestamp and current is undefined', () => {
		expect(pickNewestEvent(undefined, invalid)).toBeUndefined();
	});

	it('should replace current with invalid timestamp', () => {
		expect(pickNewestEvent(invalid, mid)).toBe(mid);
	});
});
