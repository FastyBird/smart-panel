import { EntityManager, EntityTarget, FindOptionsWhere, ObjectLiteral } from 'typeorm';

import { ClimateAutomationParticipantTurn } from '../../../modules/devices/contracts/climate-automation.contract';
import { DevicesValidationException } from '../../../modules/devices/devices.exceptions';
import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { ClimateAutomationWriterService } from '../../../modules/devices/services/climate-automation-writer.service';
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
export interface ThermostatProtectionLineageRows {
	readonly property: ChannelPropertyEntity | null;
	readonly leaf: ChannelPropertyEntity | null;
	readonly transform: VirtualTransformConfigEntity | null;
	readonly transformSource: VirtualTransformSourceEntity | null;
	readonly metadata: ShellySampleSourceEntity | null;
}

function protectionRoot(property: ChannelPropertyEntity | null) {
	if (!property) return reject();
	const channel = property.channel;
	if (!channel || typeof channel === 'string') return reject();
	const device = channel.device;
	if (!device || typeof device === 'string') return reject();
	if (!isThermostatTemperature(property, channel)) return reject();
	return { property, channel, device };
}

function protectionSourceId(
	root: ReturnType<typeof protectionRoot>,
	transform: VirtualTransformConfigEntity | null,
	transformSource: VirtualTransformSourceEntity | null,
): string | null {
	if (root.device.type === 'virtual') {
		if (!transform || !transformSource?.sourcePropertyId) return reject();
		return transformSource.sourcePropertyId;
	}
	if (transform || transformSource) return reject();
	return null;
}

function protectionLeaf(
	root: ReturnType<typeof protectionRoot>,
	leaf: ChannelPropertyEntity | null,
	transform: VirtualTransformConfigEntity | null,
	transformSource: VirtualTransformSourceEntity | null,
	sourceId: string | null,
	actuatorIdentity: string,
) {
	const { property } = root;
	if (sourceId !== null) {
		if (!transform || !transformSource?.sourcePropertyId) return reject();
		const contractErrors = leaf
			? transformContractErrors(transform, property, leaf, transformSource)
			: ['missing_leaf'];
		if (contractErrors.length)
			throw new DevicesValidationException(`Protection converter contract: ${contractErrors.join(', ')}`);
		if (leaf && leaf.id !== transformSource.sourcePropertyId) return reject();
		if (
			!leaf ||
			transform.quantity !== 'temperature' ||
			transform.unit !== '°C' ||
			transform.policy.operator !== VirtualNumericTransformOperator.STEINHART_HART ||
			contractErrors.length
		)
			return reject();
	}
	if (!leaf) return reject();
	const leafChannel = leaf.channel;
	if (!leafChannel || typeof leafChannel === 'string') return reject();
	const leafDevice = leafChannel.device;
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
	return { ...root, leaf, leafChannel, leafDevice, transform, transformSource };
}

function completeProtection(checked: ReturnType<typeof protectionLeaf>, metadata: ShellySampleSourceEntity | null) {
	const { property, device, channel, leaf, leafChannel, leafDevice, transform, transformSource } = checked;
	if (
		!metadata ||
		metadata.propertyId !== leaf.id ||
		!metadata.active ||
		metadata.deviceId !== leafDevice.id ||
		!leafChannel.identifier.endsWith(`:${metadata.fingerprint}`)
	)
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

/** Closed row-only checker. No SQL, listeners, history, sample reads, leases or allocations of authority. */
export function validateThermostatProtectionRows(rows: ThermostatProtectionLineageRows, actuatorIdentity: string) {
	const root = protectionRoot(rows.property);
	const sourceId = protectionSourceId(root, rows.transform, rows.transformSource);
	const checked = protectionLeaf(root, rows.leaf, rows.transform, rows.transformSource, sourceId, actuatorIdentity);
	if (checked.leaf.id !== (sourceId ?? root.property.id)) return reject();
	return completeProtection(checked, rows.metadata);
}

/** Ordinary loader retains its original manager queries and validation ordering. */
export async function resolveThermostatProtectionSource(
	manager: EntityManager,
	sourceId: string,
	actuatorIdentity: string,
) {
	const property = await manager.findOne(ChannelPropertyEntity, {
		where: { id: sourceId },
		relations: ['channel', 'channel.device'],
	});
	const root = protectionRoot(property);
	const transform = await manager.findOneBy(VirtualTransformConfigEntity, { outputPropertyId: root.property.id });
	const transformSource = await manager.findOneBy(VirtualTransformSourceEntity, { outputPropertyId: root.property.id });
	const leafId = protectionSourceId(root, transform, transformSource);
	const leaf =
		leafId === null
			? root.property
			: await manager.findOne(ChannelPropertyEntity, {
					where: { id: leafId },
					relations: ['channel', 'channel.device'],
				});
	const checked = protectionLeaf(root, leaf, transform, transformSource, leafId, actuatorIdentity);
	const metadata = await manager.findOneBy(ShellySampleSourceEntity, { propertyId: checked.leaf.id, active: true });
	return completeProtection(checked, metadata);
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
		cutoff - hysteresis > domain.minimum
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

/** Closed reserved loader. Original pure lineage rules are shared; all reads are listener-free and turn checked. */
export async function resolveReservedThermostatProtectionSource(
	manager: EntityManager,
	writer: ClimateAutomationWriterService,
	turn: ClimateAutomationParticipantTurn,
	sourceId: string,
	actuatorIdentity: string,
) {
	const check = (): void =>
		writer.assertParticipantTurn(manager, turn, ['NORMALIZE', 'READ_BEFORE', 'READ_AFTER', 'FINAL_READ']);
	check();
	const property = async (id: string) => {
		check();
		const row = await manager
			.createQueryBuilder(ChannelPropertyEntity, 'property')
			.leftJoinAndSelect('property.channel', 'channel')
			.leftJoinAndSelect('channel.device', 'device')
			.where('property.id = :id', { id })
			.callListeners(false)
			.getOne();
		check();
		return row;
	};
	const one = async <T extends ObjectLiteral>(entity: EntityTarget<T>, where: FindOptionsWhere<T>) => {
		check();
		const row = await manager.createQueryBuilder(entity, 'row').setFindOptions({ where }).callListeners(false).getOne();
		check();
		return row;
	};
	const root = await property(sourceId);
	if (!root) return reject();
	const transform = await one(VirtualTransformConfigEntity, { outputPropertyId: root.id });
	const transformSource = await one(VirtualTransformSourceEntity, { outputPropertyId: root.id });
	const checked = protectionRoot(root);
	const leafId = protectionSourceId(checked, transform, transformSource);
	const leaf = leafId === null ? root : await property(leafId);
	const metadata = leaf ? await one(ShellySampleSourceEntity, { propertyId: leaf.id }) : null;
	check();
	return validateThermostatProtectionRows(
		{ property: root, leaf, transform, transformSource, metadata },
		actuatorIdentity,
	);
}
