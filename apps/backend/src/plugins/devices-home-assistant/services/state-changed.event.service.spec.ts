/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Test, TestingModule } from '@nestjs/testing';

import { toInstance } from '../../../common/utils/transform.utils';
import {
	ChannelCategory,
	DataTypeType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelInputOccurrencesService } from '../../../modules/devices/services/channel-input-occurrences.service';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { HomeAssistantStateChangedEventDto } from '../dto/home-assistant-state.dto';
import { UpdateHomeAssistantChannelPropertyDto } from '../dto/update-channel-property.dto';
import {
	HomeAssistantChannelEntity,
	HomeAssistantChannelPropertyEntity,
	HomeAssistantDeviceEntity,
} from '../entities/devices-home-assistant.entity';
import { MapperService } from '../mappers/mapper.service';
import { TransformerRegistry } from '../mappings/transformers/transformer.registry';
import { HomeAssistantDiscoveredDeviceModel } from '../models/home-assistant.model';

import { HomeAssistantHttpService } from './home-assistant.http.service';
import { StateChangedEventService } from './state-changed.event.service';
import { VirtualPropertyService } from './virtual-property.service';

function gate() {
	let release: () => void;
	const promise = new Promise<void>((resolve) => {
		release = resolve;
	});
	return { promise, release: () => release() };
}

describe('StateChangedEventService', () => {
	let module: TestingModule | undefined;
	let service: StateChangedEventService;
	let devicesService: jest.Mocked<DevicesService>;
	let channelsService: jest.Mocked<ChannelsService>;
	let channelsPropertiesService: jest.Mocked<ChannelsPropertiesService>;
	let mapperService: jest.Mocked<MapperService>;
	let httpService: jest.Mocked<HomeAssistantHttpService>;
	let inputOccurrencesService: jest.Mocked<ChannelInputOccurrencesService>;
	let virtualPropertyService: jest.Mocked<VirtualPropertyService>;

	beforeEach(async () => {
		module = await Test.createTestingModule({
			providers: [
				StateChangedEventService,
				{ provide: DevicesService, useValue: { findAll: jest.fn() } },
				{ provide: ChannelsService, useValue: { findOne: jest.fn(), findAll: jest.fn().mockResolvedValue([]) } },
				{
					provide: ChannelsPropertiesService,
					useValue: { findAll: jest.fn(), update: jest.fn(), reportSample: jest.fn() },
				},
				{ provide: MapperService, useValue: { mapFromHA: jest.fn() } },
				{ provide: HomeAssistantHttpService, useValue: { getDiscoveredDevices: jest.fn() } },
				{
					provide: VirtualPropertyService,
					useValue: {
						getVirtualPropertiesForChannel: jest.fn().mockReturnValue([]),
						resolveVirtualPropertyValue: jest.fn(),
					},
				},
				{
					provide: ChannelInputOccurrencesService,
					useValue: { publishOccurrence: jest.fn().mockResolvedValue({}) },
				},
				{
					provide: TransformerRegistry,
					useValue: {
						getOrCreate: jest.fn().mockReturnValue({
							canRead: () => true,
							canWrite: () => true,
							read: (value: unknown) => value,
							write: (value: unknown) => value,
						}),
					},
				},
			],
		}).compile();

		service = module.get(StateChangedEventService);
		devicesService = module.get(DevicesService);
		channelsService = module.get(ChannelsService);
		channelsPropertiesService = module.get(ChannelsPropertiesService);
		mapperService = module.get(MapperService);
		httpService = module.get(HomeAssistantHttpService);
		inputOccurrencesService = module.get(ChannelInputOccurrencesService);
		virtualPropertyService = module.get(VirtualPropertyService);

		jest.useFakeTimers();
	});

	afterEach(async () => {
		const moduleToClose = module;
		module = undefined;
		await moduleToClose?.close();
		jest.useRealTimers();
		jest.clearAllMocks();
	});

	test('should skip if no mappings are initialized and fetch fails', async () => {
		httpService.getDiscoveredDevices.mockResolvedValue([]);
		devicesService.findAll.mockResolvedValue([]);
		channelsPropertiesService.findAll.mockResolvedValue([]);

		const event = {
			data: {
				new_state: {
					entity_id: 'sensor.temp',
				},
			},
		} as unknown as HomeAssistantStateChangedEventDto;

		await service.handle(event);
		await jest.runAllTimersAsync();
		expect(httpService.getDiscoveredDevices).not.toHaveBeenCalled();
		expect(mapperService.mapFromHA).not.toHaveBeenCalled();
	});

	describe('physical switch and temperature reports', () => {
		const context = { id: 'original-event', user_id: null, parent_id: null };
		const at = new Date('2026-05-08T12:00:00Z');
		const event = (entity: string, previous: string, next: string, attributes: Record<string, unknown> = {}) =>
			({
				context,
				data: {
					old_state: { entity_id: entity, state: previous, attributes, last_changed: new Date(at.getTime() - 60_000) },
					new_state: { entity_id: entity, state: next, context, last_changed: at, attributes },
				},
			}) as unknown as HomeAssistantStateChangedEventDto;
		const ingress = () => ({
			session: 'server:socket:1',
			receivedAt: new Date(at.getTime() + 2_000),
			ingressSequence: 12,
			isCurrent: jest.fn(() => true),
		});
		const arrange = (entity: string, value: boolean | number, category = PropertyCategory.ON) => {
			httpService.getDiscoveredDevices.mockResolvedValue([
				{ id: 'original-device', entities: [entity] } as HomeAssistantDiscoveredDeviceModel,
			]);
			devicesService.findAll.mockResolvedValue([
				{ id: 'panel-device', enabled: true, haDeviceId: 'original-device' } as HomeAssistantDeviceEntity,
			]);
			mapperService.mapFromHA.mockResolvedValue([
				[
					{
						property: {
							id: 'property',
							haEntityId: entity,
							haAttribute: 'fb.main_state',
							category,
						} as HomeAssistantChannelPropertyEntity,
						value,
					},
				],
			]);
		};

		describe('concurrent state changes', () => {
			const heater = 'switch.heater';
			let tick: number;
			const lastChange = new Map<string, Date>();
			beforeEach(() => {
				tick = 0;
				lastChange.clear();
			});
			const change = (entity: string, previous: string, next: string, revision: string) => {
				const request = event(entity, previous, next, { revision });
				const previousChange = lastChange.get(entity) ?? new Date(at.getTime() - 60_000);
				request.data.old_state.last_changed = previousChange;
				request.data.new_state.last_changed = previous === next ? previousChange : new Date(at.getTime() + tick++);
				lastChange.set(entity, request.data.new_state.last_changed);
				return request;
			};
			const transition = (revision: string, on: boolean, entity = heater) =>
				change(entity, on ? 'off' : 'on', on ? 'on' : 'off', revision);
			const presentation = (revision: string, state: string) => change(heater, state, state, revision);
			const writes = () => channelsPropertiesService.update.mock.calls.map(([id, update]) => [id, update.value]);
			const samples = () =>
				channelsPropertiesService.reportSample.mock.calls.map(([id, update, source]) => [
					id,
					update.value,
					source.ingressSequence,
				]);

			const setup = (beforeMapping: (revision: string) => Promise<void>, entities = [heater]) => {
				httpService.getDiscoveredDevices.mockResolvedValue([
					{ id: 'ha-device', entities } as HomeAssistantDiscoveredDeviceModel,
				]);
				devicesService.findAll.mockResolvedValue([
					{ id: 'device', haDeviceId: 'ha-device', enabled: true } as HomeAssistantDeviceEntity,
				]);
				const channels = entities.map(
					(id) => ({ id, category: ChannelCategory.SWITCHER }) as HomeAssistantChannelEntity,
				);
				const properties = entities.flatMap((entity) =>
					[
						{ id: entity, category: PropertyCategory.ON, haAttribute: 'fb.main_state' },
						{ id: entity + '/attribute', category: PropertyCategory.FAULT_DESCRIPTION, haAttribute: 'revision' },
						{ id: entity + '/virtual', category: PropertyCategory.STATUS, haAttribute: 'fb.virtual.status' },
					].map(
						(property) => ({ ...property, channel: entity, haEntityId: entity }) as HomeAssistantChannelPropertyEntity,
					),
				);
				channelsService.findAll.mockResolvedValue(channels);
				channelsPropertiesService.findAll.mockResolvedValue(properties);
				virtualPropertyService.getVirtualPropertiesForChannel.mockReturnValue([
					{
						propertyCategory: PropertyCategory.STATUS,
						virtualType: 'derived',
						dataType: DataTypeType.STRING,
						permissions: [PermissionType.READ_ONLY],
					},
				]);
				virtualPropertyService.resolveVirtualPropertyValue.mockImplementation((definition, context) => ({
					...definition,
					category: definition.propertyCategory,
					value: context.state.attributes.revision as string,
					isVirtual: true,
				}));
				const mapped: string[] = [];
				mapperService.mapFromHA.mockImplementation(async (_, [state]) => {
					const revision = state.attributes.revision as string;
					mapped.push(revision);
					await beforeMapping(revision);
					return [
						[
							{ property: properties.find((property) => property.id === state.entity_id), value: state.state === 'on' },
							{
								property: properties.find((property) => property.id === state.entity_id + '/attribute'),
								value: revision,
							},
						],
					];
				});
				return { mapped, channels };
			};

			it('waits for a submitted virtual write before applying the newer transition', async () => {
				const virtualStarted = gate();
				const allowVirtualWrite = gate();
				const { mapped } = setup(() => Promise.resolve());
				channelsPropertiesService.update.mockImplementation(async (id, update) => {
					if (id === heater + '/virtual' && update.value === 'first') {
						virtualStarted.release();
						await allowVirtualWrite.promise;
					}
					return { id } as HomeAssistantChannelPropertyEntity;
				});
				const first = service.handle(transition('first', true), ingress());
				await virtualStarted.promise;
				const previous = channelsPropertiesService.reportSample.mock.calls[0][2].sourceIsCurrent;
				const qualifiedBeforeTransition = previous();
				const second = service.handle(transition('second', false), { ...ingress(), ingressSequence: 13 });
				const stillQualified = previous();
				await jest.advanceTimersByTimeAsync(0);
				const whileWritingVirtual = [...mapped];
				allowVirtualWrite.release();
				await Promise.all([first, second]);

				expect(qualifiedBeforeTransition).toBe(true);
				expect(stillQualified).toBe(false);
				expect(whileWritingVirtual).toEqual(['first']);
				expect(samples()).toEqual([
					[heater, true, 12],
					[heater, false, 13],
				]);
				expect(writes()).toEqual([
					[heater + '/attribute', 'first'],
					[heater + '/virtual', 'first'],
					[heater + '/attribute', 'second'],
					[heater + '/virtual', 'second'],
				]);
			});

			it('supersedes debounced presentations even after the timer fired behind a pending transition', async () => {
				const mappingStarted = gate();
				const allowMapping = gate();
				const { mapped } = setup(async (revision) => {
					if (revision === 'first') {
						mappingStarted.release();
						await allowMapping.promise;
					}
				});
				const first = service.handle(transition('first', true), ingress());
				await mappingStarted.promise;
				await service.handle(presentation('superseded by transition', 'on'), ingress());
				await jest.advanceTimersByTimeAsync(500);
				const second = service.handle(transition('second', false), { ...ingress(), ingressSequence: 13 });
				await service.handle(presentation('superseded by same state', 'off'), ingress());
				await service.handle(presentation('latest attributes', 'off'), ingress());
				allowMapping.release();
				await Promise.all([first, second]);
				await jest.advanceTimersByTimeAsync(499);
				expect(mapped).toEqual(['first', 'second']);
				await jest.advanceTimersByTimeAsync(1);
				expect(mapped).toEqual(['first', 'second', 'latest attributes']);
				expect(samples()).toEqual([[heater, false, 13]]);
				expect(writes().slice(-2)).toEqual([
					[heater + '/attribute', 'latest attributes'],
					[heater + '/virtual', 'latest attributes'],
				]);
			});

			it('revokes admitted OFF on intake and cancels queued snapshots even when the final ON mapping fails', async () => {
				const started = gate();
				const release = gate();
				const other = 'switch.other';
				const { mapped } = setup(
					async (revision) => {
						if (revision === 'pending attributes') {
							started.release();
							await release.promise;
						}
						if (revision === 'failed ON') throw new Error('ON mapping failed');
					},
					[heater, other],
				);
				await service.handle(transition('other OFF', false, other), ingress());
				const unrelated = channelsPropertiesService.reportSample.mock.calls[0][2].sourceIsCurrent;
				await service.handle(transition('accepted OFF', false), ingress());
				const previous = channelsPropertiesService.reportSample.mock.calls[1][2].sourceIsCurrent;
				await service.handle(presentation('pending attributes', 'off'), ingress());
				await jest.advanceTimersByTimeAsync(500);
				await started.promise;
				const qualifiedBeforeTransition = previous();

				const on = service.handle(transition('queued ON', true), ingress());
				const qualifiedAtIntake = previous();
				const off = service.handle(transition('queued OFF', false), ingress());
				const latest = service.handle(transition('failed ON', true), ingress());
				release.release();
				await Promise.all([on, off, latest]);
				expect(qualifiedBeforeTransition).toBe(true);
				expect(qualifiedAtIntake).toBe(false);
				expect(previous()).toBe(false);
				expect(unrelated()).toBe(true);
				expect(mapped).toEqual(['other OFF', 'accepted OFF', 'pending attributes', 'failed ON']);
				expect(samples()).toEqual([
					[other, false, 12],
					[heater, false, 12],
				]);
				expect(writes().filter(([id]) => id === heater + '/attribute')).toEqual([
					[heater + '/attribute', 'accepted OFF'],
				]);
				expect(writes().filter(([id]) => id === heater + '/virtual')).toEqual([[heater + '/virtual', 'accepted OFF']]);

				await service.handle(transition('new OFF', false), { ...ingress(), ingressSequence: 15 });
				expect(channelsPropertiesService.reportSample.mock.calls[2][2].sourceIsCurrent()).toBe(true);
				expect(previous()).toBe(false);
			});

			it('withdraws an OFF observation while persistence is in progress if the newer ON cannot map', async () => {
				const started = gate();
				const release = gate();
				setup((revision) => (revision === 'ON' ? Promise.reject(new Error('mapping failed')) : Promise.resolve()));
				let accepted: boolean;
				channelsPropertiesService.reportSample.mockImplementationOnce(async (id, _update, evidence) => {
					started.release();
					await release.promise;
					accepted = evidence.sourceIsCurrent();
					return { id } as HomeAssistantChannelPropertyEntity;
				});
				const first = service.handle(transition('OFF', false), ingress());
				await started.promise;
				const guard = channelsPropertiesService.reportSample.mock.calls[0][2].sourceIsCurrent;
				const latest = service.handle(transition('ON', true), ingress());
				const stillCurrent = guard();
				release.release();
				await Promise.all([first, latest]);
				expect(stillCurrent).toBe(false);
				expect(accepted).toBe(false);
				expect(guard()).toBe(false);
				expect(writes()).toEqual([]);
			});

			it.each(['reconnect', 'remap', 'entity removal', 'teardown'])(
				'discards in-flight, queued and debounced snapshots at %s',
				async (change) => {
					const mappingStarted = gate();
					const allowMapping = gate();
					const { mapped } = setup(async (revision) => {
						if (revision === 'old') {
							mappingStarted.release();
							await allowMapping.promise;
						}
					});
					const source = ingress();
					const first = service.handle(transition('old', true), source);
					await mappingStarted.promise;
					const second = service.handle(transition('queued', false), source);
					await service.handle(presentation('debounced', 'off'), source);
					let destroyed: Promise<void>;
					if (change === 'remap') service.handleDevicesUpdatedEvent({ type: 'devices-home-assistant' });
					if (change === 'teardown') destroyed = service.onModuleDestroy();
					if (change === 'entity removal') {
						const removal = transition('removed', false);
						removal.data.new_state = null;
						await service.handle(removal, source);
					}
					const current = change === 'reconnect' ? { ...source, session: 'replacement socket' } : source;
					const replacement = service.handle(transition('current', true), { ...current, ingressSequence: 99 });
					allowMapping.release();
					await Promise.all([first, second, replacement, destroyed]);
					await jest.runAllTimersAsync();
					expect(mapped).toEqual(change === 'teardown' ? ['old'] : ['old', 'current']);
					expect(samples()).toEqual(change === 'teardown' ? [] : [[heater, true, 99]]);
					expect(writes()).toEqual(
						change === 'teardown'
							? []
							: [
									[heater + '/attribute', 'current'],
									[heater + '/virtual', 'current'],
								],
					);
				},
			);

			it('fences a virtual property lookup across remapping and reloads the channel metadata', async () => {
				const lookupStarted = gate();
				const allowLookup = gate();
				const { channels } = setup(() => Promise.resolve());
				channelsService.findAll.mockImplementationOnce(async () => {
					lookupStarted.release();
					await allowLookup.promise;
					return channels;
				});
				const first = service.handle(transition('old', true), ingress());
				await lookupStarted.promise;
				service.handleDevicesUpdatedEvent({ type: 'devices-home-assistant' });
				const second = service.handle(transition('current', false), { ...ingress(), ingressSequence: 13 });
				allowLookup.release();
				await Promise.all([first, second]);
				expect(channelsService.findAll).toHaveBeenCalledTimes(2);
				expect(writes()).toEqual([
					[heater + '/attribute', 'old'],
					[heater + '/attribute', 'current'],
					[heater + '/virtual', 'current'],
				]);
				expect(channelsPropertiesService.reportSample.mock.calls[0][2].sourceIsCurrent()).toBe(false);
			});

			it('lets other entities finish independently and processes the next event after a mapping error', async () => {
				const mappingStarted = gate();
				const failMapping = gate();
				const other = 'switch.cooler';
				const { mapped } = setup(
					async (revision) => {
						if (revision === 'failing') {
							mappingStarted.release();
							await failMapping.promise;
							throw new Error('mapping failed');
						}
					},
					[heater, other],
				);
				const first = service.handle(transition('failing', true), ingress());
				await mappingStarted.promise;
				const next = service.handle(transition('retry', false), { ...ingress(), ingressSequence: 13 });
				const independent = service.handle(transition('other', true, other), ingress());
				await jest.advanceTimersByTimeAsync(0);
				const duringFailure = samples();
				failMapping.release();
				await Promise.all([first, next, independent]);
				expect(duringFailure).toEqual([[other, true, 12]]);
				expect(mapped).toEqual(['failing', 'other', 'retry']);
				expect(samples()).toEqual([
					[other, true, 12],
					[heater, false, 13],
				]);
			});
		});

		it.each(['unknown', 'unavailable'])(
			'uses a recovered %s temperature as a presentation baseline until the next physical change',
			async (previous) => {
				const sensor = 'sensor.room';
				const attributes = { device_class: 'temperature', unit_of_measurement: '°C' };
				arrange(sensor, 20, PropertyCategory.TEMPERATURE);
				await service.handle(event(sensor, previous, '20', attributes), ingress());
				await jest.advanceTimersByTimeAsync(500);
				expect(channelsPropertiesService.reportSample).not.toHaveBeenCalled();
				expect(channelsPropertiesService.update).toHaveBeenCalledWith(
					'property',
					expect.objectContaining({ value: 20 }),
				);
				arrange(sensor, 21, PropertyCategory.TEMPERATURE);
				await service.handle(event(sensor, '20', '21', attributes), ingress());
				expect(channelsPropertiesService.reportSample.mock.calls[0][1].value).toBe(21);
			},
		);

		it.each(['unknown', 'unavailable'])(
			'withdraws OFF evidence on a retained relay baseline following %s',
			async (previous) => {
				arrange('switch.heater', false);
				await service.handle(event('switch.heater', 'on', 'off'), ingress());
				const guard = channelsPropertiesService.reportSample.mock.calls[0][2].sourceIsCurrent;
				await service.handle(event('switch.heater', previous, 'off'), ingress());
				expect(guard()).toBe(false);
				await jest.advanceTimersByTimeAsync(500);
				expect(channelsPropertiesService.reportSample).toHaveBeenCalledTimes(1);
				expect(channelsPropertiesService.update).toHaveBeenCalledWith(
					'property',
					expect.objectContaining({ value: false }),
				);
			},
		);

		it.each(['future', 'invalid', 'before previous state', 'older than accepted sample'])(
			'withdraws contradictory evidence immediately for a %s timestamp and accepts a later valid transition',
			async (timing) => {
				const heater = 'switch.heater';
				arrange(heater, false);
				await service.handle(event(heater, 'on', 'off'), ingress());
				const original = channelsPropertiesService.reportSample.mock.calls[0][2].sourceIsCurrent;
				const attribute = event(heater, 'off', 'off', { revision: 2 });
				attribute.context = { ...context, user_id: 'attribute writer' };
				await service.handle(attribute, ingress());
				expect(original()).toBe(true);
				arrange(heater, true);
				const contradictory = event(heater, 'off', 'on');
				contradictory.data.new_state.last_changed = new Date(
					timing === 'future'
						? at.getTime() + 3_000
						: timing === 'invalid'
							? NaN
							: at.getTime() - (timing === 'before previous state' ? 70_000 : 5_000),
				);
				await service.handle(contradictory, ingress());
				expect(original()).toBe(false);
				await jest.advanceTimersByTimeAsync(500);
				expect(channelsPropertiesService.reportSample).toHaveBeenCalledTimes(1);
				expect(channelsPropertiesService.update).toHaveBeenCalledWith(
					'property',
					expect.objectContaining({ value: true }),
				);
				arrange(heater, false);
				const valid = event(heater, 'on', 'off');
				valid.data.new_state.last_changed = new Date(at.getTime() + 1_000);
				await service.handle(valid, ingress());
				expect(channelsPropertiesService.reportSample).toHaveBeenCalledTimes(2);
				expect(channelsPropertiesService.reportSample.mock.calls[1][2].sourceIsCurrent()).toBe(true);
				expect(original()).toBe(false);
			},
		);

		it.each([false, true])(
			'routes a directly adopted temperature entity with other registry devices=%s',
			async (withRegistry) => {
				const sensor = 'sensor.room';
				const attributes = { device_class: 'temperature', unit_of_measurement: '°C' };
				arrange(sensor, 20, PropertyCategory.TEMPERATURE);
				const standalone = { id: 'standalone', enabled: true, haDeviceId: sensor } as HomeAssistantDeviceEntity;
				const relay = { id: 'relay', enabled: true, haDeviceId: 'registry-device' } as HomeAssistantDeviceEntity;
				devicesService.findAll.mockResolvedValue(withRegistry ? [standalone, relay] : [standalone]);
				httpService.getDiscoveredDevices.mockResolvedValue(
					withRegistry
						? [{ id: 'registry-device', entities: ['switch.relay'] } as HomeAssistantDiscoveredDeviceModel]
						: [],
				);
				await service.handle(event(sensor, '19', '20', attributes), ingress());
				expect(mapperService.mapFromHA.mock.calls[0][0]).toBe(standalone);
				expect(channelsPropertiesService.reportSample.mock.calls[0][1].value).toBe(20);
				if (withRegistry) {
					await service.handle(event('switch.relay', 'off', 'on'), ingress());
					expect(mapperService.mapFromHA.mock.calls[1][0]).toBe(relay);
				} else expect(httpService.getDiscoveredDevices).not.toHaveBeenCalled();
			},
		);

		it.each(['empty', 'partial'])(
			'retries missing adopted devices after %s discovery while serving known routes from cache',
			async (initial) => {
				const sensor = 'sensor.room';
				const relay = 'switch.relay';
				const fan = 'switch.fan';
				arrange(sensor, 20, PropertyCategory.TEMPERATURE);
				const adopted = [sensor, 'ha-relay', 'ha-fan'].map(
					(haDeviceId) => ({ id: 'panel-' + haDeviceId, haDeviceId, enabled: true }) as HomeAssistantDeviceEntity,
				);
				devicesService.findAll.mockResolvedValue(adopted);
				const relayDevice = {
					id: 'ha-relay',
					entities: [relay, 'sensor.relay_power', 'sensor.relay_current'],
				} as HomeAssistantDiscoveredDeviceModel;
				const fanDevice = { id: 'ha-fan', entities: [fan] } as HomeAssistantDiscoveredDeviceModel;
				httpService.getDiscoveredDevices
					.mockResolvedValueOnce(initial === 'empty' ? [] : [relayDevice])
					.mockResolvedValue([relayDevice, fanDevice]);

				const attributes = { device_class: 'temperature', unit_of_measurement: '°C' };
				await service.handle(event(sensor, '19', '20', attributes), ingress());
				await service.handle(event(sensor, '20', '20', attributes), ingress());
				await jest.advanceTimersByTimeAsync(500);
				if (initial === 'partial') await service.handle(event(relay, 'off', 'on'), ingress());
				expect(httpService.getDiscoveredDevices).toHaveBeenCalledTimes(1);
				const discoveringFan = service.handle(event(fan, 'off', 'on'), ingress());
				await jest.advanceTimersByTimeAsync(5_000);
				await discoveringFan;
				expect(mapperService.mapFromHA.mock.calls.at(-1)[0]).toBe(adopted[2]);
				const laterRelay = event(relay, 'on', 'off');
				laterRelay.data.old_state.last_changed = at;
				laterRelay.data.new_state.last_changed = new Date(at.getTime() + 1);
				await service.handle(laterRelay, ingress());
				expect(mapperService.mapFromHA.mock.calls.at(-1)[0]).toBe(adopted[1]);
				await service.handle(event('switch.unadopted', 'off', 'on'), ingress());
				expect(httpService.getDiscoveredDevices).toHaveBeenCalledTimes(2);
			},
		);

		it('retains verified routes from complementary partial inventories for the same adoption', async () => {
			const a = 'switch.a';
			const b = 'switch.b';
			arrange(a, true);
			const adoptions = ['remote-a', 'remote-b'].map(
				(haDeviceId) => ({ id: haDeviceId + '-panel', haDeviceId, enabled: true }) as HomeAssistantDeviceEntity,
			);
			devicesService.findAll.mockResolvedValue(adoptions);
			httpService.getDiscoveredDevices
				.mockResolvedValueOnce([{ id: 'remote-a', entities: [a] } as HomeAssistantDiscoveredDeviceModel])
				.mockResolvedValue([{ id: 'remote-b', entities: [b] } as HomeAssistantDiscoveredDeviceModel]);
			await service.handle(event(a, 'off', 'on'), ingress());
			const discoveringB = service.handle(event(b, 'off', 'on'), ingress());
			await jest.advanceTimersByTimeAsync(5_000);
			await discoveringB;
			await service.handle(event(a, 'on', 'on'), ingress());
			await jest.advanceTimersByTimeAsync(500);
			expect(mapperService.mapFromHA.mock.calls.map(([device]) => device)).toEqual([
				adoptions[0],
				adoptions[1],
				adoptions[0],
			]);
			expect(httpService.getDiscoveredDevices).toHaveBeenCalledTimes(2);
		});

		it('keeps direct adoptions available during a registry discovery failure and retries the remote device', async () => {
			arrange('sensor.room', 20, PropertyCategory.TEMPERATURE);
			const standalone = { id: 'standalone', enabled: true, haDeviceId: 'sensor.room' } as HomeAssistantDeviceEntity;
			const relay = { id: 'relay', enabled: true, haDeviceId: 'registry-device' } as HomeAssistantDeviceEntity;
			devicesService.findAll.mockResolvedValue([standalone, relay]);
			httpService.getDiscoveredDevices
				.mockRejectedValueOnce(new Error('discovery unavailable'))
				.mockResolvedValue([
					{ id: 'registry-device', entities: ['switch.relay'] } as HomeAssistantDiscoveredDeviceModel,
				]);
			await service.handle(
				event('sensor.room', '19', '20', { device_class: 'temperature', unit_of_measurement: '°C' }),
				ingress(),
			);
			expect(mapperService.mapFromHA.mock.calls[0][0]).toBe(standalone);
			expect(channelsPropertiesService.reportSample.mock.calls[0][2].sourceIsCurrent()).toBe(true);
			const retry = service.handle(event('switch.relay', 'off', 'on'), ingress());
			await jest.advanceTimersByTimeAsync(5_000);
			await retry;
			expect(mapperService.mapFromHA.mock.calls[1][0]).toBe(relay);
		});

		describe('incomplete registry discovery', () => {
			const known = 'switch.known';
			const relay = 'switch.relay';
			const discovered = (id: string, ...entities: string[]) =>
				({ id, entities }) as HomeAssistantDiscoveredDeviceModel;
			const setAdoptions = (...ids: string[]) => {
				// Each DB lookup returns new ORM instances for the same adopted rows.
				devicesService.findAll.mockImplementation(() =>
					Promise.resolve(
						ids.map(
							(haDeviceId) => ({ id: 'local-' + haDeviceId, haDeviceId, enabled: true }) as HomeAssistantDeviceEntity,
						),
					),
				);
			};
			const setupPartial = () => {
				mapperService.mapFromHA.mockImplementation((_device, [state]) =>
					Promise.resolve([
						[
							{
								property: {
									id: state.entity_id,
									haEntityId: state.entity_id,
									category: PropertyCategory.ON,
									haAttribute: 'fb.main_state',
								} as HomeAssistantChannelPropertyEntity,
								value: state.state === 'on',
							},
						],
					]),
				);
				setAdoptions(known, 'remote-relay');
				httpService.getDiscoveredDevices
					.mockResolvedValueOnce([])
					.mockResolvedValue([discovered('remote-relay', relay)]);
			};

			it('coalesces different misses at most once per retry interval and keeps known routes live', async () => {
				setupPartial();
				httpService.getDiscoveredDevices
					.mockReset()
					.mockResolvedValueOnce([])
					.mockResolvedValueOnce([])
					.mockResolvedValue([discovered('remote-relay', relay)]);
				await service.handle(event(known, 'off', 'on'), ingress());
				const burst = ['switch.unknown_a', 'switch.unknown_b', 'switch.unknown_c'].map((id) =>
					service.handle(event(id, 'off', 'on'), ingress()),
				);
				await jest.advanceTimersByTimeAsync(1000);
				const attributes = event(known, 'on', 'on');
				await service.handle(attributes, ingress());
				await jest.advanceTimersByTimeAsync(500);
				expect(mapperService.mapFromHA.mock.calls.at(-1)[1]).toEqual([attributes.data.new_state]);
				expect(devicesService.findAll).toHaveBeenCalledTimes(1);
				expect(httpService.getDiscoveredDevices).toHaveBeenCalledTimes(1);
				await jest.advanceTimersByTimeAsync(3499);
				expect(httpService.getDiscoveredDevices).toHaveBeenCalledTimes(1);
				await jest.advanceTimersByTimeAsync(1);
				await Promise.all(burst);
				expect(httpService.getDiscoveredDevices).toHaveBeenCalledTimes(2);

				const arrival = { ...ingress(), ingressSequence: 99 };
				const change = event(relay, 'on', 'off');
				const waiting = service.handle(change, arrival);
				await jest.advanceTimersByTimeAsync(4999);
				expect(httpService.getDiscoveredDevices).toHaveBeenCalledTimes(2);
				await jest.advanceTimersByTimeAsync(1);
				await waiting;
				expect(mapperService.mapFromHA.mock.calls.at(-1)[0].haDeviceId).toBe('remote-relay');
				const [property, update, evidence] = channelsPropertiesService.reportSample.mock.calls.at(-1);
				expect([property, update.value]).toEqual([relay, false]);
				expect(evidence).toMatchObject({
					sampledAt: change.data.new_state.last_changed,
					receivedAt: arrival.receivedAt,
					ingressSequence: 99,
				});
				expect(evidence.sourceIsCurrent()).toBe(true);
				expect(httpService.getDiscoveredDevices).toHaveBeenCalledTimes(3);
			});

			it.each(['entity registry', 'device registry', 'reconnect'])(
				'expedites a matching %s change and keeps unrelated misses throttled',
				async (change) => {
					setupPartial();
					await service.handle(event(known, 'off', 'on'), ingress());
					const old = service.handle(event('switch.other_unknown', 'off', 'on'), ingress());
					await jest.advanceTimersByTimeAsync(1000);
					service.handleRegistryChange({ entityIds: ['switch.unrelated', 'switch.old_unrelated'] });
					await jest.advanceTimersByTimeAsync(0);
					expect(httpService.getDiscoveredDevices).toHaveBeenCalledTimes(1);
					if (change === 'entity registry') service.handleRegistryChange({ entityIds: [relay] });
					if (change === 'device registry') service.handleRegistryChange({ deviceId: 'remote-relay' });
					const source = ingress();
					if (change === 'reconnect') source.session = 'new socket';
					const fresh = service.handle(event(relay, 'on', 'off'), source);
					await jest.advanceTimersByTimeAsync(0);
					const requestsImmediately = httpService.getDiscoveredDevices.mock.calls.length;
					await jest.advanceTimersByTimeAsync(5000);
					await Promise.all([old, fresh]);
					expect(requestsImmediately).toBe(2);
					expect(httpService.getDiscoveredDevices).toHaveBeenCalledTimes(2);
					expect(mapperService.mapFromHA.mock.calls.at(-1)[0].haDeviceId).toBe('remote-relay');
				},
			);

			it('cancels a delayed shared lookup during teardown', async () => {
				setupPartial();
				await service.handle(event(known, 'off', 'on'), ingress());
				const miss = service.handle(event(relay, 'on', 'off'), ingress());
				await jest.advanceTimersByTimeAsync(0);
				await Promise.all([service.onModuleDestroy(), miss]);
				await jest.advanceTimersByTimeAsync(6_000);
				expect(httpService.getDiscoveredDevices).toHaveBeenCalledTimes(1);
			});

			it('permanently revokes the replaced owner during a refresh while preserving stable observations', async () => {
				const mapped = gate();
				const release = gate();
				setAdoptions('owner-a', 'owner-b', 'stable', 'unresolved');
				const stable = discovered('stable', known);
				httpService.getDiscoveredDevices
					.mockResolvedValueOnce([discovered('owner-a', relay), stable])
					.mockResolvedValueOnce([discovered('owner-b', relay), stable])
					.mockResolvedValue([discovered('owner-a', relay), stable]);
				mapperService.mapFromHA.mockImplementation(async (device, [state]) => {
					if (state.attributes.pending) {
						mapped.release();
						await release.promise;
					}
					return [
						[
							{
								property: {
									id: device.id + '/' + state.entity_id,
									category: PropertyCategory.ON,
									haEntityId: state.entity_id,
									haAttribute: 'fb.main_state',
								} as HomeAssistantChannelPropertyEntity,
								value: state.state === 'on',
							},
						],
					];
				});
				await service.handle(event(relay, 'on', 'off'), ingress());
				await service.handle(event(known, 'on', 'off'), ingress());
				const original = channelsPropertiesService.reportSample.mock.calls[0][2].sourceIsCurrent;
				const unchanged = channelsPropertiesService.reportSample.mock.calls[1][2].sourceIsCurrent;
				await service.handle(event(relay, 'off', 'off', { pending: true }), ingress());
				await jest.advanceTimersByTimeAsync(500);
				await mapped.promise;
				const refresh = service.handle(event('switch.trigger_a', 'off', 'on'), ingress());
				await jest.advanceTimersByTimeAsync(4500);
				await refresh;
				const originalAfterMove = original();
				const unchangedAfterMove = unchanged();
				release.release();
				await jest.advanceTimersByTimeAsync(0);
				expect(originalAfterMove).toBe(false);
				expect(unchangedAfterMove).toBe(true);
				expect(channelsPropertiesService.update).not.toHaveBeenCalled();

				await service.handle(event(relay, 'off', 'on'), ingress());
				const [property, , sample] = channelsPropertiesService.reportSample.mock.calls[2];
				expect(property).toBe('local-owner-b/' + relay);
				expect(sample.sourceIsCurrent()).toBe(true);
				const refreshAgain = service.handle(event('switch.trigger_b', 'off', 'on'), ingress());
				await jest.advanceTimersByTimeAsync(5000);
				await refreshAgain;
				expect(original()).toBe(false);
				expect(sample.sourceIsCurrent()).toBe(false);
				expect(unchanged()).toBe(true);
			});

			it('retires an adopted relay when discovery assigns its entity to an unadopted device', async () => {
				setupPartial();
				setAdoptions('owner-a', 'stable', 'unresolved');
				const stable = discovered('stable', known);
				httpService.getDiscoveredDevices
					.mockReset()
					.mockResolvedValueOnce([discovered('owner-a', relay), stable])
					.mockResolvedValue([discovered('unadopted-owner', relay), stable]);
				await service.handle(event(relay, 'on', 'off'), ingress());
				await service.handle(event(known, 'on', 'off'), ingress());
				const [oldOwner, sameOwner] = channelsPropertiesService.reportSample.mock.calls.map(
					([, , sample]) => sample.sourceIsCurrent,
				);
				expect(oldOwner()).toBe(true);

				const refresh = service.handle(event('switch.trigger', 'off', 'on'), ingress());
				await jest.advanceTimersByTimeAsync(5000);
				await refresh;
				expect(oldOwner()).toBe(false);
				expect(sameOwner()).toBe(true);

				const unadopted = service.handle(event(relay, 'off', 'on'), ingress());
				await jest.advanceTimersByTimeAsync(5000);
				await unadopted;
				expect(channelsPropertiesService.reportSample).toHaveBeenCalledTimes(2);
			});
		});

		it('keeps unrelated evidence across local edits and registry changes and retires the original binding on re-adoption', async () => {
			const heater = 'switch.heater';
			arrange(heater, false);
			await service.handle(event(heater, 'on', 'off'), ingress());
			const original = channelsPropertiesService.reportSample.mock.calls[0][2].sourceIsCurrent;
			service.handleRegistryChange({ entityIds: ['sensor.renamed', 'sensor.old'] });
			service.handleRegistryChange({ deviceId: 'other device' });
			service.handleDevicesUpdatedEvent({
				type: 'devices-home-assistant',
				id: 'other-property',
				haEntityId: 'sensor.other',
			});
			expect(original()).toBe(true);
			service.handleDevicesUpdatedEvent({
				type: 'devices-home-assistant',
				id: 'panel-device',
				haDeviceId: 'original-device',
			});
			expect(original()).toBe(false);
			const replacement = {
				id: 'readopted',
				enabled: true,
				haDeviceId: 'original-device',
			} as HomeAssistantDeviceEntity;
			devicesService.findAll.mockResolvedValue([replacement]);
			await service.handle(event(heater, 'on', 'off'), ingress());
			const successor = channelsPropertiesService.reportSample.mock.calls[1][2].sourceIsCurrent;
			expect(mapperService.mapFromHA.mock.calls[1][0]).toBe(replacement);
			expect(successor()).toBe(true);
			expect(original()).toBe(false);
			service.handleDevicesUpdatedEvent({
				type: 'devices-home-assistant',
				id: 'property',
				haEntityId: 'switch.rebound',
			});
			expect(successor()).toBe(false);
		});

		it('aborts the mapping discovery and drains the pending state worker on teardown', async () => {
			arrange('switch.heater', false);
			const started = gate();
			let request: AbortSignal;
			httpService.getDiscoveredDevices.mockImplementation((signal) => {
				request = signal;
				started.release();
				return new Promise((resolve) => signal.addEventListener('abort', () => resolve([]), { once: true }));
			});
			const worker = service.handle(event('switch.heater', 'on', 'off'), ingress());
			await started.promise;
			await Promise.all([service.onModuleDestroy(), worker]);
			expect(request.aborted).toBe(true);
			expect(mapperService.mapFromHA).not.toHaveBeenCalled();
		});

		it('publishes an independent physical switch transition at its own timestamp and original socket ingress', async () => {
			arrange('switch.heater', false);
			const source = ingress();
			await service.handle(event('switch.heater', 'on', 'off'), source);
			const [id, update, evidence] = channelsPropertiesService.reportSample.mock.calls[0];
			expect(id).toBe('property');
			expect(update.value).toBe(false);
			expect(evidence).toMatchObject({
				sampledAt: at,
				receivedAt: source.receivedAt,
				ingressSequence: 12,
				provenance: 'live',
			});
			expect(evidence.sourceIsCurrent()).toBe(true);
			source.isCurrent.mockReturnValue(false);
			expect(evidence.sourceIsCurrent()).toBe(false);
		});

		it('publishes a direct temperature reading and withdraws it when the source becomes unavailable', async () => {
			arrange('sensor.room', 20, PropertyCategory.TEMPERATURE);
			const source = ingress();
			const attributes = { device_class: 'temperature', unit_of_measurement: '°C' };
			await service.handle(event('sensor.room', '19', '20', attributes), source);
			expect(channelsPropertiesService.reportSample.mock.calls[0][1].value).toBe(20);
			const guard = channelsPropertiesService.reportSample.mock.calls[0][2].sourceIsCurrent;
			await service.handle(event('sensor.room', '20', 'unavailable', attributes), source);
			expect(guard()).toBe(false);
		});

		it.each(['assumed_state', 'restored', 'optimistic', 'service', 'unchanged', 'initial', 'future'])(
			'keeps %s presentations out of the physical sample stream',
			async (kind) => {
				arrange('switch.heater', false);
				const request = event(
					'switch.heater',
					kind === 'unchanged' ? 'off' : 'on',
					'off',
					['restored', 'optimistic', 'assumed_state'].includes(kind) ? { [kind]: true } : {},
				);
				if (kind === 'service') request.data.new_state.context = { ...context, user_id: 'caller' };
				if (kind === 'future') request.data.new_state.last_changed = new Date(at.getTime() + 30_000);
				if (kind === 'initial') request.data.old_state = null;
				await service.handle(request, ingress());
				await jest.runAllTimersAsync();
				expect(channelsPropertiesService.reportSample).not.toHaveBeenCalled();
			},
		);
	});

	test('should debounce and process state changes', async () => {
		const device: HomeAssistantDeviceEntity = { id: 'd1', haDeviceId: 'ha1' } as unknown as HomeAssistantDeviceEntity;
		const property: HomeAssistantChannelPropertyEntity = { id: 'p1' } as unknown as HomeAssistantChannelPropertyEntity;
		const haDevice: HomeAssistantDiscoveredDeviceModel = {
			id: 'ha1',
			name: 'Device name',
			entities: ['sensor.temp'],
			adoptedDeviceId: device.id,
			states: [],
		};

		httpService.getDiscoveredDevices.mockResolvedValue([haDevice]);
		devicesService.findAll.mockResolvedValue([device]);
		channelsPropertiesService.findAll.mockResolvedValue([property]);
		mapperService.mapFromHA.mockResolvedValue([[{ property, value: 25 }]]);

		const event = {
			data: {
				new_state: {
					entity_id: 'sensor.temp',
				},
			},
		} as HomeAssistantStateChangedEventDto;

		await service.handle(event);

		await jest.runAllTimersAsync(); // fast-forward debounce

		expect(channelsPropertiesService.update).toHaveBeenCalledWith(
			property.id,
			toInstance(UpdateHomeAssistantChannelPropertyDto, {
				type: 'devices-home-assistant',
				value: 25,
			}),
		);
		expect(Object.keys(channelsPropertiesService.update.mock.calls[0][1]).sort()).toEqual(['type', 'value']);
	});

	describe('event.* entities handling', () => {
		const device: HomeAssistantDeviceEntity = { id: 'd1', haDeviceId: 'ha_remote_1' } as HomeAssistantDeviceEntity;
		const channel: HomeAssistantChannelEntity = { id: 'c1', device: 'd1' } as HomeAssistantChannelEntity;
		const property: HomeAssistantChannelPropertyEntity = {
			id: 'p1',
			channel: 'c1',
			haEntityId: 'event.button_1',
			category: PropertyCategory.EVENT,
		} as HomeAssistantChannelPropertyEntity;

		const haDevice: HomeAssistantDiscoveredDeviceModel = {
			id: 'ha_remote_1',
			name: 'Remote Controller',
			entities: ['event.button_1'],
			adoptedDeviceId: device.id,
			states: [],
		};

		const hardware = toInstance(
			HomeAssistantStateChangedEventDto,
			{
				data: {
					old_state: { entity_id: 'event.button_1', state: 'previous' },
					new_state: {
						entity_id: 'event.button_1',
						state: '2026-05-08T12:01:00Z',
						attributes: { event_type: 'press' },
					},
				},
			},
			{ excludeExtraneousValues: false },
		);

		beforeEach(() => {
			httpService.getDiscoveredDevices.mockResolvedValue([haDevice]);
			devicesService.findAll.mockResolvedValue([device]);
			channelsService.findAll.mockResolvedValue([channel]);
			channelsPropertiesService.findAll.mockResolvedValue([property]);
		});

		it.each(['unrelated entity', 'unrelated device', 'renamed entity', 'changed device', 'unknown scope'])(
			'preserves a pending button press only outside the affected %s registry scope',
			async (scope) => {
				const started = gate();
				const release = gate();
				channelsService.findAll.mockImplementationOnce(async () => {
					started.release();
					await release.promise;
					return [channel];
				});
				const worker = service.handle(hardware);
				await started.promise;
				if (scope === 'unrelated entity') service.handleRegistryChange({ entityIds: ['sensor.new', 'sensor.old'] });
				if (scope === 'unrelated device') service.handleRegistryChange({ deviceId: 'other' });
				if (scope === 'renamed entity') service.handleRegistryChange({ entityIds: ['event.new', 'event.button_1'] });
				if (scope === 'changed device') service.handleRegistryChange({ deviceId: device.haDeviceId });
				if (scope === 'unknown scope') service.handleRegistryChange(null);
				release.release();
				await worker;
				expect(inputOccurrencesService.publishOccurrence).toHaveBeenCalledTimes(scope.startsWith('unrelated') ? 1 : 0);
			},
		);

		it.each(['same', 'other'])('rechecks a pending discovery after a change to the %s device', async (scope) => {
			const started = gate();
			httpService.getDiscoveredDevices.mockImplementationOnce((signal) => {
				started.release();
				return new Promise((resolve) => signal.addEventListener('abort', () => resolve([haDevice]), { once: true }));
			});
			const worker = service.handle(hardware);
			await started.promise;
			service.handleRegistryChange({ deviceId: scope === 'same' ? device.haDeviceId : 'unrelated' });
			await worker;
			expect(httpService.getDiscoveredDevices).toHaveBeenCalledTimes(2);
			expect(inputOccurrencesService.publishOccurrence).toHaveBeenCalledTimes(scope === 'same' ? 0 : 1);
		});

		it('delivers original button presses in order when discovery was temporarily incomplete', async () => {
			httpService.getDiscoveredDevices.mockResolvedValueOnce([]).mockResolvedValue([haDevice]);
			const unknown = toInstance(
				HomeAssistantStateChangedEventDto,
				{
					data: {
						old_state: { entity_id: 'event.unadopted', state: 'old' },
						new_state: { entity_id: 'event.unadopted', state: 'new', attributes: { event_type: 'press' } },
					},
				},
				{ excludeExtraneousValues: false },
			);
			await service.handle(unknown);
			const second = toInstance(
				HomeAssistantStateChangedEventDto,
				{
					data: {
						old_state: hardware.data.new_state,
						new_state: { ...hardware.data.new_state, state: '2026-05-08T12:01:01Z' },
					},
				},
				{ excludeExtraneousValues: false },
			);
			const presses = [service.handle(hardware), service.handle(second)];
			await jest.advanceTimersByTimeAsync(4999);
			expect(inputOccurrencesService.publishOccurrence).not.toHaveBeenCalled();
			await jest.advanceTimersByTimeAsync(1);
			await Promise.all(presses);
			expect(inputOccurrencesService.publishOccurrence.mock.calls.map(([press]) => press.sourceTimestamp)).toEqual([
				hardware.data.new_state.state,
				second.data.new_state.state,
			]);
			expect(httpService.getDiscoveredDevices).toHaveBeenCalledTimes(2);
		});

		it('skips event occurrence on startup snapshot when old_state is null', async () => {
			const event = {
				data: {
					old_state: null,
					new_state: {
						entity_id: 'event.button_1',
						state: '2026-09-17T00:00:00.000Z',
						attributes: { event_type: 'press' },
					},
				},
			} as unknown as HomeAssistantStateChangedEventDto;

			await service.handle(event);

			expect(inputOccurrencesService.publishOccurrence).not.toHaveBeenCalled();
		});

		it('skips event when timestamp state did not change', async () => {
			const event = {
				data: {
					old_state: {
						entity_id: 'event.button_1',
						state: '2026-09-17T00:00:00.000Z',
						attributes: { event_type: 'press' },
					},
					new_state: {
						entity_id: 'event.button_1',
						state: '2026-09-17T00:00:00.000Z',
						attributes: { event_type: 'press' },
					},
				},
			} as unknown as HomeAssistantStateChangedEventDto;

			await service.handle(event);

			expect(inputOccurrencesService.publishOccurrence).not.toHaveBeenCalled();
		});

		it('skips event when new state is unavailable or unknown', async () => {
			const event = {
				data: {
					old_state: {
						entity_id: 'event.button_1',
						state: '2026-09-17T00:00:00.000Z',
					},
					new_state: {
						entity_id: 'event.button_1',
						state: 'unavailable',
					},
				},
			} as unknown as HomeAssistantStateChangedEventDto;

			await service.handle(event);

			expect(inputOccurrencesService.publishOccurrence).not.toHaveBeenCalled();
		});

		it('publishes occurrence immediately without debounce when event arrives', async () => {
			const event = {
				data: {
					old_state: {
						entity_id: 'event.button_1',
						state: '2026-09-17T00:00:00.000Z',
					},
					new_state: {
						entity_id: 'event.button_1',
						state: '2026-09-17T00:00:05.000Z',
						attributes: { event_type: 'single' },
						context: { id: 'ctx-1' },
					},
				},
			} as unknown as HomeAssistantStateChangedEventDto;

			// Do not run fake timers; event should be published immediately
			await service.handle(event);

			expect(inputOccurrencesService.publishOccurrence).toHaveBeenCalledWith({
				deviceId: 'd1',
				channelId: 'c1',
				propertyId: 'p1',
				event: 'press',
				nativeEventType: 'single',
				sourceTimestamp: '2026-09-17T00:00:05.000Z',
				sourceOccurrenceId: 'event.button_1:2026-09-17T00:00:05.000Z:ctx-1',
				data: {
					entity_id: 'event.button_1',
					event_type: 'single',
					state: '2026-09-17T00:00:05.000Z',
					context: { id: 'ctx-1' },
				},
			});
		});

		it('publishes rapid successive events with fresh context IDs independently', async () => {
			const event1 = {
				data: {
					old_state: {
						entity_id: 'event.button_1',
						state: '2026-09-17T00:00:00.000Z',
					},
					new_state: {
						entity_id: 'event.button_1',
						state: '2026-09-17T00:00:01.000Z',
						attributes: { event_type: 'press' },
						context: { id: 'ctx-1' },
					},
				},
			} as unknown as HomeAssistantStateChangedEventDto;

			const event2 = {
				data: {
					old_state: {
						entity_id: 'event.button_1',
						state: '2026-09-17T00:00:01.000Z',
					},
					new_state: {
						entity_id: 'event.button_1',
						state: '2026-09-17T00:00:02.000Z',
						attributes: { event_type: 'press' },
						context: { id: 'ctx-2' },
					},
				},
			} as unknown as HomeAssistantStateChangedEventDto;

			const started = gate();
			const release = gate();
			channelsService.findAll.mockImplementationOnce(async () => {
				started.release();
				await release.promise;
				return [channel];
			});
			const first = service.handle(event1);
			await started.promise;
			const second = service.handle(event2);
			release.release();
			await Promise.all([first, second]);

			expect(
				inputOccurrencesService.publishOccurrence.mock.calls.map(([occurrence]) => occurrence.sourceOccurrenceId),
			).toEqual(['event.button_1:2026-09-17T00:00:01.000Z:ctx-1', 'event.button_1:2026-09-17T00:00:02.000Z:ctx-2']);
		});
	});
});
