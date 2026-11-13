import { normalizeAutomationNodeType } from '../../../modules/automations/graph/node-type';
import { runContext } from '../../../modules/automations/testing/node-fixtures';
import { OccupancyStatus } from '../occupancy/space-occupancy.types';
import { SPACES_HOME_CONTROL_PLUGIN_NAME } from '../spaces-home-control.constants';

import {
	SPACE_OCCUPANCY_IS_NODE_TYPE,
	SpaceOccupancyReading,
	createSpaceOccupancyIsNodeType,
} from './space-occupancy-is.node-type';

const SPACE = '6f0c3a52-31a4-4a6f-9a77-2b1f00000001';

describe('space.occupancy.is', () => {
	let reading: SpaceOccupancyReading | Error;

	const card = () =>
		createSpaceOccupancyIsNodeType({
			occupancy: () => (reading instanceof Error ? Promise.reject(reading) : Promise.resolve(reading)),
		});

	beforeEach(() => {
		reading = { status: OccupancyStatus.OCCUPIED, enabled: true };
	});

	it('is a condition of the plugin that refers to its space', () => {
		const registered = normalizeAutomationNodeType(card());

		expect(registered).toMatchObject({
			type: SPACE_OCCUPANCY_IS_NODE_TYPE,
			kind: 'condition',
			ports: { inputs: ['in'], outputs: ['yes', 'no'] },
			owner: { kind: 'plugin', type: SPACES_HOME_CONTROL_PLUGIN_NAME },
		});
		expect(registered.references({ space_id: SPACE, state: 'occupied' })).toEqual([{ kind: 'space', id: SPACE }]);
	});

	it('needs a space and occupied or vacant', async () => {
		expect(await card().validateConfig({ space_id: SPACE, state: 'occupied' })).toEqual([]);
		expect(await card().validateConfig({ space_id: SPACE, state: 'vacant' })).toEqual([]);
		expect(await card().validateConfig({ state: 'occupied' })).toEqual([
			{ field: 'space_id', reason: 'A room or a zone must be chosen.' },
		]);
		expect(await card().validateConfig({ space_id: SPACE, state: 'unknown' })).toEqual([
			{ field: 'state', reason: 'The occupancy must be occupied or vacant.' },
		]);
		expect(await card().validateConfig({ space_id: SPACE, state: 'occupied', sensor: 'x' })).toEqual([
			{ field: 'sensor', reason: 'This property is not allowed.' },
		]);
	});

	it('answers whether the qualified occupancy is the one asked for', async () => {
		expect(await card().evaluate({ space_id: SPACE, state: OccupancyStatus.OCCUPIED }, runContext())).toEqual({
			result: true,
			observed: OccupancyStatus.OCCUPIED,
		});
		expect(await card().evaluate({ space_id: SPACE, state: OccupancyStatus.VACANT }, runContext())).toEqual({
			result: false,
			observed: OccupancyStatus.OCCUPIED,
		});
	});

	it('evaluates unknown occupancy to no, whichever state is asked for', async () => {
		reading = { status: OccupancyStatus.UNKNOWN, enabled: true };

		for (const state of [OccupancyStatus.OCCUPIED, OccupancyStatus.VACANT] as const) {
			expect(await card().evaluate({ space_id: SPACE, state }, runContext())).toEqual({
				result: false,
				observed: OccupancyStatus.UNKNOWN,
				reason: 'The occupancy of the space is not known.',
			});
		}
	});

	it('evaluates to no while occupancy detection is disabled', async () => {
		reading = { status: OccupancyStatus.VACANT, enabled: false };

		expect(await card().evaluate({ space_id: SPACE, state: OccupancyStatus.VACANT }, runContext())).toEqual({
			result: false,
			observed: null,
			reason: 'Occupancy detection is not enabled for the space.',
		});
	});

	it('evaluates to no when the occupancy can not be read', async () => {
		reading = new Error('Activity modes support rooms and zones only');

		expect(await card().evaluate({ space_id: SPACE, state: OccupancyStatus.OCCUPIED }, runContext())).toEqual({
			result: false,
			reason: 'The occupancy of the space could not be read: Activity modes support rooms and zones only',
		});
	});
});
