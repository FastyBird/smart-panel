import { EntityManager, Not } from 'typeorm';

import { Injectable } from '@nestjs/common';

import { DevicesValidationException } from '../../../modules/devices/devices.exceptions';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import { ShellyNgDeviceEntity } from '../../devices-shelly-ng/entities/devices-shelly-ng.entity';
import { thermostatHasOpposedBranches } from '../contracts/thermostat-actuation.contract';
import {
	VirtualThermostatActuatorClaimEntity,
	VirtualThermostatConfigEntity,
	VirtualThermostatSourceEntity,
} from '../entities/virtual-thermostat.entity';
import { VirtualTransformConfigEntity, VirtualTransformSourceEntity } from '../entities/virtual-transform.entity';

import {
	thermostatActuatorIdentity,
	thermostatFingerprint,
	thermostatPropertyContract,
} from './virtual-thermostat-contract.utils';

@Injectable()
export class ThermostatInstallationBindingsService {
	async resolve(
		manager: EntityManager,
		claimId: string,
	): Promise<{
		claim: VirtualThermostatActuatorClaimEntity;
		config: VirtualThermostatConfigEntity;
		target: IDevicePropertyData;
		fingerprint: string;
		floorMaximumAgeMs: number;
		opposed: boolean;
		floorLeaf: ChannelPropertyEntity;
		floorTransform: VirtualTransformConfigEntity | null;
	}> {
		const claim = await manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { id: claimId });
		const config = await manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: claim.controllerId });
		const property =
			claim.sourcePropertyId &&
			(await manager.findOne(ChannelPropertyEntity, {
				where: { id: claim.sourcePropertyId },
				relations: ['channel', 'channel.device'],
			}));
		if (!property || claim.state === 'released')
			throw new DevicesValidationException('Actuator is missing or released.');
		const channel = property.channel as ChannelEntity;
		const device = channel.device as DeviceEntity;
		if (
			!(device instanceof ShellyNgDeviceEntity) ||
			thermostatActuatorIdentity(property, channel, device) !== claim.physicalIdentity ||
			thermostatPropertyContract(property, channel, device) !== claim.contractFingerprint
		)
			throw new DevicesValidationException('Actuator identity/contract changed; repair the reservation.');
		const sources = await manager.find(VirtualThermostatSourceEntity, {
			where: { controllerId: claim.controllerId },
			order: { id: 'ASC' },
		});
		const floor = sources.find((row) => row.role === 'floor');
		if (!floor?.sourcePropertyId || !config.policy.floor)
			throw new DevicesValidationException('Configure a bound floor guard before staging installation.');
		const bindings: unknown[] = [];
		let floorLeaf: ChannelPropertyEntity;
		let floorTransform: VirtualTransformConfigEntity | null = null;
		for (const source of sources) {
			const input =
				source.sourcePropertyId &&
				(await manager.findOne(ChannelPropertyEntity, {
					where: { id: source.sourcePropertyId },
					relations: ['channel', 'channel.device'],
				}));
			if (!input) throw new DevicesValidationException('A configured thermostat input is missing.');
			const inputChannel = input.channel as ChannelEntity;
			const inputDevice = inputChannel.device as DeviceEntity;
			const transform = await manager.findOneBy(VirtualTransformConfigEntity, { outputPropertyId: input.id });
			const transformSource = await manager.findOneBy(VirtualTransformSourceEntity, { outputPropertyId: input.id });
			bindings.push({
				source,
				contract: thermostatPropertyContract(input, inputChannel, inputDevice),
				transform,
				transformSource,
			});
			if (source.role === 'floor') {
				const leaf = transformSource?.sourcePropertyId
					? await manager.findOne(ChannelPropertyEntity, {
							where: { id: transformSource.sourcePropertyId },
							relations: ['channel', 'channel.device'],
						})
					: input;
				const leafDevice = (leaf?.channel as ChannelEntity)?.device as ShellyNgDeviceEntity;
				if (!(leafDevice instanceof ShellyNgDeviceEntity) || leafDevice.canonicalMac !== device.canonicalMac)
					throw new DevicesValidationException(
						"The device-local floor guard must bind the actuator's physical Shelly sensor.",
					);
				floorLeaf = leaf;
				floorTransform = transform;
				bindings.push({
					floorPhysical: leaf && thermostatPropertyContract(leaf, leaf.channel as ChannelEntity, leafDevice),
				});
			}
		}
		const topology = await manager.find(VirtualThermostatActuatorClaimEntity, {
			where: { controllerId: claim.controllerId, state: Not('released') },
			order: { id: 'ASC' },
		});
		const opposed = thermostatHasOpposedBranches(topology);
		return {
			claim,
			config,
			target: { device, channel, property, value: false },
			floorMaximumAgeMs: floor.maximumAgeSeconds * 1000,
			floorLeaf,
			floorTransform,
			fingerprint: thermostatFingerprint({
				claim: {
					id: claim.id,
					revision: claim.revision,
					qualificationGeneration: claim.qualificationGeneration,
					contract: claim.contractFingerprint,
				},
				config: {
					schemaVersion: config.schemaVersion,
					ownerDeviceId: config.ownerDeviceId,
					policy: {
						...config.policy,
						heatingSetpoint: config.policy.heatingSetpoint !== null,
						coolingSetpoint: config.policy.coolingSetpoint !== null,
					},
					contactOpeningMs: config.contactOpeningMs,
					contactClosingMs: config.contactClosingMs,
					heuristic: config.heuristic,
				},
				topology: topology.map((row) => ({
					id: row.id,
					revision: row.revision,
					generation: row.qualificationGeneration,
					role: row.role,
					physicalIdentity: row.physicalIdentity,
					sourcePropertyIdentity: row.sourcePropertyIdentity,
					contract: row.contractFingerprint,
					leaseSeconds: row.leaseSeconds,
				})),
				bindings,
			}),
			opposed,
		};
	}
}
