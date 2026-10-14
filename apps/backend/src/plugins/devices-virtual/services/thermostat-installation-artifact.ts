import { createHash } from 'node:crypto';

import { DevicesValidationException } from '../../../modules/devices/devices.exceptions';
import { SHELLY_GUARD_SOURCE } from '../../devices-shelly-ng/contracts/guard-script-source';
import {
	nativeTemperatureIdentity,
	nativeVoltmeterVoltageIdentity,
} from '../../devices-shelly-ng/contracts/native-temperature.contract';
import { ShellyProtectiveQualification } from '../../devices-shelly-ng/contracts/protective-switch.contract';
import { ShellyNgDeviceEntity } from '../../devices-shelly-ng/entities/devices-shelly-ng.entity';
import { ThermostatInstallationEntity } from '../entities/thermostat-installation.entity';

import { ThermostatInstallationBindingsService } from './thermostat-installation-bindings.service';
import {
	THERMOSTAT_ATTESTATION_KINDS,
	ThermostatGuardSetup,
	ThermostatOperatorAttestation,
} from './thermostat-installation.types';
import { VirtualNumericTransformOperator, validateVirtualNumericTransform } from './virtual-numeric-transform.utils';

type Bindings = Awaited<ReturnType<ThermostatInstallationBindingsService['resolve']>>;
function reject(message: string): never {
	throw new DevicesValidationException(message);
}
const exactKeys = (value: object, keys: string[]) => {
	if (!value || Object.keys(value).some((key) => !keys.includes(key)))
		reject('Unknown installation fields are not accepted.');
};
const text = (value: unknown, max = 256) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
export function validateThermostatInstallation(
	setup: ThermostatGuardSetup,
	attestations: ThermostatOperatorAttestation[],
	binding: Bindings,
): void {
	exactKeys(setup, [
		'deviceHardwareId',
		'firmware',
		'endpointHostname',
		'scriptId',
		'epochKey',
		'heatingSetpointRange',
		'coolingSetpointRange',
		'minimumLeaseSeconds',
		'maximumLeaseSeconds',
		'watchdogMs',
		'floorMaximumAgeMs',
		'floorComponentType',
		'floorComponentId',
		'floorAttribute',
		'floorConfigurationJson',
		'switchConfigurationJson',
		'peripheralsJson',
		'floorConversion',
	]);
	if (
		!['deviceHardwareId', 'firmware', 'endpointHostname', 'epochKey'].every((key) => text(setup[key])) ||
		!Number.isInteger(setup.scriptId) ||
		setup.scriptId < 1 ||
		setup.scriptId > 100 ||
		!Number.isInteger(setup.floorComponentId) ||
		setup.floorComponentId < 0
	)
		reject('Invalid installation identity or script/component slot.');
	for (const key of ['minimumLeaseSeconds', 'maximumLeaseSeconds', 'watchdogMs', 'floorMaximumAgeMs'])
		if (!Number.isSafeInteger(setup[key]) || setup[key] <= 0 || setup[key] >= 2147483647)
			reject('Lease and timing bounds must be explicit positive bounded integers.');
	if (
		setup.maximumLeaseSeconds * 1000 >= 2147483647 ||
		setup.maximumLeaseSeconds < setup.minimumLeaseSeconds ||
		setup.watchdogMs >= setup.minimumLeaseSeconds * 1000 ||
		setup.floorMaximumAgeMs <= setup.watchdogMs ||
		setup.floorMaximumAgeMs > binding.floorMaximumAgeMs ||
		binding.claim.leaseSeconds < setup.minimumLeaseSeconds ||
		binding.claim.leaseSeconds > setup.maximumLeaseSeconds
	)
		reject('Configured lease/floor timings exceed installation bounds.');
	for (const [value, range] of [
		[binding.config.policy.heatingSetpoint, setup.heatingSetpointRange],
		[binding.config.policy.coolingSetpoint, setup.coolingSetpointRange],
	] as const) {
		if (value === null) {
			if (range !== null) reject('Absent comfort branch must have a null installed range.');
		} else {
			if (!range) reject('Explicit installed comfort ranges are required.');
			exactKeys(range, ['minimum', 'maximum']);
			if (
				!Number.isFinite(range.minimum) ||
				!Number.isFinite(range.maximum) ||
				range.minimum > range.maximum ||
				value < range.minimum ||
				value > range.maximum
			)
				reject('Comfort setpoint exceeds the reviewed installed range.');
		}
	}
	for (const config of [setup.floorConfigurationJson, setup.switchConfigurationJson, setup.peripheralsJson]) {
		if (!text(config, 8192)) reject('Full floor and switch configuration snapshots are required.');
		try {
			const parsed: unknown = JSON.parse(config);
			if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object')
				reject('Component configuration must be an object.');
		} catch {
			reject('Invalid component configuration JSON.');
		}
	}
	const leafChannel = binding.floorLeaf.channel as { identifier: string };
	const device = binding.target.device as ShellyNgDeviceEntity;
	const componentKey = `${setup.floorComponentType}:${setup.floorComponentId}`;
	const floorConfig = JSON.parse(setup.floorConfigurationJson) as Record<string, unknown>;
	const peripherals = JSON.parse(setup.peripheralsJson) as Record<string, unknown>;
	const identity =
		setup.floorAttribute === 'voltage'
			? nativeVoltmeterVoltageIdentity(componentKey, floorConfig, peripherals, device.canonicalMac)
			: nativeTemperatureIdentity(componentKey, floorConfig, peripherals);
	if (
		!identity ||
		leafChannel.identifier !== identity.channelIdentifier ||
		binding.floorLeaf.identifier !== identity.attribute
	)
		reject('Floor metadata/peripheral/calibration identity must match the current physical source contract.');
	if (setup.floorConversion || binding.floorTransform) {
		const conversion = setup.floorConversion;
		const policy = binding.floorTransform?.policy;
		if (
			!conversion ||
			!policy ||
			policy.operator !== VirtualNumericTransformOperator.STEINHART_HART ||
			validateVirtualNumericTransform(policy).length ||
			setup.floorAttribute !== 'voltage' ||
			setup.floorComponentType !== 'voltmeter'
		)
			reject('A converted floor requires the exact configured Steinhart-Hart voltage lineage.');
		exactKeys(conversion, [
			'kind',
			'referenceVoltage',
			'seriesResistance',
			'a',
			'b',
			'c',
			'thermistorLeg',
			'inputRange',
			'outputRange',
		]);
		if (
			conversion.kind !== 'steinhart_hart' ||
			conversion.referenceVoltage !== policy.referenceVoltage ||
			conversion.seriesResistance !== policy.seriesResistance ||
			conversion.a !== policy.coefficientA ||
			conversion.b !== policy.coefficientB ||
			conversion.c !== policy.coefficientC ||
			conversion.thermistorLeg !== policy.thermistorLeg ||
			JSON.stringify(conversion.inputRange) !== JSON.stringify(policy.inputRange) ||
			JSON.stringify(conversion.outputRange) !== JSON.stringify(policy.outputRange)
		)
			reject('Device-local calibration must match the reviewed backend floor calibration and domains.');
	} else if (
		!(
			(setup.floorComponentType === 'temperature' && setup.floorAttribute === 'tC') ||
			(setup.floorComponentType === 'voltmeter' && setup.floorAttribute === 'xvoltage') ||
			(setup.floorComponentType === 'input' && setup.floorAttribute === 'xpercent')
		)
	)
		reject('The floor guard requires native Celsius or explicit calibrated voltage lineage.');
	if (!Array.isArray(attestations) || attestations.length > THERMOSTAT_ATTESTATION_KINDS.length)
		reject('Invalid operator attestations.');
	const kinds = new Set<string>();
	for (const item of attestations) {
		exactKeys(item, ['kind', 'equipment', 'procedure', 'evidenceReference', 'testedAt', 'maximumObservedMs']);
		if (
			!THERMOSTAT_ATTESTATION_KINDS.includes(item.kind) ||
			kinds.has(item.kind) ||
			!text(item.equipment, 2048) ||
			!text(item.procedure, 4096) ||
			!text(item.evidenceReference, 2048) ||
			!Number.isFinite(Date.parse(item.testedAt)) ||
			Date.parse(item.testedAt) > Date.now() ||
			(item.maximumObservedMs !== undefined && (!Number.isFinite(item.maximumObservedMs) || item.maximumObservedMs < 0))
		)
			reject('Attestations require unique kinds, equipment, procedure, dated evidence and finite timing.');
		kinds.add(item.kind);
	}
}
export function installationAttestationReasons(row: ThermostatInstallationEntity, opposed: boolean): string[] {
	const kinds = row.attestations.map((item) => item.kind);
	const required = THERMOSTAT_ATTESTATION_KINDS.filter((kind) => kind !== 'opposed_interlock' || opposed);
	const switchConfig = JSON.parse(row.setup.switchConfigurationJson) as Record<string, unknown>;
	const reasons = required
		.filter((kind) => !kinds.includes(kind))
		.map((kind) => `operator_attestation_missing:${kind}`);
	if (
		switchConfig.initial_state !== 'off' ||
		switchConfig.auto_on !== false ||
		(switchConfig.in_locked !== true && switchConfig.in_mode !== 'detached')
	)
		reasons.push('native_restart_or_input_writer_not_excluded');
	const bounds = row.attestations.find((item) => item.kind === 'local_execution_bounds');
	if (!Number.isFinite(bounds?.maximumObservedMs) || bounds.maximumObservedMs >= row.setup.watchdogMs)
		reasons.push('operator_execution_bound_not_within_watchdog');
	return reasons;
}
export function thermostatInstallationArtifact(
	row: ThermostatInstallationEntity,
	binding: Bindings,
): { source: string; sourceHash: string; qualification: ShellyProtectiveQualification } {
	const setup = row.setup;
	const device = binding.target.device as ShellyNgDeviceEntity;
	const componentId = Number(/^switch:(\d+)$/.exec(binding.target.channel.identifier)[1]);
	const evidenceId = `installation:${row.claimId}:${row.revision}`;
	const attestation = (kind: string) => row.attestations.find((item) => item.kind === kind)?.evidenceReference ?? '';
	const configuration = {
		deviceId: setup.deviceHardwareId,
		model: 'SNSW-001P16EU',
		firmware: setup.firmware,
		componentId,
		evidenceId,
		scriptRestartDrainQualified: !!attestation('restart_drain'),
		nativeWritersExcluded: !!attestation('writer_isolation'),
		epochKey: setup.epochKey,
		minLeaseMs: setup.minimumLeaseSeconds * 1000,
		maxLeaseMs: setup.maximumLeaseSeconds * 1000,
		watchdogMs: setup.watchdogMs,
		floorMaxAgeMs: setup.floorMaximumAgeMs,
		floorComponentType: setup.floorComponentType,
		floorComponentId: setup.floorComponentId,
		floorAttribute: setup.floorAttribute,
		floorConfigurationJson: setup.floorConfigurationJson,
		floorConversion: setup.floorConversion,
		floorLimitC: binding.config.policy.floor.limit,
		floorHysteresisC: binding.config.policy.floor.recoveryHysteresis,
	};
	const source = `let SP_GUARD_CONFIG = ${JSON.stringify(configuration)};\n${SHELLY_GUARD_SOURCE}`;
	const sourceHash = createHash('sha256').update(source).digest('hex');
	return {
		source,
		sourceHash,
		qualification: {
			deviceId: setup.deviceHardwareId,
			model: 'SNSW-001P16EU',
			firmware: setup.firmware,
			componentId,
			evidenceId,
			revision: row.revision,
			testedLeaseSeconds: { min: setup.minimumLeaseSeconds, max: setup.maximumLeaseSeconds },
			releaseOrderingQualified: true,
			independentProtectionQualified: true,
			guardScript: {
				installationMetadata: {
					componentType: setup.floorComponentType,
					componentId: setup.floorComponentId,
					configurationJson: setup.floorConfigurationJson,
					switchConfigurationJson: setup.switchConfigurationJson,
					peripheralsJson: setup.peripheralsJson,
				},
				scriptId: setup.scriptId,
				sourceHash,
				endpointHostname: setup.endpointHostname,
				canonicalMac: device.canonicalMac,
				evidenceId,
				protocol: 'sp-guard-candidate-1',
				writerIsolationEvidenceId: attestation('writer_isolation'),
				commissioningBarrierEvidenceId: attestation('commissioning_barrier'),
				endpointAuthenticationEvidenceId: attestation('endpoint_authentication'),
				restartDrainEvidenceId: attestation('restart_drain'),
				localExecutionBoundsEvidenceId: attestation('local_execution_bounds'),
			},
		},
	};
}
