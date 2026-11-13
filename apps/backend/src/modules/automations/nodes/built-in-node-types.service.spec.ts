import { DataTypeType, PermissionType } from '../../devices/devices.constants';
import { ChannelPropertyEntity } from '../../devices/entities/devices.entity';
import { ChannelsPropertiesService } from '../../devices/services/channels.properties.service';
import { PropertyCommandService } from '../../devices/services/property-command.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { SceneExecutorService } from '../../scenes/services/scene-executor.service';
import {
	AutomationActionNodeType,
	AutomationNodeConfig,
	AutomationNodeType,
	normalizeAutomationNodeType,
} from '../graph/node-type';
import { AutomationSafetyService } from '../services/automation-safety.service';
import { AutomationStateTrackerService } from '../services/state-tracker.service';
import { AutomationTimeSourceService } from '../services/time-source.service';
import {
	CHANNEL_A,
	CHANNEL_B,
	DEVICE_A,
	PROPERTY_BOOL,
	PROPERTY_NUMBER,
	SCENE_ID,
	runContext,
	target,
} from '../testing/node-fixtures';

import { AutomationBuiltInNodeTypesService, toDevicePropertyInfo } from './built-in-node-types.service';

const property = (overrides: Record<string, unknown>): ChannelPropertyEntity =>
	({
		id: PROPERTY_BOOL,
		dataType: DataTypeType.BOOL,
		format: null,
		permissions: [PermissionType.READ_WRITE],
		channel: { id: CHANNEL_A, device: { id: DEVICE_A } },
		...overrides,
	}) as unknown as ChannelPropertyEntity;

describe('AutomationBuiltInNodeTypesService', () => {
	let findOne: jest.Mock;
	let executePropertyCommands: jest.Mock;
	let triggerScene: jest.Mock;
	let notify: jest.Mock;
	let sceneGuard: jest.Mock;
	let service: AutomationBuiltInNodeTypesService;

	const cardOf = <T extends AutomationNodeType<any>>(type: string): T =>
		service.create().find((item) => item.type === type) as T;

	beforeEach(() => {
		findOne = jest.fn(() => Promise.resolve(property({})));
		executePropertyCommands = jest.fn(() => Promise.resolve({ success: true, results: [{ success: true }] }));
		triggerScene = jest.fn(() => Promise.resolve({ status: 'completed', error: null }));
		notify = jest.fn(() => Promise.resolve({ id: 'notification-1' }));
		sceneGuard = jest.fn(() => Promise.resolve(null));

		service = new AutomationBuiltInNodeTypesService(
			{ watch: jest.fn(), read: jest.fn(), settled: jest.fn() } as unknown as AutomationStateTrackerService,
			{ onTimeOfDay: jest.fn(), houseNow: jest.fn() } as unknown as AutomationTimeSourceService,
			{ findOne } as unknown as ChannelsPropertiesService,
			{ executePropertyCommands } as unknown as PropertyCommandService,
			{ triggerScene } as unknown as SceneExecutorService,
			{ notify } as unknown as NotificationsService,
			{ sceneGuard } as unknown as AutomationSafetyService,
		);
	});

	it('builds every card of the module as a node type the registry takes', () => {
		const registered = service.create().map((nodeType) => normalizeAutomationNodeType(nodeType));

		expect(registered.map((item) => `${item.kind} ${item.type}`).sort()).toEqual([
			'action device.property.set',
			'action notification.send',
			'action scene.run',
			'condition device.property.compare',
			'condition sun.daylight',
			'condition time.window',
			'flow flow.all',
			'flow flow.any',
			'flow flow.delay',
			'flow flow.wait-until',
			'trigger device.property.changed',
			'trigger manual.start',
			'trigger sun.event',
			'trigger time.of-day',
		]);

		for (const item of registered) {
			// Cards of the module itself have no owner: they are always running
			expect(item.owner).toBeUndefined();
			expect(item.configSchema).toMatchObject({ type: 'object', additionalProperties: false });
			expect(item.name).not.toBe('');
			expect(item.description).not.toBe('');
		}
	});

	it('checks a device card against the property the devices module knows', async () => {
		findOne.mockResolvedValue(property({ id: PROPERTY_NUMBER, dataType: DataTypeType.BOOL }));

		const problems = await cardOf('device.property.changed').validateConfig({
			...target(PROPERTY_NUMBER),
			above: 5,
		} as AutomationNodeConfig);

		expect(findOne).toHaveBeenCalledWith(PROPERTY_NUMBER);
		expect(problems).toEqual([
			{ field: 'above', reason: '"above" can be used only with a property that holds a number.' },
		]);
	});

	it('hands the writes of the set action to the property command service', async () => {
		const card = cardOf<AutomationActionNodeType<any>>('device.property.set');

		expect(await card.execute({ writes: [{ ...target(PROPERTY_BOOL), value: true }] }, runContext())).toEqual({
			success: true,
		});
		// ... with the automation as the origin of the intent the write creates
		expect(executePropertyCommands).toHaveBeenCalledWith(
			[{ propertyId: PROPERTY_BOOL, value: true, requestedDeviceId: DEVICE_A, requestedChannelId: CHANNEL_A }],
			{ context: { origin: 'automation', extra: { automationId: 'automation-1' } } },
		);
	});

	it('hands the scene and the notification to their services', async () => {
		await cardOf<AutomationActionNodeType<any>>('scene.run').execute({ scene_id: SCENE_ID }, runContext());
		await cardOf<AutomationActionNodeType<any>>('notification.send').execute(
			{ severity: 'info', title: 'Hello' },
			runContext(),
		);

		// Every scene an automation runs is handed the safety guard, for the actions it is about to execute, and
		// the automation as the origin of its intent: the label alone would not reach the intent
		expect(triggerScene).toHaveBeenCalledWith(
			SCENE_ID,
			'automation',
			{ origin: 'automation', extra: { automationId: 'automation-1' } },
			{ guard: sceneGuard },
		);
		expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: 'Hello', severity: 'info' }));
	});

	it('says what the cards that act on the home will do, so the safety policy can judge them', () => {
		const registered = new Map(
			service.create().map((nodeType) => [nodeType.type, normalizeAutomationNodeType(nodeType)]),
		);

		expect(
			registered.get('device.property.set')?.commands({ writes: [{ ...target(PROPERTY_BOOL), value: true }] }),
		).toEqual([{ kind: 'property_write', propertyId: PROPERTY_BOOL, value: true, field: 'writes.0.value' }]);
		expect(registered.get('scene.run')?.commands({ scene_id: SCENE_ID })).toEqual([
			{ kind: 'scene_run', sceneId: SCENE_ID, field: 'scene_id' },
		]);
		expect(registered.get('notification.send')?.commands({ severity: 'info', title: 'Hello' })).toEqual([]);
	});

	describe('toDevicePropertyInfo', () => {
		it('reads the channel and the device from a loaded property', () => {
			expect(toDevicePropertyInfo(property({ format: ['a', 'b'] }))).toEqual({
				id: PROPERTY_BOOL,
				channelId: CHANNEL_A,
				deviceId: DEVICE_A,
				dataType: DataTypeType.BOOL,
				format: ['a', 'b'],
				invalid: null,
				step: null,
				permissions: [PermissionType.READ_WRITE],
			});
			expect(toDevicePropertyInfo(property({ format: [0, 100], invalid: 255, step: 5 }))).toMatchObject({
				format: [0, 100],
				invalid: 255,
				step: 5,
			});
		});

		it('takes a channel and a device given by id', () => {
			expect(toDevicePropertyInfo(property({ channel: { id: CHANNEL_B, device: DEVICE_A } }))).toMatchObject({
				channelId: CHANNEL_B,
				deviceId: DEVICE_A,
			});
			expect(toDevicePropertyInfo(property({ channel: CHANNEL_B }))).toMatchObject({
				channelId: CHANNEL_B,
				deviceId: null,
			});
		});

		it('knows nothing about a property without its channel, and assumes no permissions', () => {
			expect(toDevicePropertyInfo(property({ channel: undefined, permissions: undefined }))).toMatchObject({
				channelId: null,
				deviceId: null,
				permissions: [],
			});
		});
	});
});
