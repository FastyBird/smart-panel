import { Injectable } from '@nestjs/common';

import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DEVICES_HOMEY_TYPE } from '../devices-homey.constants';
import {
	HomeyInventoryAdoptionFilter,
	HomeyInventoryAvailabilityFilter,
	HomeyInventorySupportFilter,
	ListHomeyDevicesQueryDto,
} from '../dto/list-homey-devices.dto';
import { HomeyDeviceEntity } from '../entities/devices-homey.entity';
import { HomeyInventoryDeviceNotFoundError, HomeyInventoryUnavailableError } from '../errors/homey-inventory.error';
import { HomeyMappingLoaderService } from '../mappings/mapping-loader.service';
import {
	HomeyMappingConflict,
	HomeyMappingResolution,
	ResolvedHomeyChannelMapping,
	ResolvedHomeyDeviceMapping,
	ResolvedHomeyPropertyBinding,
} from '../mappings/mapping.types';
import { HomeyDevice } from '../models/homey-device.model';
import {
	HomeyCapabilitySummaryModel,
	HomeyDeviceSupportReason,
	HomeyDeviceSupportState,
	HomeyInventoryDeviceModel,
} from '../models/inventory.model';

import { HomeyService } from './homey.service';

@Injectable()
export class HomeyDeviceInventoryService {
	constructor(
		private readonly homeyService: HomeyService,
		private readonly devicesService: DevicesService,
		private readonly mappingLoader: HomeyMappingLoaderService,
	) {}

	async findAll(query: ListHomeyDevicesQueryDto = {}): Promise<HomeyInventoryDeviceModel[]> {
		const snapshot = this.requireSnapshot();
		const adoptedByIdentifier = await this.getAdoptedByIdentifier();

		return snapshot
			.map((device) => this.toInventoryDevice(device, adoptedByIdentifier.get(device.id) ?? null))
			.filter((device) => this.matchesFilters(device, query))
			.sort((left, right) => this.compareDevices(left, right));
	}

	async findOne(deviceId: string): Promise<HomeyInventoryDeviceModel> {
		const device = this.requireSnapshot().find((candidate) => candidate.id === deviceId);

		if (!device) {
			throw new HomeyInventoryDeviceNotFoundError();
		}

		const adoptedByIdentifier = await this.getAdoptedByIdentifier();

		return this.toInventoryDevice(device, adoptedByIdentifier.get(device.id) ?? null);
	}

	private requireSnapshot(): readonly HomeyDevice[] {
		const snapshot = this.homeyService.getInventorySnapshot();

		if (!snapshot) {
			throw new HomeyInventoryUnavailableError();
		}

		return snapshot;
	}

	private async getAdoptedByIdentifier(): Promise<Map<string, HomeyDeviceEntity>> {
		const adopted = await this.devicesService.findAll<HomeyDeviceEntity>(DEVICES_HOMEY_TYPE);
		const byIdentifier = new Map<string, HomeyDeviceEntity>();

		for (const device of [...adopted].sort((left, right) => this.compareText(left.id, right.id))) {
			if (device.identifier !== null && !byIdentifier.has(device.identifier)) {
				byIdentifier.set(device.identifier, device);
			}
		}

		return byIdentifier;
	}

	private toInventoryDevice(device: HomeyDevice, adoptedDevice: HomeyDeviceEntity | null): HomeyInventoryDeviceModel {
		const deviceResolution = this.mappingLoader.resolveDeviceMappings(device);
		const channelResolution = this.mappingLoader.resolveChannelMappings(device);
		const propertyResolution = this.mappingLoader.resolvePropertyMappings(device);
		const supportReasons = this.getSupportReasons(deviceResolution, channelResolution, propertyResolution);
		const inventoryDevice = new HomeyInventoryDeviceModel();

		inventoryDevice.id = device.id;
		inventoryDevice.name = device.name;
		inventoryDevice.class = device.class;
		inventoryDevice.zoneId = device.zoneId;
		inventoryDevice.zoneName = device.zoneName;
		inventoryDevice.zonePath = [...device.zonePath];
		inventoryDevice.available = device.available;
		inventoryDevice.driverId = device.driverId;
		inventoryDevice.manufacturer = device.manufacturer;
		inventoryDevice.model = device.model;
		inventoryDevice.capabilities = [...device.capabilities]
			.sort((left, right) => this.compareText(left.id, right.id))
			.map((capability) => {
				const summary = new HomeyCapabilitySummaryModel();
				summary.id = capability.id;
				summary.baseId = capability.baseId;
				summary.type = capability.type;
				summary.unit = capability.unit;
				summary.readable = capability.readable;
				summary.writable = capability.writable;
				summary.available = capability.available;

				return summary;
			});
		inventoryDevice.supportReasons = supportReasons;
		inventoryDevice.supportState = this.getSupportState(supportReasons);
		inventoryDevice.suggestedCategory = deviceResolution.mappings[0]?.deviceCategory ?? null;
		inventoryDevice.adopted = adoptedDevice !== null;
		inventoryDevice.adoptedDeviceId = adoptedDevice?.id ?? null;

		return inventoryDevice;
	}

	private getSupportReasons(
		deviceResolution: HomeyMappingResolution<ResolvedHomeyDeviceMapping>,
		channelResolution: HomeyMappingResolution<ResolvedHomeyChannelMapping>,
		propertyResolution: HomeyMappingResolution<ResolvedHomeyPropertyBinding>,
	): HomeyDeviceSupportReason[] {
		const reasons: HomeyDeviceSupportReason[] = [];
		const deviceConflict = this.hasBlockingConflict(deviceResolution.conflicts);

		if (deviceConflict) {
			reasons.push(HomeyDeviceSupportReason.DEVICE_MAPPING_CONFLICT);
		} else if (deviceResolution.mappings.length === 0) {
			reasons.push(HomeyDeviceSupportReason.NO_DEVICE_MAPPING);
			return reasons;
		}

		if (this.hasBlockingConflict(channelResolution.conflicts)) {
			reasons.push(HomeyDeviceSupportReason.CHANNEL_MAPPING_CONFLICT);
		} else if (channelResolution.mappings.length === 0) {
			reasons.push(HomeyDeviceSupportReason.NO_CHANNEL_MAPPING);
		}

		if (this.hasBlockingConflict(propertyResolution.conflicts)) {
			reasons.push(HomeyDeviceSupportReason.PROPERTY_MAPPING_CONFLICT);
		} else if (propertyResolution.mappings.length === 0) {
			reasons.push(HomeyDeviceSupportReason.NO_PROPERTY_MAPPING);
		}

		return reasons;
	}

	private hasBlockingConflict(conflicts: readonly HomeyMappingConflict[]): boolean {
		return conflicts.some((conflict) => conflict.policy === 'error');
	}

	private getSupportState(reasons: readonly HomeyDeviceSupportReason[]): HomeyDeviceSupportState {
		if (reasons.length === 0) {
			return HomeyDeviceSupportState.SUPPORTED;
		}

		return reasons.some((reason) => reason.endsWith('_conflict'))
			? HomeyDeviceSupportState.CONFLICTED
			: HomeyDeviceSupportState.UNSUPPORTED;
	}

	private matchesFilters(device: HomeyInventoryDeviceModel, query: ListHomeyDevicesQueryDto): boolean {
		if (!this.matchesSupportFilter(device.supportState, query.support)) {
			return false;
		}

		if (query.adoption === HomeyInventoryAdoptionFilter.ADOPTED && !device.adopted) {
			return false;
		}
		if (query.adoption === HomeyInventoryAdoptionFilter.NOT_ADOPTED && device.adopted) {
			return false;
		}

		if (query.availability === HomeyInventoryAvailabilityFilter.AVAILABLE && !device.available) {
			return false;
		}
		if (query.availability === HomeyInventoryAvailabilityFilter.UNAVAILABLE && device.available) {
			return false;
		}

		if (query.zoneId !== undefined && device.zoneId !== query.zoneId) {
			return false;
		}
		if (query.deviceClass !== undefined && device.class !== query.deviceClass) {
			return false;
		}

		const search = query.search?.trim().toLowerCase();
		if (!search) {
			return true;
		}

		return [
			device.id,
			device.name,
			device.class,
			device.zoneName,
			device.manufacturer,
			device.model,
			...device.zonePath,
		].some((value) => value?.toLowerCase().includes(search) === true);
	}

	private matchesSupportFilter(
		state: HomeyDeviceSupportState,
		filter: HomeyInventorySupportFilter | undefined,
	): boolean {
		switch (filter) {
			case HomeyInventorySupportFilter.SUPPORTED:
				return state === HomeyDeviceSupportState.SUPPORTED;
			case HomeyInventorySupportFilter.UNSUPPORTED:
				return state === HomeyDeviceSupportState.UNSUPPORTED;
			case HomeyInventorySupportFilter.CONFLICTED:
				return state === HomeyDeviceSupportState.CONFLICTED;
			default:
				return true;
		}
	}

	private compareDevices(left: HomeyInventoryDeviceModel, right: HomeyInventoryDeviceModel): number {
		return (
			this.compareText(left.name.toLowerCase(), right.name.toLowerCase()) ||
			this.compareText(left.name, right.name) ||
			this.compareText(left.id, right.id)
		);
	}

	private compareText(left: string, right: string): number {
		return left < right ? -1 : left > right ? 1 : 0;
	}
}
