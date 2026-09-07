import { emitFlattenedValue, rssiToQuality, toEnergy } from './transform.utils';

describe('toEnergy', () => {
	test('returns number as-is', () => {
		expect(toEnergy(123)).toBe(123);
		expect(toEnergy(0)).toBe(0);
		expect(toEnergy(-5)).toBe(-5);
	});

	test('extracts total when object.total is number', () => {
		expect(toEnergy({ total: 42 })).toBe(42);
	});

	test('parses total when object.total is numeric string', () => {
		expect(toEnergy({ total: '42' })).toBe(42);
		expect(toEnergy({ total: '0' })).toBe(0);
		expect(toEnergy({ total: '-7' })).toBe(-7);
	});

	test('returns 0 when object.total is non-numeric string', () => {
		expect(toEnergy({ total: 'NaN' })).toBe(0);
		expect(toEnergy({ total: 'abc' })).toBe(0);
		expect(toEnergy({ total: '' })).toBe(0);
	});

	test('returns 0 when object has no total or total is wrong type', () => {
		expect(toEnergy({})).toBe(0);
		expect(toEnergy({ total: true })).toBe(0 as number);
		expect(toEnergy({ total: null })).toBe(0);
		expect(toEnergy({ total: undefined })).toBe(0);
	});

	test('returns 0 for null/undefined/non-object non-number', () => {
		expect(toEnergy(null as unknown)).toBe(0);
		expect(toEnergy(undefined as unknown)).toBe(0);
		expect(toEnergy('123' as unknown)).toBe(0);
		expect(toEnergy(false as unknown)).toBe(0);
	});
});

describe('rssiToQuality', () => {
	test('clamps low boundary (<= -100) to 0%', () => {
		expect(rssiToQuality(-100)).toBe(0);
		expect(rssiToQuality(-120)).toBe(0);
	});

	test('clamps high boundary (>= -50) to 100%', () => {
		expect(rssiToQuality(-50)).toBe(100);
		expect(rssiToQuality(-10)).toBe(100);
	});

	test('maps mid-range linearly and rounds', () => {
		// formula: round(2 * (rssi + 100))
		// rssi = -75 -> round(2 * 25) = 50
		expect(rssiToQuality(-75)).toBe(50);

		// rssi = -76 -> round(2 * 24) = 48
		expect(rssiToQuality(-76)).toBe(48);

		// check rounding behavior at .5
		// rssi = -74.5 -> 2 * 25.5 = 51 → round = 51
		expect(rssiToQuality(-74.5)).toBe(51);
	});
});

describe('emitFlattenedValue', () => {
	function collect(): { emit: jest.Mock; calls: () => [string, string, unknown][] } {
		const emit = jest.fn();

		return {
			emit,
			calls: () =>
				emit.mock.calls
					.filter((c: unknown[]) => c[0] === 'value')
					.map((c: unknown[]) => [c[1], c[2], c[3]] as [string, string, unknown]),
		};
	}

	test('emits the parent key for a scalar value and nothing else', () => {
		const { emit, calls } = collect();

		emitFlattenedValue(emit, 'switch:0', 'output', true);

		expect(calls()).toEqual([['switch:0', 'output', true]]);
	});

	test('emits the parent object plus a leaf per own key for a nested object', () => {
		const { emit, calls } = collect();

		emitFlattenedValue(emit, 'switch:0', 'aenergy', { total: 12.345, by_minute: [1, 2, 3], minute_ts: 111 });

		const keys = calls().map(([, attr]) => attr);

		expect(keys).toEqual(
			expect.arrayContaining(['aenergy', 'aenergy.total', 'aenergy.by_minute', 'aenergy.minute_ts']),
		);

		const total = calls().find(([, attr]) => attr === 'aenergy.total');
		expect(total?.[2]).toBe(12.345);

		// The parent event still carries the full raw object.
		const parent = calls().find(([, attr]) => attr === 'aenergy');
		expect(parent?.[2]).toEqual({ total: 12.345, by_minute: [1, 2, 3], minute_ts: 111 });
	});

	test('treats arrays as leaves, not recursing into their entries', () => {
		const { emit, calls } = collect();

		emitFlattenedValue(emit, 'devicepower:0', 'by_minute', [1, 2, 3]);

		expect(calls()).toEqual([['devicepower:0', 'by_minute', [1, 2, 3]]]);
	});

	test('recurses through nested objects two levels deep', () => {
		const { emit, calls } = collect();

		emitFlattenedValue(emit, 'devicepower:0', 'battery', { percent: 95, V: 3.2 });

		const keys = calls().map(([, attr]) => attr);

		expect(keys).toEqual(expect.arrayContaining(['battery', 'battery.percent', 'battery.V']));

		const percent = calls().find(([, attr]) => attr === 'battery.percent');
		expect(percent?.[2]).toBe(95);

		const voltage = calls().find(([, attr]) => attr === 'battery.V');
		expect(voltage?.[2]).toBe(3.2);
	});

	test('treats null as a leaf', () => {
		const { emit, calls } = collect();

		emitFlattenedValue(emit, 'switch:0', 'apower', null);

		expect(calls()).toEqual([['switch:0', 'apower', null]]);
	});
});
