import { normalizeAutomationNodeType } from '../graph/node-type';
import { runContext } from '../testing/node-fixtures';
import { HouseTimeReading, localTimeAt } from '../time/house-time';

import { TIME_WINDOW_NODE_TYPE, TimeWindowConfigDto, createTimeWindowNodeType } from './time-window.node-type';

const WEEKDAY_REASON = 'A weekday is a number from 0 (Sunday) to 6.';

describe('time.window', () => {
	let reading: HouseTimeReading;

	const card = () => createTimeWindowNodeType({ houseNow: () => reading });

	const problems = (config: Record<string, unknown>) => card().validateConfig(config);

	const evaluate = (config: Record<string, unknown>) =>
		card().evaluate(config as unknown as TimeWindowConfigDto, runContext());

	/** Sets the house clock, in Europe/Prague */
	const houseTimeIs = (iso: string): void => {
		const instant = Date.parse(iso);

		reading = { status: 'ok', instant, timezone: 'Europe/Prague', local: localTimeAt(instant, 'Europe/Prague') };
	};

	beforeEach(() => {
		// Monday, 12:00 in Prague
		houseTimeIs('2026-01-05T11:00:00Z');
	});

	it('is a condition with a yes and a no output', () => {
		expect(normalizeAutomationNodeType(card())).toMatchObject({
			type: TIME_WINDOW_NODE_TYPE,
			kind: 'condition',
			ports: { inputs: ['in'], outputs: ['yes', 'no'] },
		});
	});

	it('accepts a window inside a day and one over midnight', async () => {
		expect(await problems({ from: '08:00', to: '17:00' })).toEqual([]);
		expect(await problems({ from: '22:00', to: '06:00', weekdays: [5, 6] })).toEqual([]);
	});

	it('refuses a window whose start and end are the same', async () => {
		expect(await problems({ from: '08:00', to: '08:00' })).toEqual([
			{ field: 'to', reason: 'The end must differ from the start.' },
		]);
	});

	it.each([
		['no start', { to: '17:00' }, 'from', 'The start must be written as HH:mm.'],
		['no end', { from: '08:00' }, 'to', 'The end must be written as HH:mm.'],
		['an end that is not a time', { from: '08:00', to: 'noon' }, 'to', 'The end must be written as HH:mm.'],
		['no weekday at all', { from: '08:00', to: '17:00', weekdays: [] }, 'weekdays', 'At least one weekday is needed.'],
		['a weekday that does not exist', { from: '08:00', to: '17:00', weekdays: [-1] }, 'weekdays', WEEKDAY_REASON],
		['an unknown property', { from: '08:00', to: '17:00', invert: true }, 'invert', 'This property is not allowed.'],
	])('refuses %s', async (_name, config, field, reason) => {
		expect(await problems(config)).toContainEqual({ field, reason });
	});

	it('describes its configuration for a form', () => {
		expect(card().configSchema).toMatchObject({
			type: 'object',
			required: ['from', 'to'],
			additionalProperties: false,
			properties: { from: { type: 'string' }, to: { type: 'string' }, weekdays: { type: 'array' } },
		});
	});

	it('answers yes inside the window and records the house time it saw', async () => {
		expect(await evaluate({ from: '08:00', to: '17:00' })).toEqual({
			result: true,
			observed: { time: '12:00', weekday: 1, timezone: 'Europe/Prague' },
		});
	});

	it('answers no outside the window', async () => {
		expect(await evaluate({ from: '13:00', to: '17:00' })).toMatchObject({ result: false });
	});

	it('includes the start and excludes the end', async () => {
		expect(await evaluate({ from: '12:00', to: '12:01' })).toMatchObject({ result: true });
		expect(await evaluate({ from: '11:00', to: '12:00' })).toMatchObject({ result: false });
	});

	it('applies the weekdays', async () => {
		expect(await evaluate({ from: '08:00', to: '17:00', weekdays: [1] })).toMatchObject({ result: true });
		expect(await evaluate({ from: '08:00', to: '17:00', weekdays: [0, 6] })).toMatchObject({ result: false });
	});

	it('for a window over midnight the weekday names the day it started', async () => {
		const fridayNight = { from: '22:00', to: '06:00', weekdays: [5] };

		// Friday 23:00
		houseTimeIs('2026-01-09T22:00:00Z');
		expect(await evaluate(fridayNight)).toMatchObject({ result: true, observed: { time: '23:00', weekday: 5 } });

		// Saturday 05:00 still belongs to Friday night
		houseTimeIs('2026-01-10T04:00:00Z');
		expect(await evaluate(fridayNight)).toMatchObject({ result: true, observed: { time: '05:00', weekday: 6 } });

		// Saturday 06:00 is the end; Saturday 23:00 is another night; Friday 05:00 belonged to Thursday
		houseTimeIs('2026-01-10T05:00:00Z');
		expect(await evaluate(fridayNight)).toMatchObject({ result: false });

		houseTimeIs('2026-01-10T22:00:00Z');
		expect(await evaluate(fridayNight)).toMatchObject({ result: false });

		houseTimeIs('2026-01-09T04:00:00Z');
		expect(await evaluate(fridayNight)).toMatchObject({ result: false });
	});

	it('uses the house clock on the night the clocks change', async () => {
		// Europe/Prague, 29 March 2026: 03:30 summer time, one and a half hours after local midnight by the clock
		houseTimeIs('2026-03-29T01:30:00Z');

		expect(await evaluate({ from: '03:00', to: '04:00' })).toMatchObject({
			result: true,
			observed: { time: '03:30' },
		});
		expect(await evaluate({ from: '02:00', to: '03:00' })).toMatchObject({ result: false });
	});

	it('answers no, with the reason, while the system clock is not set', async () => {
		reading = { status: 'clock_not_trusted', reason: 'The system clock is not set yet.' };

		expect(await evaluate({ from: '00:00', to: '23:59' })).toEqual({
			result: false,
			reason: 'The system clock is not set yet.',
		});
	});

	it('answers no, with the reason, while the house timezone is not valid', async () => {
		reading = { status: 'timezone_not_valid', reason: 'The house timezone is not valid.' };

		expect(await evaluate({ from: '00:00', to: '23:59' })).toEqual({
			result: false,
			reason: 'The house timezone is not valid.',
		});
	});
});
