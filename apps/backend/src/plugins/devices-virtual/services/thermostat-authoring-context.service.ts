import { DataSource } from 'typeorm';

import { Injectable } from '@nestjs/common';

import { PropertyCategory } from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { PlatformRegistryService } from '../../../modules/devices/services/platform.registry.service';
import { ShellyNgDeviceEntity } from '../../devices-shelly-ng/entities/devices-shelly-ng.entity';
import { ShellyNgDevicePlatform } from '../../devices-shelly-ng/platforms/shelly-ng.device.platform';
import {
	VirtualThermostatActuatorClaimEntity,
	VirtualThermostatConfigEntity,
} from '../entities/virtual-thermostat.entity';
import { VirtualTransformSourceEntity } from '../entities/virtual-transform.entity';
import {
	ThermostatAuthoringContextModel,
	ThermostatProtectionCandidateModel,
} from '../models/thermostat-authoring-context.model';

import { resolveThermostatProtectionSource } from './thermostat-protection-source.utils';
import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { thermostatActuatorIdentity } from './virtual-thermostat-contract.utils';

/** Catalog review only: this service never calls a device or promotes metadata to sample/qualification authority. */
@Injectable()
export class ThermostatAuthoringContextService {
	constructor(
		private readonly database: DataSource,
		private readonly lock: DeviceStructureLockService,
		private readonly graph: VirtualDependencyGraphService,
		private readonly platforms: PlatformRegistryService,
	) {}
	async forClaim(claimId: string): Promise<ThermostatAuthoringContextModel> {
		const claim = await this.database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { id: claimId });
		if (claim.sourcePropertyId) return this.read(claim.sourcePropertyId, claimId);
		return {
			physical_identity: claim.physicalIdentity,
			configuration_revision: null,
			claim_revision: claim.revision,
			graph_revision: await this.graph.revision(),
			candidates: [],
			device_hardware_id: null,
			firmware: null,
			switch_configuration_json: null,
			reasons: ['retained_actuator_missing'],
		};
	}
	async read(propertyId: string, claimId?: string): Promise<ThermostatAuthoringContextModel> {
		return this.lock.runShared(async () => {
			const manager = this.database.manager;
			const property = await manager.findOneOrFail(ChannelPropertyEntity, {
				where: { id: propertyId },
				relations: ['channel', 'channel.device'],
			});
			const channel = property.channel as ChannelEntity,
				device = channel.device as DeviceEntity;
			const identity = thermostatActuatorIdentity(property, channel, device);
			const reasons: string[] = [];
			if (!identity || !(device instanceof ShellyNgDeviceEntity)) reasons.push('unsupported_guarded_actuator');
			const claim = claimId
				? await manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { id: claimId })
				: null;
			const config = claim
				? await manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: claim.controllerId })
				: null;
			if (
				claim &&
				(claim.sourcePropertyId !== propertyId || claim.physicalIdentity !== identity || claim.state === 'released')
			)
				reasons.push('claim_identity_changed');
			const candidates: ThermostatProtectionCandidateModel[] = [];
			if (!reasons.length) {
				const properties = await manager
					.createQueryBuilder(ChannelPropertyEntity, 'property')
					.leftJoin('property.channel', 'channel')
					.leftJoin('channel.device', 'device')
					.leftJoin(VirtualTransformSourceEntity, 'transform', 'transform.outputPropertyId = property.id')
					.leftJoin(ChannelPropertyEntity, 'leaf', 'leaf.id = transform.sourcePropertyId')
					.leftJoin('leaf.channel', 'leafChannel')
					.leftJoin('leafChannel.device', 'leafDevice')
					.where('property.category = :category', { category: PropertyCategory.TEMPERATURE })
					.andWhere('(device.canonicalMac = :mac OR leafDevice.canonicalMac = :mac)', {
						mac: (device as ShellyNgDeviceEntity).canonicalMac,
					})
					.orderBy('property.id', 'ASC')
					.take(129)
					.getMany();
				if (properties.length > 128) reasons.push('source_catalog_limit_exceeded');
				else
					for (const input of properties) {
						try {
							const source = await resolveThermostatProtectionSource(manager, input.id, identity);
							if (!source.enabled) continue;
							candidates.push({
								property: input.id,
								physical_property: source.leaf.id,
								name: input.name ?? input.id,
								fingerprint: source.fingerprint,
								snapshot: source.metadata.installationSnapshot
									? {
											component: source.metadata.componentKey,
											configuration: source.metadata.installationSnapshot.configuration,
											peripherals: source.metadata.installationSnapshot.peripherals,
											domain: source.domain,
											calibration: source.transform?.policy ?? null,
										}
									: null,
							});
						} catch {
							/* Ineligible sources are never offered as compatible choices. */
						}
					}
			}
			if (!candidates.length) reasons.push('no_qualified_local_protective_source');
			const platform = this.platforms.get(device);
			const component = /^switch:(\d+)$/.exec(channel.identifier ?? '');
			const metadata =
				platform instanceof ShellyNgDevicePlatform && device instanceof ShellyNgDeviceEntity && component
					? platform.captureThermostatSetupMetadata(device, Number(component[1]))
					: null;
			if (!metadata?.isCurrent()) reasons.push('current_switch_catalog_unavailable');
			const revision = await this.graph.revision();
			return {
				physical_identity: identity ?? propertyId,
				configuration_revision: config?.revision ?? null,
				claim_revision: claim?.revision ?? null,
				graph_revision: revision,
				candidates,
				device_hardware_id: metadata?.isCurrent() ? metadata.device_hardware_id : null,
				firmware: metadata?.isCurrent() ? metadata.firmware : null,
				switch_configuration_json: metadata?.isCurrent() ? metadata.switch_configuration_json : null,
				reasons,
			};
		});
	}
}
