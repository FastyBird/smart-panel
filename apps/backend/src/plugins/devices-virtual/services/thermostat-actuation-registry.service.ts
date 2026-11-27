import { Injectable, OnModuleDestroy } from '@nestjs/common';

import { IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import {
	CapturedThermostatReconcileReadinessV1,
	RemoteCoolingFrame,
	SUPERVISED_SWITCH_PROFILE,
	ThermostatActuationAdapter,
	ThermostatProtectiveQualification,
	ThermostatProviderProfile,
} from '../contracts/thermostat-actuation.contract';
import { VirtualThermostatActuatorClaimEntity } from '../entities/virtual-thermostat.entity';

export type InstalledThermostatEvidence = ThermostatProtectiveQualification<object>;

export interface ThermostatActuationExtension {
	readonly profile: ThermostatProviderProfile;
	/** Pin provider-specific physical identity data without opening a session or probing a device. */
	captureTargetMetadata?(target: IDevicePropertyData): { readonly isCurrent: () => boolean } | null;
	qualify(evidence: InstalledThermostatEvidence): InstalledThermostatEvidence;
	allows(claim: VirtualThermostatActuatorClaimEntity, evidence: InstalledThermostatEvidence, opposed: boolean): boolean;
	captureAdapter(
		target: IDevicePropertyData,
		claim: VirtualThermostatActuatorClaimEntity,
		evidence: InstalledThermostatEvidence | null | undefined,
		cooling: (claim: VirtualThermostatActuatorClaimEntity) => RemoteCoolingFrame | null,
	): (ThermostatActuationAdapter<InstalledThermostatEvidence> & { readonly isCurrent?: () => boolean }) | null;
	captureReadiness?(
		target: IDevicePropertyData,
		evidence: InstalledThermostatEvidence,
	): CapturedThermostatReconcileReadinessV1 | null;
}

interface ThermostatActuationRegistration {
	readonly key: string;
	readonly extension: ThermostatActuationExtension;
}

/** The provider owns its registration, including evidence validation and device-side commands. */
@Injectable()
export class ThermostatActuationRegistry implements OnModuleDestroy {
	private readonly extensions = new Map<string, ThermostatActuationRegistration>();
	private destroyed = false;

	register(extension: ThermostatActuationExtension): () => void {
		const { id, version } = extension.profile;
		if (this.destroyed || !id || id === SUPERVISED_SWITCH_PROFILE || !Number.isSafeInteger(version) || version < 1)
			throw new Error('Invalid thermostat safety extension');
		const key = JSON.stringify([id, version]);
		if (this.extensions.has(key)) throw new Error('Thermostat safety extension already registered');
		const registration = Object.freeze({ key, extension });
		this.extensions.set(key, registration);
		return () => {
			if (this.extensions.get(key) === registration) this.extensions.delete(key);
		};
	}

	get(id: string, version: number) {
		return this.extensions.get(JSON.stringify([id, version])) ?? null;
	}

	onModuleDestroy(): void {
		this.destroyed = true;
		this.extensions.clear();
	}
}
