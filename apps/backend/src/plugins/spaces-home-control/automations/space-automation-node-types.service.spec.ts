import {
	AutomationActionNodeType,
	AutomationConditionNodeType,
	AutomationNodeConfig,
	AutomationTriggerNodeType,
	normalizeAutomationNodeType,
} from '../../../modules/automations/graph/node-type';
import { runContext } from '../../../modules/automations/testing/node-fixtures';
import { ActivityActivationStatus, ActivityMode } from '../activity/space-activity.constants';
import { SpaceActivityStateEntity } from '../entities/space-activity-state.entity';
import { OccupancyStatus } from '../occupancy/space-occupancy.types';
import { SpaceActivityConfigService } from '../services/space-activity-config.service';
import { SpaceIntentService } from '../services/space-intent.service';
import { SpaceModeService } from '../services/space-mode.service';
import { SpaceOccupancyService } from '../services/space-occupancy.service';
import { SPACES_HOME_CONTROL_PLUGIN_NAME } from '../spaces-home-control.constants';

import { SpaceAutomationEventsService } from './space-automation-events.service';
import { SpaceAutomationNodeTypesService, toSpaceModeReading } from './space-automation-node-types.service';

const SPACE = '6f0c3a52-31a4-4a6f-9a77-2b1f00000001';

const flush = async (): Promise<void> => {
	for (let i = 0; i < 10; i++) await Promise.resolve();
};

describe('SpaceAutomationNodeTypesService', () => {
	let events: SpaceAutomationEventsService;
	let occupancy: { stateFor: jest.Mock };
	let modes: { getActiveMode: jest.Mock; activateMode: jest.Mock };
	let activityConfigs: { get: jest.Mock };
	let spaceIntents: { executeLightingIntent: jest.Mock };
	let state: Partial<SpaceActivityStateEntity> | null;

	const create = () =>
		new SpaceAutomationNodeTypesService(
			events,
			occupancy as unknown as SpaceOccupancyService,
			modes as unknown as SpaceModeService,
			activityConfigs as unknown as SpaceActivityConfigService,
			spaceIntents as unknown as SpaceIntentService,
		).create();

	const card = <T>(type: string): T => create().find((nodeType) => nodeType.type === type) as unknown as T;

	beforeEach(() => {
		events = new SpaceAutomationEventsService();
		occupancy = { stateFor: jest.fn(() => Promise.resolve({ status: OccupancyStatus.OCCUPIED, enabled: true })) };
		state = {
			selectedActivityMode: ActivityMode.WORK,
			activityStatus: ActivityActivationStatus.ACTIVE,
			activationId: 'a-1',
			activityActor: 'user:1',
		};
		modes = {
			getActiveMode: jest.fn(() => Promise.resolve(state)),
			activateMode: jest.fn((_spaceId: string, mode: ActivityMode, _revision: number, actor: string) =>
				Promise.resolve({
					selectedActivityMode: mode,
					activityStatus: ActivityActivationStatus.ACTIVE,
					activationId: 'a-2',
					activityActor: actor,
				}),
			),
		};
		activityConfigs = { get: jest.fn(() => Promise.resolve({ activityEnabled: true, activityRevision: 4 })) };
		spaceIntents = {
			executeLightingIntent: jest.fn(() => Promise.resolve({ success: true, affectedDevices: 1, failedDevices: 0 })),
		};
	});

	it('builds the space cards, each owned by the plugin', () => {
		const nodeTypes = create().map((nodeType) => normalizeAutomationNodeType(nodeType));

		expect(nodeTypes.map((nodeType) => [nodeType.type, nodeType.kind])).toEqual([
			['space.occupancy.changed', 'trigger'],
			['space.mode.changed', 'trigger'],
			['space.occupancy.is', 'condition'],
			['space.mode.is', 'condition'],
			['space.mode.set', 'action'],
			['space.lighting.intent', 'action'],
		]);

		for (const nodeType of nodeTypes) {
			expect(nodeType.owner).toEqual({ kind: 'plugin', type: SPACES_HOME_CONTROL_PLUGIN_NAME });
		}
	});

	it('reads the qualified occupancy of the occupancy runtime', async () => {
		const condition = card<AutomationConditionNodeType<AutomationNodeConfig>>('space.occupancy.is');

		expect(await condition.evaluate({ space_id: SPACE, state: 'occupied' }, runContext())).toMatchObject({
			result: true,
		});
		expect(occupancy.stateFor).toHaveBeenCalledWith(SPACE);
	});

	it('follows the occupancy hints of the space', async () => {
		const trigger = card<AutomationTriggerNodeType<AutomationNodeConfig>>('space.occupancy.changed');
		const fire = jest.fn();

		trigger.subscribe({ space_id: SPACE }, fire);
		await flush();

		occupancy.stateFor.mockResolvedValue({ status: OccupancyStatus.VACANT, enabled: true });
		events.handleOccupancyChanged({ space_id: SPACE });
		await flush();

		expect(fire).toHaveBeenCalledWith({ space_id: SPACE, from: 'occupied', to: 'vacant' });
	});

	it('follows the activity hints of the space', async () => {
		const trigger = card<AutomationTriggerNodeType<AutomationNodeConfig>>('space.mode.changed');
		const fire = jest.fn();

		trigger.subscribe({ space_id: SPACE }, fire);
		await flush();

		state = { ...state, selectedActivityMode: ActivityMode.SLEEP, activationId: 'a-2' };
		events.handleActivityStateChanged({ space_id: SPACE });
		await flush();

		expect(fire).toHaveBeenCalledWith({ space_id: SPACE, from: ActivityMode.WORK, to: ActivityMode.SLEEP });
	});

	it('activates a mode through the automation source of the mode service', async () => {
		const action = card<AutomationActionNodeType<AutomationNodeConfig>>('space.mode.set');

		expect(await action.execute({ space_id: SPACE, mode: ActivityMode.SLEEP }, runContext())).toEqual({
			success: true,
		});
		expect(activityConfigs.get).toHaveBeenCalledWith(SPACE, ActivityMode.SLEEP);
		expect(modes.activateMode).toHaveBeenCalledWith(
			SPACE,
			ActivityMode.SLEEP,
			4,
			'automation:automation-1:run-1',
			undefined,
			undefined,
			{ previousActivationId: 'a-1', isCurrent: expect.any(Function) as unknown },
		);
	});

	it('sends a lighting intent through the space intent service', async () => {
		const action = card<AutomationActionNodeType<AutomationNodeConfig>>('space.lighting.intent');

		expect(await action.execute({ space_id: SPACE, intent: 'off' }, runContext())).toEqual({ success: true });
		expect(spaceIntents.executeLightingIntent).toHaveBeenCalledWith(
			SPACE,
			expect.objectContaining({ type: 'off' }),
			expect.objectContaining({ origin: 'automation' }),
		);
	});

	it('takes no activity row as no selection', () => {
		expect(toSpaceModeReading(null)).toEqual({ mode: null, status: null, activationId: null, actor: null });
	});
});
