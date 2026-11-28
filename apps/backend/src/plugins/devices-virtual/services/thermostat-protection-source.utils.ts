import { EntityManager } from 'typeorm';

import { PropertyCategory } from '../../../modules/devices/devices.constants';
import { DevicesValidationException } from '../../../modules/devices/devices.exceptions';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { VirtualTransformConfigEntity, VirtualTransformSourceEntity } from '../entities/virtual-transform.entity';

import {
	isThermostatTemperature,
	thermostatFingerprint,
	thermostatPropertyContract,
} from './virtual-thermostat-contract.utils';
import { transformContractErrors } from './virtual-transform-contract.utils';

const reject = (): never => {
	throw new DevicesValidationException(
		'Protection requires a readable Celsius sensor or a valid Celsius conversion from a single physical sensor.',
	);
};
type ProtectionProperty = ChannelPropertyEntity & {
	transform: VirtualTransformConfigEntity | null;
	transformBinding: VirtualTransformSourceEntity | null;
	transformLeaf: ChannelPropertyEntity | null;
};

function sourceQuery(manager: EntityManager) {
	return manager
		.createQueryBuilder(ChannelPropertyEntity, 'property')
		.leftJoinAndSelect('property.channel', 'channel')
		.leftJoinAndSelect('channel.device', 'device')
		.leftJoinAndMapOne(
			'property.transform',
			VirtualTransformConfigEntity,
			'transform',
			'transform.outputPropertyId = property.id',
		)
		.leftJoinAndMapOne(
			'property.transformBinding',
			VirtualTransformSourceEntity,
			'binding',
			'binding.outputPropertyId = property.id',
		)
		.leftJoinAndMapOne('property.transformLeaf', ChannelPropertyEntity, 'leaf', 'leaf.id = binding.sourcePropertyId')
		.leftJoinAndSelect('leaf.channel', 'leafChannel')
		.leftJoinAndSelect('leafChannel.device', 'leafDevice');
}

function describeSource(property: ChannelPropertyEntity | null) {
	if (!property) return reject();
	const { transform, transformBinding: transformSource, transformLeaf } = property as ProtectionProperty;
	const channel = property.channel as ChannelEntity;
	const device = channel.device as DeviceEntity;
	if (!isThermostatTemperature(property, channel)) return reject();
	let leaf = property;
	if (device.type === 'virtual') {
		if (!transform || !transformSource?.sourcePropertyId) return reject();
		leaf = transformLeaf;
		const contractErrors = leaf
			? transformContractErrors(transform, property, leaf, transformSource)
			: ['missing_leaf'];
		if (contractErrors.length)
			throw new DevicesValidationException(`Protection converter contract: ${contractErrors.join(', ')}`);
		if (!leaf || transform.quantity !== 'temperature' || transform.unit !== '°C') return reject();
	} else if (transform || transformSource) return reject();
	const leafChannel = leaf.channel as ChannelEntity;
	const leafDevice = leafChannel.device as DeviceEntity;
	const format = transform?.policy.outputRange
		? [transform.policy.outputRange.minimum, transform.policy.outputRange.maximum]
		: property.format;
	let domain: { minimum: number; maximum: number } | null = null;
	if (format !== null && format !== undefined) {
		if (!Array.isArray(format) || format.length !== 2) return reject();
		const [minimum, maximum] = format;
		if (
			typeof minimum !== 'number' ||
			typeof maximum !== 'number' ||
			!Number.isFinite(minimum) ||
			!Number.isFinite(maximum) ||
			minimum >= maximum
		)
			return reject();
		domain = { minimum, maximum };
	}
	const fingerprint = thermostatFingerprint({
		property: thermostatPropertyContract(property, channel, device),
		leaf: thermostatPropertyContract(leaf, leafChannel, leafDevice),
		transform,
		transformSource,
		domain,
	});
	return {
		property,
		leaf,
		transform,
		transformSource,
		domain,
		fingerprint,
		enabled: device.enabled && leafDevice.enabled,
	};
}
export async function resolveThermostatProtectionSource(manager: EntityManager, sourceId: string) {
	const property = await sourceQuery(manager).where('property.id = :sourceId', { sourceId }).getOne();
	return describeSource(property);
}

/** One catalog read covers physical probes and their reviewed conversion lineages across integrations. */
export async function listThermostatProtectionSources(manager: EntityManager): Promise<ThermostatProtectionSource[]> {
	const properties = await sourceQuery(manager)
		.where('property.category = :category', { category: PropertyCategory.TEMPERATURE })
		.orderBy('property.id', 'ASC')
		.getMany();
	const result: ThermostatProtectionSource[] = [];
	for (const property of properties) {
		try {
			const source = describeSource(property);
			if (source.enabled) result.push(source);
		} catch (error) {
			if (!(error instanceof DevicesValidationException)) throw error;
		}
	}
	return result;
}

export type ThermostatProtectionSource = Awaited<ReturnType<typeof resolveThermostatProtectionSource>>;
export function protectionBoundsValid(
	domain: { minimum: number; maximum: number } | null,
	cutoff: number,
	hysteresis: number,
): boolean {
	return (
		[cutoff, hysteresis, cutoff - hysteresis].every(Number.isFinite) &&
		hysteresis > 0 &&
		(!domain || (cutoff <= domain.maximum && cutoff > domain.minimum && cutoff - hysteresis > domain.minimum))
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
