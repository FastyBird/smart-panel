import { Injectable, Logger } from '@nestjs/common';

import { DeviceHiddenFilter } from '../../../modules/devices/devices.constants';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { HomeKitDeviceCandidateModel } from '../models/bridge-candidate.model';

import { HomeKitBridgeService } from './homekit-bridge.service';
import { HomeKitMapperRegistryService } from './homekit-mapper-registry.service';

@Injectable()
export class HomeKitWizardService {
	private readonly logger = new Logger(HomeKitWizardService.name);

	constructor(
		private readonly devicesService: DevicesService,
		private readonly mapperRegistry: HomeKitMapperRegistryService,
		private readonly bridgeService: HomeKitBridgeService,
	) {}

	async getCandidates(): Promise<HomeKitDeviceCandidateModel[]> {
		this.logger.debug('Fetching device candidates for HomeKit mapping');

		const devices = await this.devicesService.findAll(undefined, DeviceHiddenFilter.FALSE);
		const mappedSet = new Set(this.bridgeService.getConfig().mappedDeviceIds);

		return devices.map((device) => {
			const mapper = this.mapperRegistry.findMapper(device);
			const isCompatible = mapper !== null;
			const suggestedServiceType = isCompatible ? mapper.getSuggestedServiceType(device) : null;
			const isMapped = mappedSet.has(device.id);

			const candidate = new HomeKitDeviceCandidateModel();
			candidate.id = device.id;
			candidate.name = device.name;
			candidate.category = device.category;
			candidate.roomId = device.roomId ?? (device.room ? device.room.id : null);
			candidate.roomName = device.room ? device.room.name : null;
			candidate.isCompatible = isCompatible;
			candidate.suggestedServiceType = suggestedServiceType;
			candidate.isMapped = isMapped;
			candidate.channelsCount = device.channels?.length ?? 0;

			return candidate;
		});
	}

	async mapDevices(deviceIds: string[]): Promise<void> {
		this.logger.log(`Updating mapped HomeKit devices: count=${deviceIds.length}`);
		await this.bridgeService.updateMappedDevices(deviceIds);
	}
}
