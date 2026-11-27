import { EntityManager } from 'typeorm';

import { Injectable } from '@nestjs/common';

import { DevicesValidationException } from '../../../modules/devices/devices.exceptions';
import { IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import { SUPERVISED_SWITCH_PROFILE } from '../contracts/thermostat-actuation.contract';
import { VirtualThermostatActuatorClaimEntity } from '../entities/virtual-thermostat.entity';
import { ThermostatProtectionCandidateModel } from '../models/thermostat-authoring-context.model';

import { ThermostatProtectionSource, resolveThermostatProtectionSource } from './thermostat-protection-source.utils';

export type ThermostatTarget = Pick<IDevicePropertyData, 'device' | 'channel' | 'property'>;
type Role = 'heating' | 'cooling';

export interface ThermostatSafetyOffer {
	readonly id: string;
	readonly version: number;
	readonly name: string;
	readonly roles: Role[];
	readonly requires_cooling_protection: boolean;
	readonly installation_path: string | null;
}

export interface ThermostatSafetyAuthoringDetails {
	candidates: ThermostatProtectionCandidateModel[];
	device_hardware_id: string | null;
	firmware: string | null;
	switch_configuration_json: string | null;
	reasons: string[];
}

export interface ThermostatSafetyExtension {
	readonly offer: ThermostatSafetyOffer;
	readonly qualificationTables?: readonly string[];
	supports(target: ThermostatTarget): boolean;
	describe(
		manager: EntityManager,
		target: ThermostatTarget,
		sources: ThermostatProtectionSource[],
	): Promise<ThermostatSafetyAuthoringDetails>;
	qualifySource?(
		manager: EntityManager,
		source: ThermostatProtectionSource,
		actuatorDeviceId: string,
	): Promise<ThermostatProtectionSource>;
	installedFloor?(manager: EntityManager, claimId: string): Promise<{ ceiling: number; revision: number } | null>;
}

@Injectable()
export class ThermostatSafetyCatalog {
	private readonly extensions = new Map<string, ThermostatSafetyExtension>();

	register(extension: ThermostatSafetyExtension): () => void {
		const { id, version } = extension.offer;
		if (!id || id === SUPERVISED_SWITCH_PROFILE || !Number.isSafeInteger(version) || version < 1)
			throw new Error('Invalid thermostat safety extension');
		if (this.extensions.has(id)) throw new Error(`Thermostat safety extension already registered: ${id}`);
		this.extensions.set(id, extension);
		return () => {
			if (this.extensions.get(id) === extension) this.extensions.delete(id);
		};
	}

	invalidatesQualification(table: string): boolean {
		return [...this.extensions.values()].some((extension) => extension.qualificationTables?.includes(table));
	}

	get(id: string): ThermostatSafetyExtension | undefined {
		return this.extensions.get(id);
	}

	offers(target: ThermostatTarget, role?: Role, remoteCooling?: boolean): ThermostatSafetyOffer[] {
		return [...this.extensions.values()]
			.filter(
				(extension) =>
					(!role || extension.offer.roles.includes(role)) &&
					(remoteCooling !== false || !extension.offer.requires_cooling_protection) &&
					extension.supports(target),
			)
			.map(({ offer }) => offer);
	}

	async resolveSource(
		manager: EntityManager,
		sourceId: string,
		claim: VirtualThermostatActuatorClaimEntity,
		purpose: 'floor' | 'surface' = 'floor',
	) {
		const source = await resolveThermostatProtectionSource(manager, sourceId);
		if (claim.providerProfile === SUPERVISED_SWITCH_PROFILE) return source;
		const extension = this.get(claim.providerProfile);
		if (!extension || extension.offer.version !== claim.providerProfileVersion)
			throw new DevicesValidationException('The selected thermostat safety profile is unavailable.');
		if (purpose === 'surface' && !extension.offer.requires_cooling_protection) return source;
		if (extension.qualifySource) {
			if (!claim.sourceDeviceId) throw new DevicesValidationException('Actuator device is missing.');
			return extension.qualifySource(manager, source, claim.sourceDeviceId);
		}
		return source;
	}
}
