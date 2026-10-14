import { Injectable } from '@nestjs/common';

import { QualifiedPropertySample } from '../../../modules/devices/models/property-sample.model';
import { IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import { PlatformRegistryService } from '../../../modules/devices/services/platform.registry.service';
import { ShellyProtectiveCommandResult } from '../../devices-shelly-ng/contracts/protective-switch.contract';
import { ShellyNgDeviceEntity } from '../../devices-shelly-ng/entities/devices-shelly-ng.entity';
import { ShellyNgDevicePlatform } from '../../devices-shelly-ng/platforms/shelly-ng.device.platform';
import { VirtualThermostatActuatorClaimEntity } from '../entities/virtual-thermostat.entity';

import { ThermostatInstalledQualification } from './virtual-thermostat-claims.service';

export interface ThermostatReleaseOrderingEvidence {
	readonly proofId: string;
	readonly physicalIdentity: string;
	readonly connectionIdentity: string;
	readonly coveredCommandIds: readonly string[];
	/** Provider barrier includes all earlier transport aliases and commands, including pre-claim ordinary writers. */
	readonly externalWriterBarrier: true;
	readonly offSample: QualifiedPropertySample;
}
export interface ThermostatActuationAdapter {
	canReconcile(target: IDevicePropertyData, qualification: ThermostatInstalledQualification): boolean;
	send(
		target: IDevicePropertyData,
		claim: VirtualThermostatActuatorClaimEntity,
		qualification: ThermostatInstalledQualification | null,
		isAdmitted: () => boolean,
	): Promise<ShellyProtectiveCommandResult>;
	/** Only tested ordered/correlated or cancellation barriers may return proof; RPC acceptance is insufficient. */
	reconcile(
		target: IDevicePropertyData,
		commandIds: readonly string[],
		off: QualifiedPropertySample,
		isCurrent: () => boolean,
	): Promise<ThermostatReleaseOrderingEvidence | null>;
}

/** Provider seam is internal; no HTTP payload can register an adapter or supply ordering evidence. */
@Injectable()
export class VirtualThermostatTransportService {
	private readonly adapters = new Map<string, ThermostatActuationAdapter>();
	constructor(private readonly platforms: PlatformRegistryService) {}
	register(type: string, adapter: ThermostatActuationAdapter): () => void {
		if (this.adapters.has(type)) throw new Error('Thermostat transport already registered');
		this.adapters.set(type, adapter);
		return () => this.adapters.delete(type);
	}
	get(target: IDevicePropertyData): ThermostatActuationAdapter | null {
		const supplied = this.adapters.get(target.device.type);
		if (supplied) return supplied;
		const platform = this.platforms.get(target.device);
		if (!(platform instanceof ShellyNgDevicePlatform)) return null;
		return {
			// Existing SDK supplies send-time fencing, but not qualified correlated drainage/readback.
			canReconcile: () => false,
			send: (target, claim, qualification, isAdmitted) =>
				target.device instanceof ShellyNgDeviceEntity
					? platform.processProtectiveCommand(
							{ device: target.device, channel: target.channel, property: target.property },
							target.value === true && qualification
								? { on: true, leaseSeconds: claim.leaseSeconds, qualification: qualification.profile }
								: { on: false },
							1000,
							isAdmitted,
						)
					: Promise.resolve({ outcome: 'refused' as const, reasons: ['unsupported_protective_leaf'] }),
			reconcile: () => Promise.resolve(null),
		};
	}
}
