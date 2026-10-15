import { DataSource } from 'typeorm';
import { v4 as uuid } from 'uuid';

import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../src/modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity } from '../../src/modules/devices/entities/devices.entity';
import {
	nativeTemperatureIdentity,
	nativeVoltmeterVoltageIdentity,
} from '../../src/plugins/devices-shelly-ng/contracts/native-temperature.contract';
import {
	ShellyNgChannelEntity,
	ShellyNgChannelPropertyEntity,
	ShellyNgDeviceEntity,
} from '../../src/plugins/devices-shelly-ng/entities/devices-shelly-ng.entity';
import { ShellySampleSourceEntity } from '../../src/plugins/devices-shelly-ng/entities/shelly-sample-source.entity';
import {
	VirtualChannelEntity,
	VirtualChannelPropertyEntity,
	VirtualDeviceEntity,
	VirtualDeviceMode,
	VirtualValueOrigin,
} from '../../src/plugins/devices-virtual/entities/devices-virtual.entity';
import {
	VirtualTransformConfigEntity,
	VirtualTransformSourceEntity,
} from '../../src/plugins/devices-virtual/entities/virtual-transform.entity';
import { ThermostatMemberGuardSetup } from '../../src/plugins/devices-virtual/services/thermostat-installation.types';
import { VirtualNumericTransformOperator } from '../../src/plugins/devices-virtual/services/virtual-numeric-transform.utils';

/** Offline catalog fixture only. It supplies no physical qualification or sample freshness. */
export async function createProtectionProbe(db: DataSource, actuatorProperty: string, converted = false) {
	const actuator = await db.manager.findOneOrFail(ChannelPropertyEntity, {
		where: { id: actuatorProperty },
		relations: ['channel', 'channel.device'],
	});
	const device = (actuator.channel as ChannelEntity).device as ShellyNgDeviceEntity;
	const componentKey = converted ? 'voltmeter:100' : 'temperature:100';
	const configuration = converted
		? { id: 100, range: 0, report_thr: 0.01 }
		: { id: 100, offset_C: 0, report_thr_C: 0.1 };
	const peripherals = converted
		? { voltmeter: { [componentKey]: { io: 0 } } }
		: { ds18b20: { [componentKey]: { addr: `probe-${device.canonicalMac}` } } };
	const identity = converted
		? nativeVoltmeterVoltageIdentity(componentKey, configuration, peripherals, device.canonicalMac)
		: nativeTemperatureIdentity(componentKey, configuration, peripherals);
	const existing = await db.manager.findOneBy(ShellySampleSourceEntity, {
		deviceId: device.id,
		componentKey,
		active: true,
	});
	if (existing && !converted)
		return { sourceId: existing.propertyId, physicalId: existing.propertyId, device, identity };
	const channelId = uuid(),
		physicalId = uuid();
	await db.manager.insert(ShellyNgChannelEntity, {
		id: channelId,
		device: device.id,
		name: 'Local floor probe',
		identifier: identity.channelIdentifier,
		category: converted ? ChannelCategory.ANALOG_INPUT : ChannelCategory.TEMPERATURE,
	} as never);
	await db.manager.insert(ShellyNgChannelPropertyEntity, {
		id: physicalId,
		channel: channelId,
		identifier: identity.attribute,
		category: converted ? PropertyCategory.VALUE : PropertyCategory.TEMPERATURE,
		dataType: DataTypeType.FLOAT,
		unit: converted ? 'V' : '°C',
		format: converted ? [0.01, 3.29] : [-55, 125],
		permissions: [PermissionType.READ_ONLY],
	} as never);
	await db.manager.insert(ShellySampleSourceEntity, {
		propertyId: physicalId,
		deviceId: device.id,
		componentKey,
		fingerprint: identity.fingerprint,
		unit: identity.unit,
		expression: identity.expression,
		configuration: identity.configuration,
		peripheral: identity.peripheral,
		installationSnapshot: identity.installationSnapshot,
		active: true,
		identifiedAt: new Date(Date.now() - 1000),
	});
	let sourceId = physicalId;
	if (converted) {
		const converter = uuid(),
			channel = uuid();
		sourceId = uuid();
		await db.manager.insert(VirtualDeviceEntity, {
			id: converter,
			name: 'Calibrated floor converter',
			enabled: true,
			category: DeviceCategory.SENSOR,
			mode: VirtualDeviceMode.SENSOR_TRANSFORM,
		});
		await db.manager.insert(VirtualChannelEntity, {
			id: channel,
			device: converter,
			name: 'Celsius',
			identifier: 'temperature',
			category: ChannelCategory.TEMPERATURE,
		} as never);
		await db.manager.insert(VirtualChannelPropertyEntity, {
			id: sourceId,
			channel,
			identifier: 'temperature',
			category: PropertyCategory.TEMPERATURE,
			dataType: DataTypeType.FLOAT,
			unit: '°C',
			permissions: [PermissionType.READ_ONLY],
			valueOrigin: VirtualValueOrigin.DERIVED,
		} as never);
		const policy = {
			operator: VirtualNumericTransformOperator.STEINHART_HART as const,
			referenceVoltage: 3.3,
			seriesResistance: 10000,
			coefficientA: 0.001129148,
			coefficientB: 0.000234125,
			coefficientC: 0.0000000876741,
			thermistorLeg: 'low' as const,
			inputRange: { minimum: 0.01, maximum: 3.29 },
			outputRange: { minimum: -40, maximum: 100 },
		};
		await db.manager.insert(VirtualTransformConfigEntity, {
			outputPropertyId: sourceId,
			schemaVersion: 1,
			revision: 1,
			policy,
			maximumAgeSeconds: 5,
			quantity: 'temperature',
			unit: '°C',
			configuredAt: new Date(),
		});
		await db.manager.insert(VirtualTransformSourceEntity, {
			outputPropertyId: sourceId,
			sourcePropertyId: physicalId,
			sourcePropertyIdentity: physicalId,
			quantity: 'value',
			unit: 'V',
		});
	}
	return { sourceId, physicalId, device, identity };
}
export function memberInstallationSetup(ceiling = 30): ThermostatMemberGuardSetup {
	return {
		formatVersion: 2,
		installedFloorCeilingC: ceiling,
		deviceHardwareId: 'offline-fixture',
		firmware: 'offline-only-1.7.5',
		endpointHostname: '127.0.0.1',
		scriptId: 2,
		epochKey: 'offline-fixture-epoch',
		heatingSetpointRange: { minimum: 15, maximum: 25 },
		coolingSetpointRange: null,
		minimumLeaseSeconds: 1,
		maximumLeaseSeconds: 60,
		watchdogMs: 100,
		switchConfigurationJson: JSON.stringify({ id: 0, initial_state: 'off', in_locked: true, auto_on: false }),
	};
}
