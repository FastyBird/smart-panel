/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/unbound-method */
import { DataSource } from 'typeorm';

import { EventEmitter2 } from '@nestjs/event-emitter';

import {
	DEVICES_RETERMINAL_TYPE,
	RETERMINAL_CHANNEL_IDENTIFIERS,
	RETERMINAL_SYSFS,
} from '../../../plugins/devices-reterminal/devices-reterminal.constants';
import { ReTerminalDevicePlatform } from '../../../plugins/devices-reterminal/platforms/reterminal.device.platform';
import { ReTerminalSysfsService } from '../../../plugins/devices-reterminal/services/reterminal-sysfs.service';
import { ShellyNgDeviceEntity } from '../../../plugins/devices-shelly-ng/entities/devices-shelly-ng.entity';
import { VirtualThermostatActuatorClaimEntity } from '../../../plugins/devices-virtual/entities/virtual-thermostat.entity';
import { VirtualDependencyGraphService } from '../../../plugins/devices-virtual/services/virtual-dependency-graph.service';
import { VirtualThermostatClaimsService } from '../../../plugins/devices-virtual/services/virtual-thermostat-claims.service';
import { ChannelCategory, DataTypeType, EventType, PermissionType, PropertyCategory } from '../devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../entities/devices.entity';
import { IDevicePlatform, IDevicePropertyData } from '../platforms/device.platform';

import { ChannelsService } from './channels.service';
import { CompositePropertyCommandRegistryService } from './composite-property-command.registry.service';
import { DeviceStructureLockService } from './device-structure-lock.service';
import { DevicesService } from './devices.service';
import { PlatformRegistryService } from './platform.registry.service';
import { PropertyCommandAdmissionRegistryService } from './property-command-admission.registry.service';
import { PropertyCommandDispatchService } from './property-command-dispatch.service';
import { PropertyCommandEntrySnapshot } from './property-command-entry-snapshot';
import { PropertyCommandWindowService } from './property-command-window.service';
import { PropertyMetadataService } from './property-metadata.service';
import { PropertyStateCoordinatorService } from './property-state-coordinator.service';
import { PropertyValueSourceRegistryService } from './property-value-source.registry.service';
import { PropertyValueService } from './property-value.service';

describe('PropertyCommandDispatchService', () => {
	let service: PropertyCommandDispatchService;
	let composites: CompositePropertyCommandRegistryService;
	let admission: PropertyCommandAdmissionRegistryService;
	let windows: PropertyCommandWindowService;
	let structureLock: DeviceStructureLockService;
	let platform: jest.Mocked<IDevicePlatform>;
	let platformRegistry: jest.Mocked<Pick<PlatformRegistryService, 'get' | 'usesAuthoritativePropertyReadback'>>;
	let valueSourceRegistry: jest.Mocked<Pick<PropertyValueSourceRegistryService, 'resolve'>>;
	let sources: Map<string, string>;
	let properties: jest.Mocked<Pick<PropertyMetadataService, 'findOne'>>;
	let channels: jest.Mocked<Pick<ChannelsService, 'findOne'>>;
	let devices: jest.Mocked<Pick<DevicesService, 'findOne'>>;

	const device = { id: 'source-device', type: 'mock' } as DeviceEntity;
	const channel = { id: 'source-channel', device: device.id } as ChannelEntity;
	const sourceProperty = {
		id: 'source-property',
		channel: channel.id,
		permissions: [PermissionType.READ_WRITE],
		dataType: DataTypeType.BOOL,
		value: { value: false },
	} as ChannelPropertyEntity;

	const update = (propertyId = sourceProperty.id, value: string | number | boolean = true): IDevicePropertyData => ({
		device,
		channel,
		property: { ...sourceProperty, id: propertyId } as ChannelPropertyEntity,
		value,
	});

	beforeEach(() => {
		windows = new PropertyCommandWindowService();
		structureLock = new DeviceStructureLockService();
		admission = new PropertyCommandAdmissionRegistryService();
		composites = new CompositePropertyCommandRegistryService();
		sources = new Map();
		properties = { findOne: jest.fn().mockResolvedValue(sourceProperty) };
		platform = {
			getType: jest.fn().mockReturnValue('mock'),
			process: jest.fn(),
			processBatch: jest.fn().mockResolvedValue(true),
		};

		channels = { findOne: jest.fn().mockResolvedValue(channel) };
		devices = { findOne: jest.fn().mockResolvedValue(device) };
		platformRegistry = {
			get: jest.fn().mockReturnValue(platform),
			usesAuthoritativePropertyReadback: jest.fn().mockReturnValue(false),
		};
		valueSourceRegistry = {
			resolve: jest.fn((property: ChannelPropertyEntity) => sources.get(property.id) ?? property.id),
		};

		service = new PropertyCommandDispatchService(
			properties as unknown as PropertyMetadataService,
			{
				readLatest: jest.fn((property: ChannelPropertyEntity) => Promise.resolve(property.value)),
			} as unknown as PropertyValueService,
			channels as unknown as ChannelsService,
			devices as unknown as DevicesService,
			platformRegistry as unknown as PlatformRegistryService,
			valueSourceRegistry as unknown as PropertyValueSourceRegistryService,
			structureLock,
			new PropertyStateCoordinatorService(),
			windows,
			undefined,
			composites,
			undefined,
			admission,
		);
	});

	it('opens a source window immediately before direct platform dispatch', async () => {
		await expect(service.dispatchBatch([update()], { intentId: 'intent', ttlMs: 1000 })).resolves.toEqual({
			success: true,
		});

		expect(platform.processBatch).toHaveBeenCalledWith([
			expect.objectContaining({ property: expect.objectContaining({ id: sourceProperty.id }) }),
		]);
		expect(windows.get(sourceProperty.id)).toEqual(
			expect.objectContaining({ intentId: 'intent', commandedValue: true, previousValue: false }),
		);
	});

	it('keeps a direct nonprepared legacy cover on ordinary dispatch with the captured entry and absolute deadline', async () => {
		const coverChannel = { ...channel, category: ChannelCategory.WINDOW_COVERING } as ChannelEntity;
		const position = {
			...sourceProperty,
			category: PropertyCategory.POSITION,
			dataType: DataTypeType.UCHAR,
			format: [0, 100],
			step: 1,
			invalid: null,
			unit: '%',
			value: { value: 20 },
			channel: coverChannel,
		} as ChannelPropertyEntity;
		properties.findOne.mockResolvedValue(position);
		const entry = PropertyCommandEntrySnapshot.capture(windows, () => undefined);
		try {
			const target = { ...update(), channel: coverChannel, property: position, value: 100 };
			await expect(
				service.dispatchBatch([target], { commandEntry: entry, deadlineAt: Date.now() + 1000 }),
			).resolves.toEqual({ success: true });
			expect(platform.prepareCompositeBatch).toBeUndefined();
			expect(platform.processBatch).toHaveBeenCalledWith([target]);
			await expect(
				service.dispatchBatch([target], { commandEntry: entry, deadlineAt: Date.now() - 1 }),
			).resolves.toMatchObject({ success: false });
			expect(platform.processBatch).toHaveBeenCalledTimes(1);
		} finally {
			entry.dispose();
		}
	});

	it('refuses an unprepared reTerminal sysfs batch under a captured room-selection guard', async () => {
		const writeFile = jest.fn().mockResolvedValue(undefined);
		const terminal = new ReTerminalDevicePlatform({ writeFile } as unknown as ReTerminalSysfsService);
		const processBatch = jest.spyOn(terminal, 'processBatch');
		const terminalDevice = { ...device, type: DEVICES_RETERMINAL_TYPE } as DeviceEntity;
		const terminalChannel = {
			...channel,
			category: ChannelCategory.LIGHT,
			identifier: RETERMINAL_CHANNEL_IDENTIFIERS.USR_LED,
			device: terminalDevice,
		} as ChannelEntity;
		const terminalProperty = {
			...sourceProperty,
			identifier: 'on',
			category: PropertyCategory.ON,
			channel: terminalChannel,
		} as ChannelPropertyEntity;
		const target = { device: terminalDevice, channel: terminalChannel, property: terminalProperty, value: true };
		properties.findOne.mockResolvedValue(terminalProperty);
		platformRegistry.get.mockReturnValue(terminal);
		await expect(service.dispatchBatch([target], { isRequestCurrent: () => true })).resolves.toMatchObject({
			success: false,
		});
		expect(processBatch).not.toHaveBeenCalled();
		expect(writeFile).not.toHaveBeenCalled();
		// The same real platform and writable target remain valid for legacy manual dispatch.
		await expect(service.dispatchBatch([target])).resolves.toMatchObject({ success: true });
		expect(writeFile).toHaveBeenCalledWith(RETERMINAL_SYSFS.USR_LED, '255');
	});

	it('coalesces alias windows by canonical source without another platform dispatch', async () => {
		sources.set('alias-a', sourceProperty.id);
		sources.set('alias-b', sourceProperty.id);

		await expect(service.dispatchBatch([update('alias-a'), update('alias-b')])).resolves.toEqual({ success: true });

		expect(platform.processBatch).toHaveBeenCalledTimes(1);
		expect(windows.get(sourceProperty.id)).toEqual(
			expect.objectContaining({
				canonicalTarget: expect.objectContaining({ propertyId: sourceProperty.id }),
				requestedTargets: [
					expect.objectContaining({ propertyId: 'alias-a' }),
					expect.objectContaining({ propertyId: 'alias-b' }),
				],
			}),
		);
	});

	it('coalesces equivalent scalar candidates after canonical-source normalization', async () => {
		const numericSource = {
			...sourceProperty,
			dataType: DataTypeType.INT,
			format: null,
			invalid: null,
			step: null,
		} as ChannelPropertyEntity;
		sources.set('alias', sourceProperty.id);
		properties.findOne.mockResolvedValue(numericSource);

		await expect(service.dispatchBatch([update('alias', '1'), update(sourceProperty.id, 1)])).resolves.toEqual({
			success: true,
		});
		expect(platform.processBatch).toHaveBeenCalledTimes(1);
		expect(windows.get(sourceProperty.id)?.commandedValue).toBe(1);
	});

	it('rejects conflicting direct-source and alias values before platform dispatch', async () => {
		sources.set('alias', sourceProperty.id);

		await expect(service.dispatchBatch([update('alias', true), update(sourceProperty.id, false)])).resolves.toEqual(
			expect.objectContaining({ success: false }),
		);
		expect(platform.processBatch).not.toHaveBeenCalled();
		expect(windows.get(sourceProperty.id)).toBeNull();
	});

	it('uses the fresh joined target for admission without loading sibling properties again', async () => {
		const joinedChannel = { ...channel, device } as ChannelEntity;
		const joinedProperty = { ...sourceProperty, channel: joinedChannel } as ChannelPropertyEntity;
		properties.findOne.mockResolvedValue(joinedProperty);
		channels.findOne.mockRejectedValue(new Error('Unnecessary channel graph read'));
		devices.findOne.mockRejectedValue(new Error('Unnecessary device graph read'));

		await expect(service.dispatchBatch([update()])).resolves.toEqual({ success: true });
		expect(channels.findOne).not.toHaveBeenCalled();
		expect(devices.findOne).not.toHaveBeenCalled();
		expect(platformRegistry.usesAuthoritativePropertyReadback).toHaveBeenCalledWith(device, joinedProperty);
		expect(windows.get(sourceProperty.id)?.canonicalTarget).toEqual({
			deviceId: device.id,
			channelId: channel.id,
			propertyId: sourceProperty.id,
		});
	});

	it.each(['channel', 'device'])('rejects a fresh source with a missing %s relation', async (missing) => {
		properties.findOne.mockResolvedValue({
			...sourceProperty,
			channel: missing === 'channel' ? null : { ...channel, device: null },
		} as unknown as ChannelPropertyEntity);

		await expect(service.dispatchBatch([update()])).resolves.toEqual(expect.objectContaining({ success: false }));
		expect(platform.processBatch).not.toHaveBeenCalled();
	});

	it('rejects an alias remapped after initial validation before forwarding', async () => {
		const remappedAlias = { ...sourceProperty, id: 'alias' } as ChannelPropertyEntity;
		sources.set('alias', sourceProperty.id);
		properties.findOne.mockImplementation((id) => Promise.resolve(id === 'alias' ? remappedAlias : sourceProperty));
		valueSourceRegistry.resolve.mockImplementation((property) =>
			property === remappedAlias ? 'different-source' : (sources.get(property.id) ?? property.id),
		);

		await expect(service.dispatchBatch([update('alias')])).resolves.toEqual(
			expect.objectContaining({ success: false }),
		);
		expect(platform.processBatch).not.toHaveBeenCalled();
		expect(windows.get(sourceProperty.id)).toBeNull();
	});

	it('closes only its pending handles when platform dispatch returns false', async () => {
		platform.processBatch.mockResolvedValue(false);

		await expect(service.dispatchBatch([update()])).resolves.toEqual(expect.objectContaining({ success: false }));
		expect(windows.get(sourceProperty.id)).toBeNull();
	});

	it('closes its pending handles when platform dispatch throws', async () => {
		platform.processBatch.mockRejectedValue(new Error('network failed'));

		await expect(service.dispatchBatch([update()])).rejects.toThrow('network failed');
		expect(windows.get(sourceProperty.id)).toBeNull();
	});

	it('fails a pre-opened receipt when the source becomes read-only before dispatch', async () => {
		const prepared = await service.prepareApiCommand(update(), 3_000);
		properties.findOne.mockResolvedValue({
			...sourceProperty,
			permissions: [PermissionType.READ_ONLY],
		} as ChannelPropertyEntity);

		await expect(
			service.dispatchBatch([update()], { windowHandles: prepared === null ? [] : [prepared.handle] }),
		).resolves.toEqual(expect.objectContaining({ success: false }));
		expect(platform.processBatch).not.toHaveBeenCalled();
		expect(windows.get(sourceProperty.id)).toBeNull();
	});

	it('fails a pre-opened receipt when the source data type no longer accepts its command value', async () => {
		const prepared = await service.prepareApiCommand(update(), 3_000);
		properties.findOne.mockResolvedValue({
			...sourceProperty,
			dataType: DataTypeType.STRING,
		} as ChannelPropertyEntity);

		await expect(
			service.dispatchBatch([update()], { windowHandles: prepared === null ? [] : [prepared.handle] }),
		).resolves.toEqual(expect.objectContaining({ success: false }));
		expect(platform.processBatch).not.toHaveBeenCalled();
		expect(windows.get(sourceProperty.id)).toBeNull();
	});

	it('does not open a generic window for an authoritative source property', async () => {
		sources.set('virtual-alias', sourceProperty.id);
		platformRegistry.usesAuthoritativePropertyReadback.mockReturnValue(true);

		await expect(service.dispatchBatch([update('virtual-alias')])).resolves.toEqual({ success: true });
		expect(platformRegistry.usesAuthoritativePropertyReadback).toHaveBeenCalledWith(device, sourceProperty);
		expect(windows.get(sourceProperty.id)).toBeNull();
	});

	it('does not open a window for read-only telemetry', async () => {
		properties.findOne.mockResolvedValue({
			...sourceProperty,
			permissions: [PermissionType.READ_ONLY],
		} as ChannelPropertyEntity);

		await expect(service.dispatchBatch([update()])).resolves.toEqual({ success: true });
		expect(platform.processBatch).toHaveBeenCalledTimes(1);
		expect(windows.get(sourceProperty.id)).toBeNull();
	});

	it('does not open a window for a write-only action', async () => {
		properties.findOne.mockResolvedValue({
			...sourceProperty,
			permissions: [PermissionType.WRITE_ONLY],
		} as ChannelPropertyEntity);

		await expect(service.dispatchBatch([update()])).resolves.toEqual({ success: true });
		expect(platform.processBatch).toHaveBeenCalledTimes(1);
		expect(windows.get(sourceProperty.id)).toBeNull();
	});
	const ownershipGuard = () => {
		let revision = 0;
		admission.register({
			assertAllowed: jest.fn().mockResolvedValue(undefined),
			requiresGuardedDispatch: () => true,
			capture: () => {
				const captured = revision;
				return { isCurrent: () => captured === revision, assertAllowed: jest.fn().mockResolvedValue(undefined) };
			},
		});
		return () => revision++;
	};

	it('freezes absent ownership before metadata awaits and revokes a stale command entry', async () => {
		const claim = ownershipGuard();
		const entry = PropertyCommandEntrySnapshot.capture(windows, () => undefined, false, admission.capture());
		claim();
		await expect(service.dispatchBatch([update()], { commandEntry: entry })).resolves.toMatchObject({ success: false });
		expect(platform.processBatch).not.toHaveBeenCalled();
		entry.dispose();
	});

	it('requires prepared dispatch for a guard that cannot be maintained under the structure lock', async () => {
		ownershipGuard();
		await expect(service.dispatchBatch([update()])).resolves.toMatchObject({ success: false });
		expect(platform.processBatch).not.toHaveBeenCalled();
	});

	it('routes ordinary projected physical leaves through prepared guarded I/O without changing boolean acceptance', async () => {
		ownershipGuard();
		const alias = { ...sourceProperty, id: 'alias' } as ChannelPropertyEntity;
		sources.set('alias', sourceProperty.id);
		properties.findOne.mockImplementation((id) => Promise.resolve(id === 'alias' ? alias : sourceProperty));
		const sent = jest.fn((guard: () => boolean) => Promise.resolve(guard()));
		platform.prepareCompositeBatch = jest.fn((updates) =>
			Promise.resolve({ updates, isCurrent: () => true, dispatch: sent }),
		);
		await expect(service.dispatchBatch([update('alias')])).resolves.toEqual({ success: true });
		expect(platform.prepareCompositeBatch).toHaveBeenCalledWith([
			expect.objectContaining({ property: expect.objectContaining({ id: sourceProperty.id }) }),
		]);
		expect(sent).toHaveBeenCalledTimes(1);
		expect(platform.processBatch).not.toHaveBeenCalled();
	});

	it('blocks a queued ordinary ON after a new exclusive reservation appears', async () => {
		const claim = ownershipGuard();
		let release: () => void;
		let queued: () => void;
		const barrier = new Promise<void>((resolve) => {
			release = resolve;
		});
		const ready = new Promise<void>((resolve) => {
			queued = resolve;
		});
		const actualSend = jest.fn();
		platform.prepareCompositeBatch = jest.fn((updates) =>
			Promise.resolve({
				updates,
				isCurrent: () => true,
				dispatch: async (guard) => {
					queued();
					await barrier;
					if (!guard()) return false;
					actualSend();
					return true;
				},
			}),
		);
		const command = service.dispatchBatch([update()]);
		await ready;
		claim();
		release();
		await expect(command).resolves.toMatchObject({ success: false });
		expect(actualSend).not.toHaveBeenCalled();
	});

	it('keeps room selection fences through ordinary queued sends and rejects an unsupported legacy queue', async () => {
		await expect(service.dispatchBatch([update()], { isRequestCurrent: () => true })).resolves.toMatchObject({
			success: false,
		});
		expect(platform.processBatch).not.toHaveBeenCalled();
		let selected = true;
		let release: () => void, queued: () => void;
		const barrier = new Promise<void>((resolve) => {
			release = resolve;
		});
		const ready = new Promise<void>((resolve) => {
			queued = resolve;
		});
		const actualSend = jest.fn();
		platform.prepareCompositeBatch = jest.fn((updates) =>
			Promise.resolve({
				updates,
				isCurrent: () => true,
				dispatch: async (guard) => {
					queued();
					await barrier;
					if (!guard()) return false;
					actualSend();
					return true;
				},
			}),
		);
		const command = service.dispatchBatch([update()], { isRequestCurrent: () => selected });
		await ready;
		selected = false;
		release();
		await expect(command).resolves.toMatchObject({ success: false });
		expect(actualSend).not.toHaveBeenCalled();
	});
	describe('thermostat admission scope at physical dispatch', () => {
		let claims: VirtualThermostatClaimsService;
		let events: EventEmitter2;
		let rows: VirtualThermostatActuatorClaimEntity[];
		let readClaims: jest.Mock;
		const relayDevice = Object.assign(new ShellyNgDeviceEntity(), {
			id: 'relay-device',
			canonicalMac: 'A8032ABE5084',
		});
		const relayChannel = Object.assign(new ChannelEntity(), {
			id: 'relay-channel',
			identifier: 'switch:0',
			device: relayDevice,
		});
		const relayProperty = Object.assign(new ChannelPropertyEntity(), {
			...sourceProperty,
			id: 'relay-property',
			identifier: 'output',
			category: PropertyCategory.ON,
			channel: relayChannel,
		});
		const relay = (): IDevicePropertyData => ({
			device: relayDevice,
			channel: relayChannel,
			property: relayProperty,
			value: true,
		});
		const lightChannel = { ...channel, category: ChannelCategory.LIGHT } as ChannelEntity;
		const lightProperty = {
			...sourceProperty,
			channel: lightChannel,
			category: PropertyCategory.ON,
		} as ChannelPropertyEntity;
		const light = { device, channel: lightChannel, property: lightProperty, value: true };
		const lightIdentity = `property:${device.id}:${lightChannel.id}:${lightProperty.id}`;
		const barrier = () => {
			let resume: () => void;
			const waiting = new Promise<void>((resolve) => {
				resume = resolve;
			});
			return { waiting, resume };
		};
		const claim = (propertyId = relayProperty.id, physicalIdentity = 'shelly-ng:A8032ABE5084:switch:0:output') => {
			rows = [
				{
					id: 'claim',
					controllerId: 'thermostat',
					sourcePropertyIdentity: propertyId,
					physicalIdentity,
					state: 'reserved',
				} as VirtualThermostatActuatorClaimEntity,
			];
			claims.invalidate();
		};
		beforeEach(async () => {
			rows = [];
			events = new EventEmitter2();
			readClaims = jest.fn(() => Promise.resolve(rows));
			claims = new VirtualThermostatClaimsService(
				{ manager: { find: readClaims } } as unknown as DataSource,
				structureLock,
				{} as VirtualDependencyGraphService,
				admission,
				events,
			);
			await claims.onApplicationBootstrap();
			properties.findOne.mockImplementation((id) =>
				Promise.resolve(id === relayProperty.id ? relayProperty : sourceProperty),
			);
		});
		afterEach(() => claims.onModuleDestroy());

		it.each(['settings', 'metadata', 'reservation'])(
			'checks a queued ordinary light against its actual reservation after %s publication',
			async (change) => {
				properties.findOne.mockResolvedValue(lightProperty);
				const queued = barrier();
				const release = barrier();
				const send = jest.fn();
				platform.prepareCompositeBatch = jest.fn((updates) =>
					Promise.resolve({
						updates,
						isCurrent: () => true,
						dispatch: async (current) => {
							queued.resume();
							await release.waiting;
							if (!current()) return false;
							send();
							return true;
						},
					}),
				);
				const captured = claims.capture();
				const pending = service.dispatchBatch([light]);
				await queued.waiting;
				try {
					claims.invalidate('actuation');
					expect(captured.isCurrent()).toBe(false);
					expect(captured.isCurrent(light)).toBe(true);
					await expect(claims.assertAllowed(light)).resolves.toBeUndefined();
					if (change === 'metadata') events.emit(EventType.CHANNEL_PROPERTY_UPDATED, lightProperty);
					if (change === 'reservation') claim(lightProperty.id, lightIdentity);
					await claims.refresh();
					expect(captured.isCurrent(light)).toBe(change === 'settings');
				} finally {
					release.resume();
				}
				await expect(pending).resolves.toMatchObject({ success: change === 'settings' });
				expect(send).toHaveBeenCalledTimes(change === 'settings' ? 1 : 0);
				if (change === 'reservation') await expect(service.dispatchBatch([light])).rejects.toThrow('reserved');
			},
		);

		it('completes an unprepared light write before a concurrent thermostat can acquire that output', async () => {
			properties.findOne.mockResolvedValue(lightProperty);
			const queued = barrier();
			const completeWrite = barrier();
			const order: string[] = [];
			platform.processBatch.mockImplementationOnce(async () => {
				queued.resume();
				await completeWrite.waiting;
				order.push('light written');
				return true;
			});
			const write = service.dispatchBatch([light]);
			await queued.waiting;
			const release = claims.holdRecoveryFence();
			const acquisition = structureLock.runExclusive(async () => {
				claim(lightProperty.id, lightIdentity);
				order.push('light reserved');
				release();
				await claims.refresh();
			});
			completeWrite.resume();
			await expect(write).resolves.toMatchObject({ success: true });
			await acquisition;
			expect(order).toEqual(['light written', 'light reserved']);
			await expect(service.dispatchBatch([light])).rejects.toThrow('reserved');
			expect(platform.processBatch).toHaveBeenCalledTimes(1);
		});

		it.each(['not-ready', 'paused-refresh', 'failed-refresh', 'epoch-change'])(
			'dispatches an unrelated output with a pre-await entry during %s',
			async (state) => {
				if (state === 'not-ready') claims.invalidate();
				const entry = PropertyCommandEntrySnapshot.capture(windows, () => undefined, false, admission.capture());
				let complete: (value: VirtualThermostatActuatorClaimEntity[]) => void;
				let refreshing: Promise<void> | undefined;
				claims.invalidate();
				if (state === 'paused-refresh') {
					readClaims.mockImplementationOnce(
						() =>
							new Promise<VirtualThermostatActuatorClaimEntity[]>((resolve) => {
								complete = resolve;
							}),
					);
					refreshing = claims.refresh();
				} else if (state === 'failed-refresh') {
					readClaims.mockRejectedValueOnce(new Error('catalog unavailable'));
					await expect(claims.refresh()).rejects.toThrow('catalog unavailable');
				} else if (state === 'epoch-change') await claims.refresh();
				try {
					await expect(service.dispatchBatch([update()], { commandEntry: entry })).resolves.toEqual({ success: true });
					expect(platform.processBatch).toHaveBeenCalledTimes(1);
					expect(admission.capture().isCurrent()).toBe(state === 'epoch-change');
				} finally {
					entry.dispose();
					if (refreshing !== undefined) {
						complete([]);
						await refreshing;
					}
				}
			},
		);

		it.each([false, true])(
			'dispatches an unclaimed switch when the provider offers no prepared batch (optional method: %s)',
			async (hasMethod) => {
				sourceProperty.category = PropertyCategory.ON;
				try {
					if (hasMethod)
						platform.prepareCompositeBatch = jest.fn((_updates: IDevicePropertyData[]) => Promise.resolve(null));
					await expect(service.dispatchBatch([update()])).resolves.toEqual({ success: true });
					expect(platform.processBatch).toHaveBeenCalledTimes(1);
				} finally {
					delete sourceProperty.category;
				}
			},
		);

		it('rejects claimable outputs and by-property aliases during reconciliation', async () => {
			claim(sourceProperty.id);
			await claims.refresh();
			claims.invalidate();
			expect(claims.requiresGuardedDispatch(update())).toBe(true);
			await expect(service.dispatchBatch([update()])).rejects.toThrow('reconciling');
			await expect(service.dispatchBatch([relay()])).rejects.toThrow('reconciling');
			expect(platform.processBatch).not.toHaveBeenCalled();
		});

		it('rejects an alias whose canonical source is claimable during reconciliation', async () => {
			sources.set(sourceProperty.id, relayProperty.id);
			claims.invalidate();
			await expect(service.dispatchBatch([update()])).rejects.toThrow('reconciling');
			expect(platform.processBatch).not.toHaveBeenCalled();
		});

		it('rejects an ordinary mixed batch before any unrelated output is sent', async () => {
			claims.invalidate();
			await expect(service.dispatchBatch([update(), relay()])).rejects.toThrow('reconciling');
			expect(platform.processBatch).not.toHaveBeenCalled();
		});

		it('revokes a captured property alias even after its old claim disappears', async () => {
			claim(sourceProperty.id);
			await claims.refresh();
			const entry = PropertyCommandEntrySnapshot.capture(windows, () => undefined, false, admission.capture());
			rows = [];
			claims.invalidate();
			await claims.refresh();
			try {
				await expect(service.dispatchBatch([update()], { commandEntry: entry })).rejects.toThrow('changed or expired');
				expect(platform.processBatch).not.toHaveBeenCalled();
			} finally {
				entry.dispose();
			}
		});

		it('rejects a newly claimed property alias after capturing unrelated absence', async () => {
			const entry = PropertyCommandEntrySnapshot.capture(windows, () => undefined, false, admission.capture());
			properties.findOne.mockImplementationOnce(async () => {
				claim(sourceProperty.id);
				await claims.refresh();
				return sourceProperty;
			});
			try {
				await expect(service.dispatchBatch([update()], { commandEntry: entry })).rejects.toThrow('reserved');
				expect(platform.processBatch).not.toHaveBeenCalled();
			} finally {
				entry.dispose();
			}
		});

		it('rejects a claimable capture after catalog epochs change during metadata awaits', async () => {
			const entry = PropertyCommandEntrySnapshot.capture(windows, () => undefined, false, admission.capture());
			properties.findOne.mockImplementationOnce(async () => {
				claims.invalidate();
				await claims.refresh();
				return relayProperty;
			});
			try {
				await expect(service.dispatchBatch([relay()], { commandEntry: entry })).rejects.toThrow('changed or expired');
				expect(platform.processBatch).not.toHaveBeenCalled();
			} finally {
				entry.dispose();
			}
		});

		it.each([false, true])('fences a queued claimable send after new ownership (composite: %s)', async (composite) => {
			let queued: () => void, release: () => void;
			const ready = new Promise<void>((resolve) => {
				queued = resolve;
			});
			const barrier = new Promise<void>((resolve) => {
				release = resolve;
			});
			const actualSend = jest.fn();
			platform.prepareCompositeBatch = jest.fn((updates) =>
				Promise.resolve({
					updates,
					isCurrent: () => true,
					dispatch: async (guard) => {
						queued();
						await barrier;
						if (!guard()) return false;
						actualSend();
						return true;
					},
				}),
			);
			if (composite)
				composites.register({
					canHandle: (property) => property.id === sourceProperty.id,
					plan: () =>
						Promise.resolve({
							revision: 1,
							isCurrent: () => Promise.resolve(true),
							children: [{ memberId: 'relay', update: relay() }],
						}),
				});
			const command = service.dispatchBatch([composite ? update() : relay()], { ttlMs: 1000 });
			await ready;
			claim();
			await claims.refresh();
			release();
			await expect(command).resolves.toMatchObject({ success: false });
			expect(actualSend).not.toHaveBeenCalled();
		});

		it('confirms unrelated composite members while claimable members remain closed', async () => {
			claims.invalidate();
			const aggregate = { ...sourceProperty, id: 'aggregate' } as ChannelPropertyEntity;
			composites.register({
				canHandle: (property) => property.id === aggregate.id,
				plan: () =>
					Promise.resolve({
						revision: 1,
						isCurrent: () => Promise.resolve(true),
						children: [
							{ memberId: 'unrelated', update: update() },
							{ memberId: 'relay', update: relay() },
						],
					}),
			});
			const sent: string[] = [];
			platform.prepareCompositeBatch = jest.fn((updates) =>
				Promise.resolve({
					updates,
					isCurrent: () => true,
					dispatch: (guard) => {
						if (!guard()) return Promise.resolve(false);
						for (const leaf of updates) {
							sent.push(leaf.property.id);
							windows.confirm(
								{ canonicalPropertyId: leaf.property.id, generation: windows.peekGeneration(leaf.property.id) },
								{ value: leaf.value, receivedAt: Date.now() },
							);
						}
						return Promise.resolve(true);
					},
				}),
			);
			const result = await service.dispatchBatch([{ ...update(), property: aggregate }], { ttlMs: 1000 });
			expect(result.composite).toMatchObject({
				status: 'partial',
				children: [
					{ memberId: 'unrelated', status: 'confirmed' },
					{ memberId: 'relay', status: 'failed' },
				],
			});
			expect(sent).toEqual([sourceProperty.id]);
		});

		it('rejects stale registry membership even if the same guard is removed and re-added', async () => {
			const guard = { assertAllowed: () => Promise.resolve() };
			const unregister = admission.register(guard);
			const entry = PropertyCommandEntrySnapshot.capture(windows, () => undefined, false, admission.capture());
			unregister();
			admission.register(guard);
			try {
				await expect(service.dispatchBatch([update()], { commandEntry: entry })).resolves.toMatchObject({
					success: false,
				});
				expect(platform.processBatch).not.toHaveBeenCalled();
			} finally {
				entry.dispose();
			}
		});
	});
});
