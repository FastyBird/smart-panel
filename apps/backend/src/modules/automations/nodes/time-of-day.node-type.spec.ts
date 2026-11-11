import { AutomationTriggerData, normalizeAutomationNodeType } from '../graph/node-type';
import { TimeOfDaySpec } from '../time/house-time';

import { TIME_OF_DAY_NODE_TYPE, TimeOfDayConfigDto, createTimeOfDayNodeType } from './time-of-day.node-type';

const WEEKDAY_REASON = 'A weekday is a number from 0 (Sunday) to 6.';

describe('time.of-day', () => {
	type Fire = (data: { time: string; date: string; weekday: number; timezone: string }) => void;

	let subscriptions: { spec: TimeOfDaySpec; fire: Fire }[];
	let released: number;

	const card = () =>
		createTimeOfDayNodeType({
			onTimeOfDay: (spec, fire) => {
				subscriptions.push({ spec, fire });

				return () => {
					released += 1;
				};
			},
		});

	const problems = (config: Record<string, unknown>) => card().validateConfig(config);

	beforeEach(() => {
		subscriptions = [];
		released = 0;
	});

	it('is a trigger with one output and nothing it refers to', () => {
		const registered = normalizeAutomationNodeType(card());

		expect(registered).toMatchObject({
			type: TIME_OF_DAY_NODE_TYPE,
			kind: 'trigger',
			ports: { inputs: [], outputs: ['out'] },
		});
		expect(registered.references({ time: '07:00' })).toEqual([]);
	});

	it('accepts a time, with or without weekdays', async () => {
		expect(await problems({ time: '07:00' })).toEqual([]);
		expect(await problems({ time: '23:59', weekdays: [1, 2, 3, 4, 5] })).toEqual([]);
		expect(await problems({ time: '00:00', weekdays: [0] })).toEqual([]);
	});

	it.each([
		['no time', {}, 'time', 'The time must be written as HH:mm.'],
		['a time with seconds', { time: '07:00:00' }, 'time', 'The time must be written as HH:mm.'],
		['an hour that does not exist', { time: '24:00' }, 'time', 'The time must be written as HH:mm.'],
		['a time that is a number', { time: 700 }, 'time', 'The time must be written as HH:mm.'],
		['no weekday at all', { time: '07:00', weekdays: [] }, 'weekdays', 'At least one weekday is needed.'],
		['a weekday twice', { time: '07:00', weekdays: [1, 1] }, 'weekdays', 'A weekday can be listed only once.'],
		['a weekday that does not exist', { time: '07:00', weekdays: [7] }, 'weekdays', WEEKDAY_REASON],
		['a weekday by name', { time: '07:00', weekdays: ['mon'] }, 'weekdays', WEEKDAY_REASON],
		['weekdays that are not a list', { time: '07:00', weekdays: 1 }, 'weekdays', 'The weekdays must be a list.'],
		['a timezone of its own', { time: '07:00', timezone: 'UTC' }, 'timezone', 'This property is not allowed.'],
	])('refuses %s', async (_name, config, field, reason) => {
		expect(await problems(config)).toContainEqual({ field, reason });
	});

	it('describes its configuration for a form', () => {
		expect(card().configSchema).toMatchObject({
			type: 'object',
			required: ['time'],
			additionalProperties: false,
			properties: {
				time: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' },
				weekdays: { type: 'array', items: { type: 'integer', minimum: 0, maximum: 6 }, uniqueItems: true },
			},
		});
	});

	it('hands its time to the shared time source and passes on what fired', () => {
		const fired: AutomationTriggerData[] = [];

		const release = card().subscribe({ time: '07:00', weekdays: [1, 5] } as TimeOfDayConfigDto, (data) =>
			fired.push(data),
		);

		expect(subscriptions.map((item) => item.spec)).toEqual([{ time: '07:00', weekdays: [1, 5] }]);
		expect(fired).toEqual([]);

		subscriptions[0].fire({ time: '07:00', date: '2026-01-05', weekday: 1, timezone: 'Europe/Prague' });

		expect(fired).toEqual([{ time: '07:00', date: '2026-01-05', weekday: 1, timezone: 'Europe/Prague' }]);

		release();

		expect(released).toBe(1);
	});

	it('asks for every day when no weekdays are given', () => {
		card().subscribe({ time: '07:00' } as TimeOfDayConfigDto, () => undefined);

		expect(subscriptions[0].spec).toEqual({ time: '07:00' });
	});
});
