import { coverDeltaNeedsRefresh } from './shelly-cover-telemetry';

const complete = { id: 0, state: 'stopped', current_pos: 40, pos_control: true };
describe('native cover notification refresh classification', () => {
	it.each([
		{ raw: { errors: null }, refresh: true },
		{ raw: { state: 'opening', errors: null }, refresh: true },
		{ raw: { ...complete, errors: null }, refresh: true },
		{ raw: { ...complete, tag: null, errors: null }, refresh: true },
		{ raw: { current_pos: 55 }, refresh: true },
		{ raw: complete, refresh: false },
		{ raw: { ...complete, errors: [] }, refresh: false },
	])('classifies complete/partial status $raw as refresh=$refresh', ({ raw, refresh }) => {
		expect(coverDeltaNeedsRefresh(raw, 0)).toBe(refresh);
	});
	it.each([
		{ id: 1 },
		{ id: null },
		{ id: '0' },
		{ state: 'unknown' },
		{ state: null },
		{ current_pos: null },
		{ current_pos: NaN },
		{ current_pos: -1 },
		{ current_pos: 101 },
		{ pos_control: false },
		{ pos_control: 'true' },
		{ tag: {} },
		{ tag: 'x'.repeat(21) },
		{ state: 'open', current_pos: 40 },
		{ state: 'closed', current_pos: 40 },
		{ errors: ['obstruction'] },
		{ errors: 'obstruction' },
		{ errors: {} },
	])('rejects invalid fields %j before either partial or complete null-error refresh', (invalid) => {
		expect(coverDeltaNeedsRefresh({ errors: null, ...invalid }, 0)).toBe(false);
		expect(coverDeltaNeedsRefresh({ ...complete, errors: null, ...invalid }, 0)).toBe(false);
	});
});
