import { AutomationRunContext, normalizeAutomationNodeType } from '../graph/node-type';
import { HouseTimeReading } from '../time/house-time';
import { HouseLocationReading } from '../time/sun';

import { SUN_DAYLIGHT_NODE_TYPE, createSunDaylightNodeType } from './sun-daylight.node-type';

const PRAGUE = { latitude: 50.0755, longitude: 14.4378 };
const TROMSO = { latitude: 69.65, longitude: 18.95 };

describe('sun.daylight', () => {
	let now: HouseTimeReading;
	let location: HouseLocationReading;

	const at = (iso: string): HouseTimeReading => ({
		status: 'ok',
		instant: Date.parse(iso),
		timezone: 'Europe/Prague',
		local: { date: iso.slice(0, 10), weekday: 0, minutes: 0, offsetMinutes: 60 },
	});

	const card = () =>
		createSunDaylightNodeType({
			houseNow: () => now,
			houseLocation: () => location,
			sunUnavailableReason: () => (location.status === 'ok' ? undefined : location.reason),
		});

	const evaluate = (state: string) => card().evaluate({ state } as never, {} as AutomationRunContext);

	beforeEach(() => {
		now = at('2026-03-20T12:00:00Z');
		location = { status: 'ok', location: PRAGUE };
	});

	it('is a condition with a yes and a no output', () => {
		expect(normalizeAutomationNodeType(card())).toMatchObject({
			type: SUN_DAYLIGHT_NODE_TYPE,
			kind: 'condition',
			ports: { inputs: ['in'], outputs: ['yes', 'no'] },
		});
	});

	it('accepts day or night and nothing else', async () => {
		expect(await card().validateConfig({ state: 'day' })).toEqual([]);
		expect(await card().validateConfig({ state: 'night' })).toEqual([]);
		expect(await card().validateConfig({ state: 'dusk' })).toEqual([
			{ field: 'state', reason: 'The state must be day or night.' },
		]);
	});

	it('answers yes for day while the sun is up and for night after sunset', async () => {
		await expect(evaluate('day')).resolves.toMatchObject({ result: true, observed: { state: 'day' } });
		await expect(evaluate('night')).resolves.toMatchObject({ result: false, observed: { state: 'day' } });

		now = at('2026-03-20T20:00:00Z');

		await expect(evaluate('day')).resolves.toMatchObject({ result: false, observed: { state: 'night' } });
		await expect(evaluate('night')).resolves.toMatchObject({ result: true, observed: { state: 'night' } });
	});

	it('counts a polar day as day and a polar night as night, at midnight and at noon', async () => {
		location = { status: 'ok', location: TROMSO };

		for (const iso of ['2026-06-21T00:00:00Z', '2026-06-21T12:00:00Z']) {
			now = at(iso);
			await expect(evaluate('day')).resolves.toMatchObject({ result: true });
		}

		for (const iso of ['2026-12-21T00:00:00Z', '2026-12-21T11:00:00Z']) {
			now = at(iso);
			await expect(evaluate('night')).resolves.toMatchObject({ result: true });
		}
	});

	it('answers no with the reason while the house location is not set, for day and for night', async () => {
		location = { status: 'not_set', reason: 'The house location is not set.' };

		expect(normalizeAutomationNodeType(card()).unavailableReason()).toBe('The house location is not set.');
		await expect(evaluate('day')).resolves.toEqual({ result: false, reason: 'The house location is not set.' });
		await expect(evaluate('night')).resolves.toEqual({ result: false, reason: 'The house location is not set.' });
	});

	it('answers no with the reason while the system clock is not set', async () => {
		now = { status: 'clock_not_trusted', reason: 'The system clock is not set yet.' };

		await expect(evaluate('night')).resolves.toEqual({ result: false, reason: 'The system clock is not set yet.' });
	});
});
