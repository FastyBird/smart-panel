/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/unbound-method */
import { DataTypeType, PermissionType } from '../devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../entities/devices.entity';
import { IDevicePlatform, IDevicePropertyData } from '../platforms/device.platform';

import { ChannelsPropertiesService } from './channels.properties.service';
import { ChannelsService } from './channels.service';
import { DeviceStructureLockService } from './device-structure-lock.service';
import { DevicesService } from './devices.service';
import { PlatformRegistryService } from './platform.registry.service';
import { PropertyCommandDispatchService } from './property-command-dispatch.service';
import { PropertyCommandWindowService } from './property-command-window.service';
import { PropertyStateCoordinatorService } from './property-state-coordinator.service';
import { PropertyValueSourceRegistryService } from './property-value-source.registry.service';

describe('PropertyCommandDispatchService', () => {
	let service: PropertyCommandDispatchService;
	let windows: PropertyCommandWindowService;
	let platform: jest.Mocked<IDevicePlatform>;
	let platformRegistry: jest.Mocked<Pick<PlatformRegistryService, 'get' | 'usesAuthoritativePropertyReadback'>>;
	let valueSourceRegistry: jest.Mocked<Pick<PropertyValueSourceRegistryService, 'resolve'>>;
	let sources: Map<string, string>;
	let properties: jest.Mocked<Pick<ChannelsPropertiesService, 'findOne'>>;

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
		sources = new Map();
		properties = { findOne: jest.fn().mockResolvedValue(sourceProperty) };
		platform = {
			getType: jest.fn().mockReturnValue('mock'),
			process: jest.fn(),
			processBatch: jest.fn().mockResolvedValue(true),
		};

		const channels = { findOne: jest.fn().mockResolvedValue(channel) } as unknown as ChannelsService;
		const devices = { findOne: jest.fn().mockResolvedValue(device) } as unknown as DevicesService;
		platformRegistry = {
			get: jest.fn().mockReturnValue(platform),
			usesAuthoritativePropertyReadback: jest.fn().mockReturnValue(false),
		};
		valueSourceRegistry = {
			resolve: jest.fn((property: ChannelPropertyEntity) => sources.get(property.id) ?? property.id),
		};

		service = new PropertyCommandDispatchService(
			properties as unknown as ChannelsPropertiesService,
			channels,
			devices,
			platformRegistry as unknown as PlatformRegistryService,
			valueSourceRegistry as unknown as PropertyValueSourceRegistryService,
			new DeviceStructureLockService(),
			new PropertyStateCoordinatorService(),
			windows,
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
});
