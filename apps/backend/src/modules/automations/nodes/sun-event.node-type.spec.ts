import { normalizeAutomationNodeType } from '../graph/node-type';
import { SunEventFireData, SunEventSpec } from '../time/sun';

import { SUN_EVENT_NODE_TYPE, createSunEventNodeType } from './sun-event.node-type';

const OFFSET_REASON = 'The offset is a whole number of minutes from -360 to 360.';

describe('sun.event', () => {
	let subscriptions: { spec: SunEventSpec; fire: (data: SunEventFireData) => void }[];
	let released: number;
	let unavailable: string | undefined;

	const card = () =>
		createSunEventNodeType({
			onSunEvent: (spec, fire) => {
				subscriptions.push({ spec, fire });

				return () => {
					released += 1;
				};
			},
			sunUnavailableReason: () => unavailable,
		});

	const problems = (config: Record<string, unknown>) => card().validateConfig(config);

	beforeEach(() => {
		subscriptions = [];
		released = 0;
		unavailable = undefined;
	});

	it('is a trigger with one output and nothing it refers to', () => {
		const registered = normalizeAutomationNodeType(card());

		expect(registered).toMatchObject({
			type: SUN_EVENT_NODE_TYPE,
			kind: 'trigger',
			ports: { inputs: [], outputs: ['out'] },
		});
		expect(registered.references({ event: 'sunset' })).toEqual([]);
	});

	it('is unavailable while the house location is not set', () => {
		const registered = normalizeAutomationNodeType(card());

		expect(registered.unavailableReason()).toBeUndefined();

		unavailable = 'The house location is not set.';

		expect(registered.unavailableReason()).toBe('The house location is not set.');
	});

	it('accepts an event, with or without an offset either way', async () => {
		expect(await problems({ event: 'sunrise' })).toEqual([]);
		expect(await problems({ event: 'sunset', offset_minutes: -30 })).toEqual([]);
		expect(await problems({ event: 'sunset', offset_minutes: 360 })).toEqual([]);
	});

	it.each([
		['no event', {}, 'event', 'The event must be sunrise or sunset.'],
		['an event that is not one', { event: 'noon' }, 'event', 'The event must be sunrise or sunset.'],
		['an offset in fractions of a minute', { event: 'sunrise', offset_minutes: 1.5 }, 'offset_minutes', OFFSET_REASON],
		['an offset too far before', { event: 'sunrise', offset_minutes: -361 }, 'offset_minutes', OFFSET_REASON],
		['an offset too far after', { event: 'sunrise', offset_minutes: 361 }, 'offset_minutes', OFFSET_REASON],
		['a location of its own', { event: 'sunrise', latitude: 50 }, 'latitude', 'This property is not allowed.'],
	])('refuses %s', async (_name, config, field, reason) => {
		expect(await problems(config)).toContainEqual({ field, reason });
	});

	it('subscribes to the event with its offset, passes on what fired and releases the subscription', () => {
		const fired: unknown[] = [];

		const release = card().subscribe({ event: 'sunset', offset_minutes: -15 }, (data) => fired.push(data));

		expect(subscriptions.map(({ spec }) => spec)).toEqual([{ event: 'sunset', offsetMinutes: -15 }]);

		subscriptions[0].fire({
			event: 'sunset',
			offset_minutes: -15,
			date: '2026-03-20',
			time: '18:13',
			timezone: 'Europe/Prague',
		});

		expect(fired).toEqual([
			{ event: 'sunset', offset_minutes: -15, date: '2026-03-20', time: '18:13', timezone: 'Europe/Prague' },
		]);

		release();

		expect(released).toBe(1);
	});

	it('fires at the event itself when no offset is set', () => {
		card().subscribe({ event: 'sunrise' }, () => undefined);

		expect(subscriptions[0].spec).toEqual({ event: 'sunrise', offsetMinutes: 0 });
	});
});
