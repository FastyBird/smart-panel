import { DataSource } from 'typeorm';

import { Injectable, Logger } from '@nestjs/common';

import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import {
	VirtualThermostatActuatorClaimEntity,
	VirtualThermostatConfigEntity,
} from '../entities/virtual-thermostat.entity';
import {
	ThermostatAuthoringContextModel,
	ThermostatSafetyExtensionModel,
} from '../models/thermostat-authoring-context.model';

import { listThermostatProtectionSources } from './thermostat-protection-source.utils';
import { ThermostatSafetyCatalog } from './thermostat-safety-catalog.service';
import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { thermostatActuatorIdentity } from './virtual-thermostat-contract.utils';

/** Catalog review only: this service never calls a device or promotes metadata to sample/qualification authority. */
@Injectable()
export class ThermostatAuthoringContextService {
	private readonly logger = new Logger(ThermostatAuthoringContextService.name);

	constructor(
		private readonly database: DataSource,
		private readonly lock: DeviceStructureLockService,
		private readonly graph: VirtualDependencyGraphService,
		private readonly catalog: ThermostatSafetyCatalog,
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
			safety_extensions: [],
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
			if (!identity) reasons.push('unsupported_actuator');
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
			const sources = reasons.length ? [] : await listThermostatProtectionSources(manager);
			const target = { device, channel, property };
			const offers = reasons.length ? [] : this.catalog.offers(target);
			const safetyExtensions: ThermostatSafetyExtensionModel[] = [];
			for (const offer of offers) {
				const extension = this.catalog.get(offer.id);
				if (!extension || extension.offer !== offer) continue;
				try {
					const detail = await extension.describe(manager, target, sources);
					if (this.catalog.get(offer.id) === extension) safetyExtensions.push({ ...offer, ...detail });
				} catch (error) {
					this.logger.warn(`Could not read setup metadata for thermostat safety profile ${offer.id}`, error);
					if (this.catalog.get(offer.id) === extension)
						safetyExtensions.push({
							...offer,
							candidates: [],
							device_hardware_id: null,
							firmware: null,
							switch_configuration_json: null,
							reasons: ['safety_extension_metadata_unavailable'],
						});
				}
			}
			const withInstallation = safetyExtensions.filter(({ installation_path }) => installation_path);
			let metadata: ThermostatSafetyExtensionModel | null = null;
			if (claim) {
				metadata = withInstallation.find((extension) => extension.id === claim.providerProfile) ?? null;
			} else if (withInstallation.length === 1) {
				metadata = withInstallation[0];
			}

			const revision = await this.graph.revision();
			return {
				physical_identity: identity ?? propertyId,
				configuration_revision: config?.revision ?? null,
				claim_revision: claim?.revision ?? null,
				graph_revision: revision,
				candidates: sources.map((source) => ({
					property: source.property.id,
					physical_property: source.leaf.id,
					name: source.property.name ?? source.property.id,
					fingerprint: source.fingerprint,
					snapshot: null,
				})),
				safety_extensions: safetyExtensions,
				device_hardware_id: metadata?.device_hardware_id ?? null,
				firmware: metadata?.firmware ?? null,
				switch_configuration_json: metadata?.switch_configuration_json ?? null,
				reasons,
			};
		});
	}
}
