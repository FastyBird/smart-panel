import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../devices/devices.constants';
import { ChannelPropertyEntity } from '../../devices/entities/devices.entity';
import { ChannelsPropertiesService } from '../../devices/services/channels.properties.service';
import { SceneActionEntity, SceneEntity } from '../../scenes/entities/scenes.entity';
import { SceneExecutorService } from '../../scenes/services/scene-executor.service';
import { RegisteredAutomationNodeType } from '../graph/node-type';
import { createDevicePropertySetNodeType } from '../nodes/device-property-set.node-type';
import { manualStartNodeType } from '../nodes/manual-start.node-type';
import { createSceneRunNodeType } from '../nodes/scene-run.node-type';
import { describeSceneSafetyRefusal } from '../safety/action-safety-policy';
import { CHANNEL_A, DEVICE_A, SCENE_ID } from '../testing/node-fixtures';

import { AutomationSafetyService, toSafetySceneAction, toSafetyWriteTarget } from './automation-safety.service';
import { AutomationNodeTypeRegistryService } from './node-type-registry.service';

const LOCK = '0d9f0a3e-6f5c-4d7e-9a43-1f1f0c00a001';
const ALARM = '0d9f0a3e-6f5c-4d7e-9a43-1f1f0c00a002';
const DOOR = '0d9f0a3e-6f5c-4d7e-9a43-1f1f0c00a003';
const LIGHT = '0d9f0a3e-6f5c-4d7e-9a43-1f1f0c00a004';

const property = (id: string, device: string, channel: string, category: string): ChannelPropertyEntity =>
	({
		id,
		category,
		channel: { id: CHANNEL_A, category: channel, device: { id: DEVICE_A, category: device } },
	}) as unknown as ChannelPropertyEntity;

const PROPERTIES: Record<string, ChannelPropertyEntity> = {
	[LOCK]: property(LOCK, DeviceCategory.LOCK, ChannelCategory.LOCK, PropertyCategory.STATUS),
	[ALARM]: property(ALARM, DeviceCategory.ALARM, ChannelCategory.ALARM, PropertyCategory.STATE),
	[DOOR]: property(DOOR, DeviceCategory.DOOR, ChannelCategory.DOOR, PropertyCategory.POSITION),
	[LIGHT]: property(LIGHT, DeviceCategory.LIGHTING, ChannelCategory.LIGHT, PropertyCategory.ON),
};

/** An action of the local scenes plugin: the property and the value are columns of the action */
const localAction = (propertyId: string, value: unknown): SceneActionEntity =>
	({
		id: `action-${propertyId}`,
		type: 'local',
		enabled: true,
		order: 0,
		configuration: {},
		deviceId: DEVICE_A,
		channelId: CHANNEL_A,
		propertyId,
		value,
	}) as unknown as SceneActionEntity;

const writeOf = (propertyId: string, value: unknown) => ({
	device_id: DEVICE_A,
	channel_id: CHANNEL_A,
	property_id: propertyId,
	value,
});

describe('AutomationSafetyService', () => {
	let findOne: jest.Mock;
	let findEnabledActions: jest.Mock;
	let sceneActions: SceneActionEntity[] | null;
	let registry: AutomationNodeTypeRegistryService;
	let service: AutomationSafetyService;

	const registered = (type: string): RegisteredAutomationNodeType => {
		const nodeType = registry.lookup(type);

		if (!nodeType) throw new Error(`${type} is not registered`);

		return nodeType;
	};

	const request = (type: string, config: Record<string, unknown>) => ({
		automationId: 'automation-1',
		nodeId: 'node-1',
		type,
		config,
	});

	beforeEach(() => {
		sceneActions = [];
		findOne = jest.fn((id: string) => Promise.resolve(PROPERTIES[id] ?? null));
		findEnabledActions = jest.fn(() => Promise.resolve(sceneActions));

		registry = new AutomationNodeTypeRegistryService();
		registry.register(manualStartNodeType);
		registry.register(
			createDevicePropertySetNodeType({
				commands: { executePropertyCommands: jest.fn() },
				findProperty: () => Promise.resolve(null),
			}),
		);
		registry.register(createSceneRunNodeType({ triggerScene: jest.fn() }));

		service = new AutomationSafetyService(
			registry,
			{ findOne } as unknown as ChannelsPropertiesService,
			{ findEnabledActions } as unknown as SceneExecutorService,
		);
	});

	describe('checkAction', () => {
		it.each([
			['unlocking a lock', LOCK, 'unlocked', 'An automation can not unlock a lock.'],
			['disarming the alarm', ALARM, 'disarmed', 'An automation can not disarm the alarm.'],
			['opening a door', DOOR, 'open', 'An automation can not open a door, garage or gate.'],
		])('refuses %s', async (_name, propertyId, value, reason) => {
			expect(
				await service.checkAction(request('device.property.set', { writes: [writeOf(propertyId, value)] })),
			).toEqual({ allow: false, reason });
		});

		it.each([
			['locking', LOCK, 'locked'],
			['arming', ALARM, 'armed_away'],
			['closing', DOOR, 'close'],
			['switching a light', LIGHT, false],
		])('allows %s', async (_name, propertyId, value) => {
			expect(
				await service.checkAction(request('device.property.set', { writes: [writeOf(propertyId, value)] })),
			).toEqual({ allow: true });
		});

		it('refuses the whole action when one of its writes reduces safety', async () => {
			const verdict = await service.checkAction(
				request('device.property.set', {
					writes: [writeOf(LIGHT, true), writeOf(DOOR, 'open'), writeOf(LOCK, 'unlocked')],
				}),
			);

			expect(verdict).toEqual({
				allow: false,
				reason: 'An automation can not open a door, garage or gate. An automation can not unlock a lock.',
			});
		});

		it('refuses a scene that would reduce safety as it is now, and allows it once it no longer does', async () => {
			sceneActions = [localAction(LIGHT, true), localAction(LOCK, 'unlocked')];

			expect(await service.checkAction(request('scene.run', { scene_id: SCENE_ID }))).toEqual({
				allow: false,
				reason: describeSceneSafetyRefusal('unlock a lock'),
			});
			expect(findEnabledActions).toHaveBeenCalledWith(SCENE_ID);

			sceneActions = [localAction(LIGHT, true), localAction(LOCK, 'locked')];

			expect(await service.checkAction(request('scene.run', { scene_id: SCENE_ID }))).toEqual({ allow: true });
		});

		it('refuses a scene with an action it can not read', async () => {
			sceneActions = [{ id: 'a', type: 'cloud', enabled: true, configuration: {} } as unknown as SceneActionEntity];

			expect((await service.checkAction(request('scene.run', { scene_id: SCENE_ID }))).allow).toBe(false);
		});

		it('allows an action that does nothing to the home, and a scene that is gone', async () => {
			registry.register({
				type: 'test.quiet',
				kind: 'action',
				name: 'Quiet',
				description: 'Declares nothing.',
				validateConfig: () => [],
			});
			sceneActions = null;

			expect(await service.checkAction(request('test.quiet', {}))).toEqual({ allow: true });
			expect(await service.checkAction(request('scene.run', { scene_id: SCENE_ID }))).toEqual({ allow: true });
		});

		it('refuses an action of a type that is not registered', async () => {
			expect((await service.checkAction(request('test.unknown', {}))).allow).toBe(false);
		});

		it('rejects when it could not look, so the engine refuses', async () => {
			findOne.mockRejectedValue(new Error('database is locked'));

			await expect(
				service.checkAction(request('device.property.set', { writes: [writeOf(LIGHT, true)] })),
			).rejects.toThrow('database is locked');
		});
	});

	describe('checkGraph', () => {
		it('reports a write that reduces safety as an error on its field', async () => {
			expect(
				await service.checkGraph(registered('device.property.set'), {
					writes: [writeOf(LIGHT, true), writeOf(ALARM, 'disarmed')],
				}),
			).toEqual([{ severity: 'error', message: 'An automation can not disarm the alarm.', field: 'writes.1.value' }]);
		});

		it('finds nothing in arming, locking and closing', async () => {
			expect(
				await service.checkGraph(registered('device.property.set'), {
					writes: [writeOf(ALARM, 'armed_home'), writeOf(LOCK, 'locked'), writeOf(DOOR, 'close')],
				}),
			).toEqual([]);
		});

		it('reports a scene that would reduce safety as a warning: it is judged again when it is run', async () => {
			sceneActions = [localAction(DOOR, 'open')];

			const findings = await service.checkGraph(registered('scene.run'), { scene_id: SCENE_ID });

			expect(findings).toEqual([
				{
					severity: 'warning',
					message: expect.stringContaining('it would open a door, garage or gate') as string,
					field: 'scene_id',
				},
			]);
		});

		it('survives a configuration that is not finished', async () => {
			expect(await service.checkGraph(registered('device.property.set'), {})).toEqual([]);
			expect(await service.checkGraph(registered('device.property.set'), { writes: [null, { value: 1 }] })).toEqual([]);
			expect(await service.checkGraph(registered('scene.run'), {})).toEqual([]);
			expect(await service.checkGraph(registered('manual.start'), {})).toEqual([]);
		});
	});

	describe('sceneGuard', () => {
		const scene = { id: SCENE_ID } as SceneEntity;

		it('refuses the actions a run is about to execute when one of them reduces safety', async () => {
			expect(await service.sceneGuard(scene, [localAction(LIGHT, true), localAction(ALARM, 'disarmed')])).toBe(
				describeSceneSafetyRefusal('disarm the alarm'),
			);
		});

		it('lets a harmless scene run', async () => {
			expect(await service.sceneGuard(scene, [localAction(LIGHT, true), localAction(ALARM, 'armed_away')])).toBeNull();
			expect(await service.sceneGuard(scene, [])).toBeNull();
		});

		it('does not read the scene again: it judges what it was handed', async () => {
			await service.sceneGuard(scene, [localAction(LOCK, 'unlocked')]);

			expect(findEnabledActions).not.toHaveBeenCalled();
		});
	});

	describe('reading the application', () => {
		it('reads the categories of a property, its channel and its device', () => {
			expect(toSafetyWriteTarget(PROPERTIES[LOCK])).toEqual({
				deviceCategory: DeviceCategory.LOCK,
				channelCategory: ChannelCategory.LOCK,
				propertyCategory: PropertyCategory.STATUS,
			});
		});

		it('leaves out what was not loaded', () => {
			expect(
				toSafetyWriteTarget({ id: LOCK, category: 'status', channel: CHANNEL_A } as unknown as ChannelPropertyEntity),
			).toEqual({ deviceCategory: null, channelCategory: null, propertyCategory: 'status' });
		});

		it('reads what a scene action writes from its columns or from its configuration', () => {
			expect(toSafetySceneAction(localAction(LOCK, 'unlocked'))).toEqual({ propertyId: LOCK, value: 'unlocked' });
			expect(
				toSafetySceneAction({
					type: 'other',
					configuration: { property_id: DOOR, value: 'open' },
				} as unknown as SceneActionEntity),
			).toEqual({ propertyId: DOOR, value: 'open' });
			expect(toSafetySceneAction({ type: 'other', configuration: {} } as unknown as SceneActionEntity)).toEqual({
				propertyId: null,
				value: undefined,
			});
		});
	});
});
