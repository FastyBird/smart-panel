import { HouseMode } from '../../system/system.constants';
import { normalizeAutomationNodeType } from '../graph/node-type';

import { HouseModeChange } from './bus-events.types';
import { HOUSE_MODE_CHANGED_NODE_TYPE, createHouseModeChangedNodeType } from './house-mode-changed.node-type';

describe('house-mode.changed', () => {
	let listeners: Set<(change: HouseModeChange) => void>;

	const card = () =>
		createHouseModeChangedNodeType({
			onHouseModeChanged: (listener) => {
				listeners.add(listener);

				return () => listeners.delete(listener);
			},
		});

	const change = (from: string | null, to: string): void => {
		for (const listener of [...listeners]) listener({ from, to });
	};

	beforeEach(() => {
		listeners = new Set();
	});

	it('is a trigger with nothing it refers to', () => {
		const registered = normalizeAutomationNodeType(card());

		expect(registered).toMatchObject({ type: HOUSE_MODE_CHANGED_NODE_TYPE, kind: 'trigger' });
		expect(registered.references({ to: HouseMode.AWAY })).toEqual([]);
	});

	it('takes an optional mode to change to and from', async () => {
		expect(await card().validateConfig({})).toEqual([]);
		expect(await card().validateConfig({ to: HouseMode.AWAY, from: HouseMode.HOME })).toEqual([]);
		expect(await card().validateConfig({ to: 'vacation' })).toEqual([
			{ field: 'to', reason: '"to" must be one of home, away, night.' },
		]);
		expect(await card().validateConfig({ to: HouseMode.NIGHT, from: HouseMode.NIGHT })).toEqual([
			{ field: 'to', reason: 'The house mode can not change to the mode it changes from.' },
		]);
		expect(await card().validateConfig({ mode: HouseMode.NIGHT })).toEqual([
			{ field: 'mode', reason: 'This property is not allowed.' },
		]);
	});

	it('starts on any change of the house mode', () => {
		const fire = jest.fn();

		card().subscribe({}, fire);

		change(HouseMode.HOME, HouseMode.AWAY);
		change(HouseMode.AWAY, HouseMode.AWAY);
		change(null, HouseMode.NIGHT);

		expect(fire.mock.calls).toEqual([
			[{ from: HouseMode.HOME, to: HouseMode.AWAY }],
			[{ from: null, to: HouseMode.NIGHT }],
		]);
	});

	it('starts only on a change into and out of the modes asked for', () => {
		const fire = jest.fn();

		card().subscribe({ to: HouseMode.HOME, from: HouseMode.AWAY }, fire);

		change(HouseMode.NIGHT, HouseMode.HOME);
		change(HouseMode.HOME, HouseMode.AWAY);
		change(HouseMode.AWAY, HouseMode.HOME);

		expect(fire.mock.calls).toEqual([[{ from: HouseMode.AWAY, to: HouseMode.HOME }]]);
	});

	it('stops listening when it is released', () => {
		const fire = jest.fn();

		card().subscribe({}, fire)();
		change(HouseMode.HOME, HouseMode.AWAY);

		expect(fire).not.toHaveBeenCalled();
	});
});
