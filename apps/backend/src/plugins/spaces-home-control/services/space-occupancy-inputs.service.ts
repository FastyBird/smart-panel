import { Injectable } from '@nestjs/common';

import { ChannelCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { DeviceConnectionStateService } from '../../../modules/devices/services/device-connection-state.service';
import { PropertyMetadataService } from '../../../modules/devices/services/property-metadata.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { SpaceOccupancyEntity } from '../entities/space-occupancy.entity';
import { OccupancyObservation, OccupancyStatus } from '../occupancy/space-occupancy.types';

import { SpaceStateReadService } from './space-state-read.service';

export interface OccupancySensor {
	propertyId: string;
	deviceId: string;
	label: string;
}

@Injectable()
export class SpaceOccupancyInputsService {
	constructor(
		private readonly reads: SpaceStateReadService,
		private readonly metadata: PropertyMetadataService,
		private readonly values: PropertyValueService,
		private readonly connectivity: DeviceConnectionStateService,
	) {}

	private async candidates(spaceId: string): Promise<{ sensor: OccupancySensor; property: ChannelPropertyEntity }[]> {
		const devices = await this.reads.findDevicesBySpace(spaceId);
		return devices
			.filter((device) => device.enabled && !device.hidden)
			.flatMap((device) =>
				(device.channels ?? [])
					.filter((channel) => [ChannelCategory.MOTION, ChannelCategory.OCCUPANCY].includes(channel.category))
					.flatMap((channel) =>
						(channel.properties ?? [])
							.filter((property) => property.category === PropertyCategory.DETECTED)
							.map((property) => ({
								property,
								sensor: {
									propertyId: property.id,
									deviceId: device.id,
									label: `${device.name} · ${channel.name ?? channel.category}`,
								},
							})),
					),
			);
	}

	async list(spaceId: string): Promise<OccupancySensor[]> {
		return (await this.candidates(spaceId)).map(({ sensor }) => sensor);
	}

	async capture(row: SpaceOccupancyEntity): Promise<OccupancyObservation> {
		const generation = this.metadata.getGeneration();
		const available = new Map((await this.candidates(row.spaceId)).map((item) => [item.sensor.propertyId, item]));
		const selected = row.sensorPropertyIds.map((id) => available.get(id));
		const read = () => {
			if (this.metadata.getGeneration() !== generation || !selected.length) return OccupancyStatus.UNKNOWN;
			const values = selected.map((item) => {
				if (!item || !this.connectivity.isCurrentlyOnline(item.sensor.deviceId)) return null;
				const sample = this.values.readQualifiedSampleSnapshot(item.property, row.maximumAgeSeconds * 1000, new Date());
				if (!sample || sample.quality !== 'good') return null;
				return sample.value === true || sample.value === 1 || sample.value === 'true'
					? true
					: sample.value === false || sample.value === 0 || sample.value === 'false'
						? false
						: null;
			});
			return values.some((value) => value === true)
				? OccupancyStatus.OCCUPIED
				: values.every((value) => value === false)
					? OccupancyStatus.VACANT
					: OccupancyStatus.UNKNOWN;
		};
		const status = read();
		return { status, isCurrent: () => read() === status };
	}
}
