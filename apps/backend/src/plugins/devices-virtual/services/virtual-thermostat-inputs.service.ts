import { DataSource } from 'typeorm';

import { Injectable, Optional } from '@nestjs/common';

import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { QualifiedPropertySample } from '../../../modules/devices/models/property-sample.model';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { VirtualDeviceMode } from '../entities/devices-virtual.entity';
import { VirtualThermostatSourceEntity } from '../entities/virtual-thermostat.entity';
import { VirtualTransformConfigEntity, VirtualTransformSourceEntity } from '../entities/virtual-transform.entity';

import { VirtualAggregateRuntimeService } from './virtual-aggregate-runtime.service';
import { thermostatFingerprint, thermostatPropertyContract } from './virtual-thermostat-contract.utils';

export interface ThermostatInputBinding {
	binding: VirtualThermostatSourceEntity;
	property: ChannelPropertyEntity | null;
	compatible: boolean;
	producerRevision: number | null;
}
export interface ThermostatInputFrame {
	ambient: number | null;
	floor: number | null;
	ambientSample: QualifiedPropertySample | null;
	floorSample: QualifiedPropertySample | null;
	basis: string;
	contacts: { id: string; basis: string; value: 'open' | 'closed' | null }[];
}

@Injectable()
export class VirtualThermostatInputsService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly values: PropertyValueService,
		@Optional() private readonly aggregate?: VirtualAggregateRuntimeService,
	) {}
	async load(rows: VirtualThermostatSourceEntity[]): Promise<ThermostatInputBinding[]> {
		const result: ThermostatInputBinding[] = [];
		for (const binding of rows) {
			const property = binding.sourcePropertyId
				? await this.dataSource.manager.findOne(ChannelPropertyEntity, {
						where: { id: binding.sourcePropertyId },
						relations: ['channel', 'channel.device'],
					})
				: null;
			let compatible = false,
				producerRevision: number | null = null;
			if (property) {
				const channel = property.channel as ChannelEntity,
					device = channel.device as DeviceEntity & { mode?: VirtualDeviceMode };
				let fingerprint = thermostatPropertyContract(property, channel, device);
				if (device.mode === VirtualDeviceMode.SENSOR_TRANSFORM) {
					const config = await this.dataSource.manager.findOneBy(VirtualTransformConfigEntity, {
						outputPropertyId: property.id,
					});
					const source = await this.dataSource.manager.findOneBy(VirtualTransformSourceEntity, {
						outputPropertyId: property.id,
					});
					if (config && source?.sourcePropertyId && config.quantity === 'temperature' && config.unit === '°C') {
						producerRevision = config.revision;
						fingerprint = thermostatFingerprint({
							output: fingerprint,
							transformRevision: config.revision,
							transformPolicy: config.policy,
							physicalIdentity: `property:${source.sourcePropertyIdentity}`,
							sourceQuantity: source.quantity,
							sourceUnit: source.unit,
						});
					} else fingerprint = '';
				}
				compatible = fingerprint === binding.contractFingerprint && device.enabled;
			}
			result.push({ binding, property, compatible, producerRevision });
		}
		return result;
	}
	read(bindings: readonly ThermostatInputBinding[], now = Date.now()): ThermostatInputFrame {
		let ambientSample: QualifiedPropertySample | null = null,
			floorSample: QualifiedPropertySample | null = null;
		let basis = '';
		const contacts: ThermostatInputFrame['contacts'] = [];
		for (const { binding, property, compatible, producerRevision } of bindings) {
			const sample =
				compatible && property
					? this.values.readQualifiedSample(property, binding.maximumAgeSeconds * 1000, new Date(now))
					: null;
			const qualified = sample && (producerRevision === null || sample.revision === producerRevision) ? sample : null;
			if (binding.role === 'contact')
				contacts.push({
					id: binding.id,
					basis: binding.contractFingerprint,
					value:
						qualified?.value === binding.openValue
							? 'open'
							: qualified?.value === binding.closedValue
								? 'closed'
								: null,
				});
			else if (binding.role === 'floor') floorSample = typeof qualified?.value === 'number' ? qualified : null;
			else {
				ambientSample = typeof qualified?.value === 'number' ? qualified : null;
				const membership = property
					? this.aggregate
							?.readDiagnostics(property.id)
							?.inputs.filter((input) => input.exclusion === null)
							.map((input) => input.id)
							.sort()
					: null;
				basis = thermostatFingerprint({
					binding: binding.id,
					contract: binding.contractFingerprint,
					revision: sample?.revision,
					quality: sample?.quality,
					membership,
				});
			}
		}
		return {
			ambient: (ambientSample?.value as number) ?? null,
			floor: (floorSample?.value as number) ?? null,
			ambientSample,
			floorSample,
			basis,
			contacts,
		};
	}
}
