import { EventEmitter2 } from '@nestjs/event-emitter';

import { LocalSceneActionEntity } from '../../../plugins/scenes-local/entities/scenes-local.entity';
import { LocalScenePlatform } from '../../../plugins/scenes-local/platforms/local-scene.platform';
import { SCENES_LOCAL_TYPE } from '../../../plugins/scenes-local/scenes-local.constants';
import { DEFAULT_TTL_SCENE, IntentEventType, IntentStatus } from '../../intents/intents.constants';
import { IntentsService } from '../../intents/services/intents.service';
import { SceneEntity } from '../../scenes/entities/scenes.entity';
import { SceneExecutorService } from '../../scenes/services/scene-executor.service';
import { DataTypeType, PermissionType } from '../devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../entities/devices.entity';
import { IDevicePropertyData } from '../platforms/device.platform';

import { CompositePropertyCommandRegistryService } from './composite-property-command.registry.service';
import { PropertyCommandDispatchService } from './property-command-dispatch.service';
import { PropertyCommandWindowService } from './property-command-window.service';
import { PropertyCommandService } from './property-command.service';

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const update = (id: string): IDevicePropertyData => {
	const device = Object.assign(new DeviceEntity(), { id: `device-${id}` });
	const channel = Object.assign(new ChannelEntity(), { id: `channel-${id}`, device });
	const property = Object.assign(new ChannelPropertyEntity(), {
		id,
		channel,
		dataType: DataTypeType.BOOL,
		permissions: [PermissionType.READ_WRITE],
	});
	channel.properties = [property];
	device.channels = [channel];
	return { device, channel, property, value: true };
};

describe('composite parent intent lifetime', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.setSystemTime(0);
	});
	afterEach(() => jest.useRealTimers());
	const lifetime = (path: 'property API' | 'local scene') => (path === 'local scene' ? DEFAULT_TTL_SCENE : 1000);
	const setup = (path: 'property API' | 'local scene', delay: number, planningDelay = 200) => {
		const events = new EventEmitter2();
		const completed = jest.fn();
		const expired = jest.fn();
		events.on(IntentEventType.COMPLETED, completed);
		events.on(IntentEventType.EXPIRED, expired);
		const history = jest.fn().mockResolvedValue(undefined);
		const intents = new IntentsService(events, { storeIntentCompletion: history } as never);
		intents.onModuleInit();
		const windows = new PropertyCommandWindowService();
		const group = update('group');
		const live = update('live');
		const silent = update('silent');
		const targets = [group, live, silent];
		let delayed = false;
		const metadata = {
			findOne: async (id: string) => {
				if (id === 'group' && intents.findActiveIntents({}).length && !delayed) {
					delayed = true;
					await wait(delay);
				}
				return targets.find((target) => target.property.id === id)?.property ?? null;
			},
		};
		const registry = new CompositePropertyCommandRegistryService();
		registry.register({
			canHandle: (property) => property.id === 'group',
			plan: async () => {
				await wait(planningDelay);
				return {
					revision: 1,
					children: [
						{ memberId: 'live', update: live },
						{ memberId: 'silent', update: silent },
					],
					isCurrent: () => Promise.resolve(true),
				};
			},
		});
		jest.spyOn(registry, 'estimateTimeoutMs').mockResolvedValue(lifetime(path));
		const post = jest.fn((updates: readonly IDevicePropertyData[], guard: () => boolean) => {
			if (!guard()) return Promise.resolve(false);
			if (updates[0].property.id === 'live') {
				const window = windows.get('live');
				windows.confirm(
					{ canonicalPropertyId: 'live', generation: window.generation },
					{ value: true, receivedAt: Date.now() },
				);
			}
			return Promise.resolve(true);
		});
		const platform = {
			prepareCompositeBatch: (updates: readonly IDevicePropertyData[]) =>
				Promise.resolve({
					updates,
					isCurrent: () => true,
					dispatch: (guard: () => boolean) => post(updates, guard),
				}),
		};
		const platforms = { get: () => platform, usesAuthoritativePropertyReadback: () => false };
		const devices = {
			findOne: (id: string) => Promise.resolve(targets.find((target) => target.device.id === id)?.device),
		};
		const channels = {
			findOne: (id: string) => Promise.resolve(targets.find((target) => target.channel.id === id)?.channel),
		};
		const dispatch = new PropertyCommandDispatchService(
			metadata as never,
			{ readLatest: () => Promise.resolve(null) } as never,
			channels as never,
			devices as never,
			platforms as never,
			{ resolve: (property: ChannelPropertyEntity) => property.id } as never,
			{ runShared: (operation: () => Promise<unknown>) => operation() } as never,
			{ run: (_id: string, operation: () => Promise<unknown>) => operation() } as never,
			windows,
			undefined,
			registry,
			events,
		);
		const commands = new PropertyCommandService(
			devices as never,
			channels as never,
			metadata as never,
			{} as never,
			platforms as never,
			intents,
			dispatch,
			windows,
			undefined,
			registry,
		);
		const action = Object.assign(new LocalSceneActionEntity(), {
			id: 'group-action',
			type: SCENES_LOCAL_TYPE,
			deviceId: group.device.id,
			channelId: group.channel.id,
			propertyId: group.property.id,
			value: true,
		});
		const scene = Object.assign(new SceneEntity(), { id: 'scene', actions: [action] });
		const local = new LocalScenePlatform(
			devices as never,
			channels as never,
			metadata as never,
			platforms as never,
			dispatch,
			{} as never,
			registry,
		);
		jest.spyOn(local, 'getCommandTtlMs').mockResolvedValue(lifetime(path));
		const scenes = new SceneExecutorService(
			{ getOneOrThrow: () => Promise.resolve(scene), updateLastTriggered: () => Promise.resolve() } as never,
			events,
			intents,
		);
		scenes.registerPlatform(local);
		return {
			completed,
			expired,
			history,
			post,
			windows,
			run: () =>
				path === 'property API'
					? commands.processApiPropertyCommand(group.device.id, group.channel.id, group.property.id, true)
					: scenes.triggerScene(scene.id),
			stop: () => {
				dispatch.onModuleDestroy();
				commands.onModuleDestroy();
				intents.onModuleDestroy();
			},
		};
	};
	it.each(['property API', 'local scene'] as const)(
		'records partial timeouts before cleanup after %s planning delay',
		async (path) => {
			const fixture = setup(path, lifetime(path) - 700);
			try {
				const execution = fixture.run();
				await jest.advanceTimersByTimeAsync(lifetime(path));
				await execution;
				expect(fixture.post).toHaveBeenCalledTimes(2);
				expect(fixture.expired).not.toHaveBeenCalled();
				expect(fixture.completed).toHaveBeenCalledTimes(1);
				expect(fixture.completed).toHaveBeenCalledWith(
					expect.objectContaining({
						status: IntentStatus.COMPLETED_PARTIAL,
						composites: [
							expect.objectContaining({
								status: 'partial',
								children: [
									expect.objectContaining({ status: 'confirmed' }),
									expect.objectContaining({ status: 'timed_out' }),
								],
							}),
						],
					}),
				);
				expect(fixture.history).toHaveBeenCalledTimes(1);
			} finally {
				fixture.stop();
			}
		},
	);
	it.each(['property API', 'local scene'] as const)(
		'keeps the absolute %s parent cap when dispatch planning exceeds the remaining lifetime',
		async (path) => {
			const fixture = setup(path, lifetime(path) - 700, 800);
			try {
				const execution = fixture.run();
				await jest.advanceTimersByTimeAsync(lifetime(path) + 1000);
				await execution;
				expect(fixture.post).not.toHaveBeenCalled();
				expect(fixture.windows.get('live')).toBeNull();
				expect(fixture.windows.get('silent')).toBeNull();
				expect(fixture.expired).not.toHaveBeenCalled();
				expect(fixture.completed).toHaveBeenCalledWith(
					expect.objectContaining({
						status: IntentStatus.COMPLETED_FAILED,
					}),
				);
			} finally {
				fixture.stop();
			}
		},
	);
	it.each(['property API', 'local scene'] as const)(
		'does not dispatch or open windows for an expired %s parent',
		async (path) => {
			const fixture = setup(path, lifetime(path) + 100);
			try {
				const execution = fixture.run();
				await jest.advanceTimersByTimeAsync(lifetime(path) + 1000);
				await execution;
				expect(fixture.expired).toHaveBeenCalledTimes(1);
				expect(fixture.post).not.toHaveBeenCalled();
				expect(fixture.windows.get('live')).toBeNull();
				expect(fixture.windows.get('silent')).toBeNull();
			} finally {
				fixture.stop();
			}
		},
	);
});
