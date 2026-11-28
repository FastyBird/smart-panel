import { EntityManager } from 'typeorm';

import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { DataTypeType, PermissionType, PropertyCategory } from '../../../modules/devices/devices.constants';
import { DevicesValidationException } from '../../../modules/devices/devices.exceptions';
import { ChannelEntity } from '../../../modules/devices/entities/devices.entity';
import { PlatformRegistryService } from '../../../modules/devices/services/platform.registry.service';
import { permissionSatisfied } from '../../../modules/devices/utils/property-permissions.utils';
import { ThermostatProtectionSource } from '../../devices-virtual/services/thermostat-protection-source.utils';
import {
	ThermostatSafetyAuthoringDetails,
	ThermostatSafetyCatalog,
	ThermostatSafetyExtension,
	ThermostatTarget,
} from '../../devices-virtual/services/thermostat-safety-catalog.service';
import { SHELLY_GUARDED_PROFILE, SHELLY_GUARDED_PROFILE_VERSION } from '../contracts/thermostat-actuation.constants';
import { DEVICES_SHELLY_NG_PLUGIN_PREFIX } from '../devices-shelly-ng.constants';
import {
	ShellyNgChannelEntity,
	ShellyNgChannelPropertyEntity,
	ShellyNgDeviceEntity,
} from '../entities/devices-shelly-ng.entity';
import { ThermostatInstallationEntity } from '../entities/thermostat-installation.entity';
import { ShellyNgDevicePlatform } from '../platforms/shelly-ng.device.platform';

import { REMOTE_DEW_POINT_PROFILE } from './remote-dew-point-lease.contract';
import { qualifyShellyProtectionSource } from './shelly-thermostat-protection-source';

@Injectable()
export class ShellyThermostatSafetyCatalog implements OnModuleInit, OnModuleDestroy {
	private readonly unregister: (() => void)[] = [];

	constructor(
		private readonly catalog: ThermostatSafetyCatalog,
		private readonly platforms: PlatformRegistryService,
	) {}

	onModuleInit(): void {
		const supports = ({ device, channel, property }: ThermostatTarget) =>
			device instanceof ShellyNgDeviceEntity &&
			/^[0-9a-f]{12}$/i.test(device.canonicalMac ?? '') &&
			channel instanceof ShellyNgChannelEntity &&
			/^switch:(0|[1-9]\d*)$/.test(channel.identifier ?? '') &&
			property instanceof ShellyNgChannelPropertyEntity &&
			property.category === PropertyCategory.ON &&
			property.dataType === DataTypeType.BOOL &&
			permissionSatisfied(PermissionType.READ_ONLY, new Set(property.permissions ?? [])) &&
			permissionSatisfied(PermissionType.WRITE_ONLY, new Set(property.permissions ?? [])) &&
			['output', 'on'].includes(property.identifier);
		const describe: ThermostatSafetyExtension['describe'] = (manager, target, sources) =>
			this.describe(manager, target, sources);
		const guarded: ThermostatSafetyExtension = {
			qualificationTables: ['devices_shelly_ng_sample_sources'],
			offer: {
				id: SHELLY_GUARDED_PROFILE,
				version: SHELLY_GUARDED_PROFILE_VERSION,
				name: 'Shelly guarded switch',
				roles: ['heating', 'cooling'],
				requires_cooling_protection: false,
				installation_path: `/plugins/${DEVICES_SHELLY_NG_PLUGIN_PREFIX}/producers/thermostat-installations`,
			},
			supports,
			describe,
			qualifySource: qualifyShellyProtectionSource,
			installedFloor: async (manager, claimId) => {
				const installation = await manager.findOneBy(ThermostatInstallationEntity, { claimId });
				return installation?.setup.formatVersion === 2 && Number.isFinite(installation.setup.installedFloorCeilingC)
					? { ceiling: installation.setup.installedFloorCeilingC, revision: installation.revision }
					: null;
			},
		};
		this.unregister.push(this.catalog.register(guarded));
		this.unregister.push(
			this.catalog.register({
				offer: {
					id: REMOTE_DEW_POINT_PROFILE,
					version: 1,
					name: 'Shelly remote dew-point lease',
					roles: ['cooling'],
					requires_cooling_protection: true,
					installation_path: null,
				},
				supports,
				describe,
				qualifySource: qualifyShellyProtectionSource,
			}),
		);
	}

	onModuleDestroy(): void {
		for (const remove of this.unregister.splice(0)) remove();
	}

	private async describe(
		manager: EntityManager,
		target: ThermostatTarget,
		sources: ThermostatProtectionSource[],
	): Promise<ThermostatSafetyAuthoringDetails> {
		const candidates: ThermostatSafetyAuthoringDetails['candidates'] = [];
		for (const software of sources) {
			if (((software.leaf.channel as ChannelEntity).device as ShellyNgDeviceEntity)?.id !== target.device.id) continue;
			try {
				const source = await qualifyShellyProtectionSource(manager, software, target.device.id);
				const snapshot = source.metadata.installationSnapshot;
				candidates.push({
					property: source.property.id,
					physical_property: source.leaf.id,
					name: source.property.name ?? source.property.id,
					fingerprint: source.fingerprint,
					snapshot: snapshot
						? {
								component: source.metadata.componentKey,
								configuration: snapshot.configuration,
								peripherals: snapshot.peripherals,
								domain: source.domain,
								calibration: source.transform?.policy ?? null,
							}
						: null,
				});
			} catch (error) {
				if (!(error instanceof DevicesValidationException)) throw error;
			}
		}
		const platform = this.platforms.get(target.device);
		const component = /^switch:(\d+)$/.exec(target.channel.identifier ?? '');
		const metadata =
			platform instanceof ShellyNgDevicePlatform && target.device instanceof ShellyNgDeviceEntity && component
				? platform.captureThermostatSetupMetadata(target.device, Number(component[1]))
				: null;
		const current = metadata?.isCurrent();
		const reasons: string[] = [];
		if (!candidates.length) reasons.push('no_qualified_local_protective_source');
		if (!current) reasons.push('current_switch_catalog_unavailable');
		return {
			candidates,
			reasons,
			device_hardware_id: current ? metadata.device_hardware_id : null,
			firmware: current ? metadata.firmware : null,
			switch_configuration_json: current ? metadata.switch_configuration_json : null,
		};
	}
}
