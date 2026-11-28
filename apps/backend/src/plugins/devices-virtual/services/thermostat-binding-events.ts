import { EntityManager, Not } from 'typeorm';

import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { DeviceBinding } from '../../../modules/devices/contracts/device-bindings.event';
import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import {
	VIRTUAL_DEVICE_BINDINGS_CHANGED,
	VirtualDeviceBindingsEvent,
} from '../contracts/virtual-device-bindings.event';
import { DEVICES_VIRTUAL_PLUGIN_NAME } from '../devices-virtual.constants';
import { ThermostatCoolingDependencyEntity } from '../entities/thermostat-cooling-dependency.entity';
import { ThermostatMemberProtectionEntity } from '../entities/thermostat-member-protection.entity';
import {
	VirtualThermostatActuatorClaimEntity,
	VirtualThermostatConfigEntity,
	VirtualThermostatSourceEntity,
} from '../entities/virtual-thermostat.entity';

export function thermostatActuatorBinding(claim: VirtualThermostatActuatorClaimEntity): DeviceBinding {
	return Object.freeze({
		role: claim.role,
		deviceId: claim.sourceDeviceIdentity,
		propertyId: claim.sourcePropertyIdentity,
		claimId: claim.id,
		physicalIdentity: claim.physicalIdentity,
		providerProfile: claim.providerProfile,
	});
}

export function publishThermostatBindings(events: EventEmitter2, event: VirtualDeviceBindingsEvent): void {
	try {
		events.emit(VIRTUAL_DEVICE_BINDINGS_CHANGED, event);
	} catch (error) {
		Logger.error(`Failed to notify binding listeners for thermostat ${event.deviceId}`, error, 'VirtualThermostat');
	}
}

/** Capture scalar identities in the same transaction as their configuration, before another writer can replace it. */
export async function captureThermostatBindings(
	manager: EntityManager,
	config: VirtualThermostatConfigEntity,
	action: VirtualDeviceBindingsEvent['action'],
	removedBindings?: readonly DeviceBinding[],
): Promise<VirtualDeviceBindingsEvent> {
	const controllerId = config.controllerId;
	const claims = await manager.findBy(VirtualThermostatActuatorClaimEntity, {
		controllerId,
		...(action === 'deleted' ? {} : { state: Not('released') }),
	});
	const sources = await manager.findBy(VirtualThermostatSourceEntity, { controllerId });
	const bindings: DeviceBinding[] = claims.map(thermostatActuatorBinding);
	const sensorBindings: { role: string; propertyId: string; claimId?: string }[] = sources.map((source) => ({
		role: source.role,
		propertyId: source.sourcePropertyIdentity,
	}));
	const claimIds = claims.map((claim) => claim.id);
	if (claimIds.length) {
		const floors = await manager
			.createQueryBuilder(ThermostatMemberProtectionEntity, 'floor')
			.where('floor.claimId IN (:...claimIds)', { claimIds })
			.getMany();
		for (const floor of floors)
			sensorBindings.push({ role: 'floor', propertyId: floor.sourcePropertyIdentity, claimId: floor.claimId });
		if (manager.connection.hasMetadata(ThermostatCoolingDependencyEntity)) {
			const cooling = await manager
				.createQueryBuilder(ThermostatCoolingDependencyEntity, 'cooling')
				.where('cooling.claimId IN (:...claimIds)', { claimIds })
				.getMany();
			for (const row of cooling)
				sensorBindings.push(
					{ role: 'cooled_surface', propertyId: row.surfaceIdentity, claimId: row.claimId },
					{ role: 'dew_point', propertyId: row.dewPointIdentity, claimId: row.claimId },
				);
		}
	}
	if (sensorBindings.length) {
		const devices = await manager
			.createQueryBuilder(ChannelPropertyEntity, 'property')
			.innerJoin('property.channel', 'channel')
			.select('property.id', 'propertyId')
			.addSelect('channel.deviceId', 'deviceId')
			.where('property.id IN (:...propertyIds)', { propertyIds: sensorBindings.map((entry) => entry.propertyId) })
			.getRawMany<{ propertyId: string; deviceId: string }>();
		const owners = new Map(devices.map((row) => [row.propertyId, row.deviceId]));
		for (const entry of sensorBindings) bindings.push({ ...entry, deviceId: owners.get(entry.propertyId) ?? null });
	}
	return Object.freeze({
		producer: DEVICES_VIRTUAL_PLUGIN_NAME,
		kind: 'thermostat',
		action,
		deviceId: controllerId,
		revision: config.revision,
		bindings: Object.freeze(bindings.map((entry) => Object.freeze(entry))),
		...(removedBindings?.length
			? { removedBindings: Object.freeze(removedBindings.map((entry) => Object.freeze({ ...entry }))) }
			: {}),
	});
}
