import { normalizeAutomationNodeType } from '../../../modules/automations/graph/node-type';
import { OccupancyStatus } from '../occupancy/space-occupancy.types';
import { SPACES_HOME_CONTROL_PLUGIN_NAME } from '../spaces-home-control.constants';

import {
	SPACE_OCCUPANCY_CHANGED_NODE_TYPE,
	createSpaceOccupancyChangedNodeType,
} from './space-occupancy-changed.node-type';
import { SpaceOccupancyReading } from './space-occupancy-is.node-type';

const SPACE = '6f0c3a52-31a4-4a6f-9a77-2b1f00000001';
const OTHER_SPACE = '6f0c3a52-31a4-4a6f-9a77-2b1f00000002';

const flush = async (): Promise<void> => {
	for (let i = 0; i < 10; i++) await Promise.resolve();
};

describe('space.occupancy.changed', () => {
	let readings: Map<string, SpaceOccupancyReading | Error>;
	let listeners: Map<string, Set<() => void>>;
	let failures: unknown[];

	const card = () =>
		createSpaceOccupancyChangedNodeType(
			{
				occupancy: (spaceId) => {
					const reading = readings.get(spaceId) ?? new Error('Space not found');

					return reading instanceof Error ? Promise.reject(reading) : Promise.resolve(reading);
				},
				onOccupancyChanged: (spaceId, listener) => {
					const set = listeners.get(spaceId) ?? new Set();

					set.add(listener);
					listeners.set(spaceId, set);

					return () => set.delete(listener);
				},
			},
			(error) => failures.push(error),
		);

	const become = async (spaceId: string, reading: SpaceOccupancyReading | Error): Promise<void> => {
		readings.set(spaceId, reading);

		for (const listener of [...(listeners.get(spaceId) ?? [])]) listener();

		await flush();
	};

	const occupied: SpaceOccupancyReading = { status: OccupancyStatus.OCCUPIED, enabled: true };
	const vacant: SpaceOccupancyReading = { status: OccupancyStatus.VACANT, enabled: true };
	const unknown: SpaceOccupancyReading = { status: OccupancyStatus.UNKNOWN, enabled: true };

	beforeEach(() => {
		readings = new Map([[SPACE, occupied]]);
		listeners = new Map();
		failures = [];
	});

	it('is a trigger of the plugin that refers to its space', () => {
		const registered = normalizeAutomationNodeType(card());

		expect(registered).toMatchObject({
			type: SPACE_OCCUPANCY_CHANGED_NODE_TYPE,
			kind: 'trigger',
			ports: { inputs: [], outputs: ['out'] },
			owner: { kind: 'plugin', type: SPACES_HOME_CONTROL_PLUGIN_NAME },
		});
		expect(registered.references({ space_id: SPACE })).toEqual([{ kind: 'space', id: SPACE }]);
	});

	it('needs a space and takes an optional state to change to', async () => {
		expect(await card().validateConfig({ space_id: SPACE })).toEqual([]);
		expect(await card().validateConfig({ space_id: SPACE, to: 'vacant' })).toEqual([]);
		expect(await card().validateConfig({})).toEqual([
			{ field: 'space_id', reason: 'A room or a zone must be chosen.' },
		]);
		expect(await card().validateConfig({ space_id: SPACE, to: 'unknown' })).toEqual([
			{ field: 'to', reason: '"to" must be occupied or vacant.' },
		]);
	});

	it('starts on a change between occupied and vacant, not on the state it was armed in', async () => {
		const fire = jest.fn();

		card().subscribe({ space_id: SPACE }, fire);
		await flush();

		expect(fire).not.toHaveBeenCalled();

		await become(SPACE, vacant);
		await become(SPACE, vacant);
		await become(SPACE, occupied);

		expect(fire.mock.calls).toEqual([
			[{ space_id: SPACE, from: 'occupied', to: 'vacant' }],
			[{ space_id: SPACE, from: 'vacant', to: 'occupied' }],
		]);
	});

	it('starts only on a change into the state asked for', async () => {
		const fire = jest.fn();

		card().subscribe({ space_id: SPACE, to: OccupancyStatus.VACANT }, fire);
		await flush();

		await become(SPACE, vacant);
		await become(SPACE, occupied);

		expect(fire.mock.calls).toEqual([[{ space_id: SPACE, from: 'occupied', to: 'vacant' }]]);
	});

	it('takes unknown occupancy as no state: neither a baseline nor a change', async () => {
		const fire = jest.fn();

		readings.set(SPACE, unknown);
		card().subscribe({ space_id: SPACE }, fire);
		await flush();

		// The first known state after a start is the baseline
		await become(SPACE, vacant);
		// Vacant, unknown, vacant again is no transition
		await become(SPACE, unknown);
		await become(SPACE, vacant);
		// Neither is occupancy detection that was switched off
		await become(SPACE, { status: OccupancyStatus.OCCUPIED, enabled: false });

		expect(fire).not.toHaveBeenCalled();

		// Vacant, unknown, occupied is one
		await become(SPACE, unknown);
		await become(SPACE, occupied);

		expect(fire.mock.calls).toEqual([[{ space_id: SPACE, from: 'vacant', to: 'occupied' }]]);
	});

	it('takes a read that fails as no state and reports it', async () => {
		const fire = jest.fn();

		card().subscribe({ space_id: SPACE }, fire);
		await flush();
		await become(SPACE, new Error('Space not found'));
		await become(SPACE, occupied);

		expect(fire).not.toHaveBeenCalled();
		expect(failures).toEqual([new Error('Space not found')]);
	});

	it('follows only its own space', async () => {
		const fire = jest.fn();

		readings.set(OTHER_SPACE, occupied);
		card().subscribe({ space_id: SPACE }, fire);
		await flush();
		await become(OTHER_SPACE, vacant);

		expect(fire).not.toHaveBeenCalled();
	});

	it('stops listening when it is released', async () => {
		const fire = jest.fn();

		card().subscribe({ space_id: SPACE }, fire)();
		await flush();
		await become(SPACE, vacant);

		expect(fire).not.toHaveBeenCalled();
		expect(listeners.get(SPACE)?.size).toBe(0);
	});
});
