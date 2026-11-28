import { EntityManager } from 'typeorm';

import { DevicesValidationException } from '../../../modules/devices/devices.exceptions';
import { ChannelEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { ThermostatProtectionSource } from '../../devices-virtual/services/thermostat-protection-source.utils';
import { VirtualNumericTransformOperator } from '../../devices-virtual/services/virtual-numeric-transform.utils';
import {
	thermostatFingerprint,
	thermostatPropertyContract,
} from '../../devices-virtual/services/virtual-thermostat-contract.utils';
import {
	hasQualifiedFloorSourceIdentity,
	hasQualifiedRawVoltageIdentity,
	nativeTemperatureIdentity,
	nativeVoltmeterVoltageIdentity,
} from '../contracts/native-temperature.contract';
import { ShellyNgDeviceEntity } from '../entities/devices-shelly-ng.entity';
import { ShellySampleSourceEntity } from '../entities/shelly-sample-source.entity';

const reject = (): never => {
	throw new DevicesValidationException(
		'On-device protection requires a qualified Celsius sensor or calibrated physical voltage converter on the actuator Shelly, with a finite domain.',
	);
};

export async function qualifyShellyProtectionSource(
	manager: EntityManager,
	source: ThermostatProtectionSource,
	actuatorDeviceId: string,
) {
	const { leaf, transform, domain } = source;
	const leafChannel = leaf.channel as ChannelEntity;
	const leafDevice = leafChannel.device;
	if (
		!(leafDevice instanceof ShellyNgDeviceEntity) ||
		!leafDevice.canonicalMac ||
		leafDevice.id !== actuatorDeviceId ||
		!domain ||
		(transform && transform.policy.operator !== VirtualNumericTransformOperator.STEINHART_HART)
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
	const channel = source.property.channel as ChannelEntity;
	const fingerprint = thermostatFingerprint({
		property: thermostatPropertyContract(source.property, channel, channel.device as DeviceEntity),
		leaf: thermostatPropertyContract(leaf, leafChannel, leafDevice),
		transform,
		transformSource: source.transformSource,
		metadata,
		domain,
	});
	return { ...source, domain, metadata, fingerprint };
}
