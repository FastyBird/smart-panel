import { EntityManager } from 'typeorm';

import { DevicesValidationException } from '../../../modules/devices/devices.exceptions';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import {
	hasQualifiedFloorSourceIdentity,
	hasQualifiedRawVoltageIdentity,
	nativeTemperatureIdentity,
	nativeVoltmeterVoltageIdentity,
} from '../../devices-shelly-ng/contracts/native-temperature.contract';
import { ShellyNgDeviceEntity } from '../../devices-shelly-ng/entities/devices-shelly-ng.entity';
import { ShellySampleSourceEntity } from '../../devices-shelly-ng/entities/shelly-sample-source.entity';
import { VirtualTransformConfigEntity, VirtualTransformSourceEntity } from '../entities/virtual-transform.entity';

import { VirtualNumericTransformOperator } from './virtual-numeric-transform.utils';
import {
	isThermostatTemperature,
	thermostatFingerprint,
	thermostatPropertyContract,
} from './virtual-thermostat-contract.utils';
import { transformContractErrors } from './virtual-transform-contract.utils';

const reject = (): never => {
	throw new DevicesValidationException(
		'Protection requires a qualified Celsius sensor or reviewed single physical voltage converter on the actuator Shelly, with finite domain.',
	);
};
export async function resolveThermostatProtectionSource(
	manager: EntityManager,
	sourceId: string,
	actuatorIdentity: string,
) {
	const property = await manager.findOne(ChannelPropertyEntity, {
		where: { id: sourceId },
		relations: ['channel', 'channel.device'],
	});
	if (!property) return reject();
	const channel = property.channel as ChannelEntity;
	const device = channel.device as DeviceEntity;
	if (!isThermostatTemperature(property, channel)) return reject();
	let leaf = property;
	const transform = await manager.findOneBy(VirtualTransformConfigEntity, { outputPropertyId: property.id });
	const transformSource = await manager.findOneBy(VirtualTransformSourceEntity, { outputPropertyId: property.id });
	if (device.type === 'virtual') {
		if (!transform || !transformSource?.sourcePropertyId) return reject();
		leaf = await manager.findOne(ChannelPropertyEntity, {
			where: { id: transformSource.sourcePropertyId },
			relations: ['channel', 'channel.device'],
		});
		const contractErrors = leaf
			? transformContractErrors(transform, property, leaf, transformSource)
			: ['missing_leaf'];
		if (contractErrors.length)
			throw new DevicesValidationException(`Protection converter contract: ${contractErrors.join(', ')}`);
		if (
			!leaf ||
			transform.quantity !== 'temperature' ||
			transform.unit !== '°C' ||
			transform.policy.operator !== VirtualNumericTransformOperator.STEINHART_HART ||
			contractErrors.length
		)
			return reject();
	} else if (transform || transformSource) return reject();
	const leafChannel = leaf.channel as ChannelEntity;
	const leafDevice = leafChannel.device as DeviceEntity;
	if (
		!(leafDevice instanceof ShellyNgDeviceEntity) ||
		!leafDevice.canonicalMac ||
		!actuatorIdentity.startsWith(`shelly-ng:${leafDevice.canonicalMac.toUpperCase()}:switch:`)
	)
		return reject();
	if (
		transform
			? !hasQualifiedRawVoltageIdentity(leafChannel.identifier)
			: !hasQualifiedFloorSourceIdentity(leafChannel.identifier)
	)
		return reject();
	const metadata = await manager.findOneBy(ShellySampleSourceEntity, { propertyId: leaf.id, active: true });
	if (!metadata || metadata.deviceId !== leafDevice.id || !leafChannel.identifier.endsWith(`:${metadata.fingerprint}`))
		return reject();
	if (metadata.installationSnapshot) {
		const snapshot = metadata.installationSnapshot;
		const identity = transform
			? nativeVoltmeterVoltageIdentity(
					metadata.componentKey,
					snapshot.configuration,
					snapshot.peripherals,
					leafDevice.canonicalMac,
				)
			: nativeTemperatureIdentity(metadata.componentKey, snapshot.configuration, snapshot.peripherals);
		if (
			!identity ||
			identity.fingerprint !== metadata.fingerprint ||
			identity.channelIdentifier !== leafChannel.identifier ||
			identity.attribute !== leaf.identifier ||
			identity.unit !== metadata.unit ||
			JSON.stringify(identity.configuration) !== JSON.stringify(metadata.configuration) ||
			JSON.stringify(identity.peripheral) !== JSON.stringify(metadata.peripheral)
		)
			return reject();
	}
	const domain =
		transform?.policy.outputRange ??
		(Array.isArray(property.format) && property.format.length === 2
			? { minimum: property.format[0], maximum: property.format[1] }
			: null);
	if (
		!domain ||
		typeof domain.minimum !== 'number' ||
		typeof domain.maximum !== 'number' ||
		!Number.isFinite(domain.minimum) ||
		!Number.isFinite(domain.maximum) ||
		domain.minimum >= domain.maximum
	)
		return reject();
	const fingerprint = thermostatFingerprint({
		property: thermostatPropertyContract(property, channel, device),
		leaf: thermostatPropertyContract(leaf, leafChannel, leafDevice),
		transform,
		transformSource,
		metadata,
		domain,
	});
	return {
		property,
		leaf,
		transform,
		transformSource,
		metadata,
		domain: { minimum: domain.minimum, maximum: domain.maximum },
		fingerprint,
		enabled: device.enabled && leafDevice.enabled,
	};
}
export type ThermostatProtectionSource = Awaited<ReturnType<typeof resolveThermostatProtectionSource>>;
export function protectionBoundsValid(
	domain: { minimum: number; maximum: number },
	cutoff: number,
	hysteresis: number,
): boolean {
	return (
		[cutoff, hysteresis, cutoff - hysteresis].every(Number.isFinite) &&
		hysteresis > 0 &&
		cutoff <= domain.maximum &&
		cutoff > domain.minimum &&
		cutoff - hysteresis >= domain.minimum
	);
}

/** Control-consumer index is separate from measurement DAG edges and cannot contribute ambient provenance. */
export function validateProtectionConsumerIndex(
	dependencies: { claimId: string; sourcePropertyIdentity: string; physicalPropertyIdentity: string }[],
): void {
	if (dependencies.length > 4096)
		throw new DevicesValidationException('Protection consumer index exceeds its node bound.');
	const consumers = new Map<string, Set<string>>();
	for (const row of dependencies)
		for (const id of new Set([row.sourcePropertyIdentity, row.physicalPropertyIdentity])) {
			const claims = consumers.get(id) ?? new Set<string>();
			claims.add(row.claimId);
			consumers.set(id, claims);
			if (claims.size > 256)
				throw new DevicesValidationException('Protection consumer index exceeds its fan-out bound.');
		}
	if ([...consumers.values()].reduce((count, claims) => count + claims.size, 0) > 8192)
		throw new DevicesValidationException('Protection consumer index exceeds its edge bound.');
}
