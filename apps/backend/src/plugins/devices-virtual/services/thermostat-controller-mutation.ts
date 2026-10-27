import { DataSource, EntityManager, EntityTarget, ObjectLiteral } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

import { registerSqliteCommitGuard } from '../../../common/database/sqlite-data-source';
import { PermissionType } from '../../../modules/devices/devices.constants';
import { DevicesValidationException } from '../../../modules/devices/devices.exceptions';
import { captureCreation, snapshotCreation } from '../../../modules/devices/services/creation-capture';
import { ChannelPropertyEntitySubscriber } from '../../../modules/devices/subscribers/channel-property-entity.subscriber';
import { VirtualChannelPropertyEntity } from '../entities/devices-virtual.entity';
import { ThermostatCoolingDependencyEntity } from '../entities/thermostat-cooling-dependency.entity';
import { ThermostatMemberProtectionEntity } from '../entities/thermostat-member-protection.entity';
import {
	VirtualThermostatActuatorClaimEntity,
	VirtualThermostatConfigEntity,
	VirtualThermostatRecoveryEntity,
	VirtualThermostatSettingEntity,
	VirtualThermostatSourceEntity,
} from '../entities/virtual-thermostat.entity';

const configurationColumns = [
	'controllerId',
	'displayFloorClaimId',
	'ownerDeviceId',
	'schemaVersion',
	'revision',
	'requestedMode',
	'controlStrategy',
	'locked',
	'comfort',
	'policy',
	'heuristic',
	'contactOpeningMs',
	'contactClosingMs',
	'configuredAt',
	'releaseRequestedAt',
] as const;
const claimColumns = [
	'id',
	'controllerId',
	'role',
	'physicalIdentity',
	'providerProfile',
	'providerProfileVersion',
	'sourcePropertyId',
	'sourcePropertyIdentity',
	'sourceDeviceId',
	'sourceDeviceIdentity',
	'contractFingerprint',
	'revision',
	'qualificationGeneration',
	'state',
	'leaseSeconds',
	'reason',
	'releaseRequestedAt',
	'releasedAt',
	'releaseEvidence',
] as const;
const sourceColumns = [
	'id',
	'controllerId',
	'role',
	'sourcePropertyId',
	'sourcePropertyIdentity',
	'physicalIdentity',
	'contractFingerprint',
	'maximumAgeSeconds',
	'openValue',
	'closedValue',
] as const;
const settingColumns = ['propertyId', 'controllerId', 'setting', 'contractFingerprint'] as const;
const propertyColumns = [
	'id',
	'createdAt',
	'updatedAt',
	'type',
	'catalogBirth',
	'category',
	'identifier',
	'name',
	'permissions',
	'dataType',
	'format',
	'invalid',
	'step',
	'channelId',
	'valueOrigin',
	'sourcePropertyId',
	'energyClaimPropertyId',
] as const;
const protectionColumns = [
	'claimId',
	'schemaVersion',
	'kind',
	'revision',
	'sourcePropertyId',
	'sourcePropertyIdentity',
	'physicalPropertyIdentity',
	'contractFingerprint',
	'maximumAgeSeconds',
] as const;
const coolingColumns = [
	'claimId',
	'schemaVersion',
	'revision',
	'dewPointPropertyId',
	'dewPointIdentity',
	'dewPointFingerprint',
	'surfacePropertyId',
	'surfaceIdentity',
	'physicalSurfaceIdentity',
	'surfaceFingerprint',
	'purpose',
	'maximumAgeSeconds',
] as const;
const recoveryColumns = [
	'id',
	'controllerId',
	'claimId',
	'physicalIdentity',
	'previousPropertyIdentity',
	'restoredPropertyId',
	'actorId',
	'reason',
	'disconnectionAcknowledged',
	'configurationRevision',
	'claimRevision',
	'createdAt',
] as const;

type Stored = Readonly<Record<string, unknown>>;
interface Partition {
	readonly entity: EntityTarget<ObjectLiteral>;
	readonly key: string;
	readonly columns: readonly string[];
	readonly membership: string;
}
const partitions = {
	configuration: {
		entity: VirtualThermostatConfigEntity,
		key: 'controllerId',
		columns: configurationColumns,
		membership: '"controllerId" = :controllerId',
	},
	sources: {
		entity: VirtualThermostatSourceEntity,
		key: 'id',
		columns: sourceColumns,
		membership: '"controllerId" = :controllerId',
	},
	settings: {
		entity: VirtualThermostatSettingEntity,
		key: 'propertyId',
		columns: settingColumns,
		membership: '"controllerId" = :controllerId',
	},
	properties: {
		entity: VirtualChannelPropertyEntity,
		key: 'id',
		columns: propertyColumns,
		membership: '"channelId" IN (SELECT "id" FROM "devices_module_channels" WHERE "deviceId" = :controllerId)',
	},
	claims: {
		entity: VirtualThermostatActuatorClaimEntity,
		key: 'id',
		columns: claimColumns,
		membership: '"controllerId" = :controllerId',
	},
	protections: {
		entity: ThermostatMemberProtectionEntity,
		key: 'claimId',
		columns: protectionColumns,
		membership:
			'"claimId" IN (SELECT "id" FROM "devices_virtual_thermostat_actuator_claims" WHERE "controllerId" = :controllerId)',
	},
	cooling: {
		entity: ThermostatCoolingDependencyEntity,
		key: 'claimId',
		columns: coolingColumns,
		membership:
			'"claimId" IN (SELECT "id" FROM "devices_virtual_thermostat_actuator_claims" WHERE "controllerId" = :controllerId)',
	},
	recoveries: {
		entity: VirtualThermostatRecoveryEntity,
		key: 'id',
		columns: recoveryColumns,
		membership: '"controllerId" = :controllerId',
	},
} satisfies Record<string, Partition>;
type PartitionName = keyof typeof partitions;
export type ControllerMutationImage = Readonly<Record<PartitionName, readonly Stored[]>>;

function bytes(row: Stored): string {
	return JSON.stringify(row);
}
function ordered(rows: readonly Stored[], key: string): readonly Stored[] {
	return [...rows].sort((a, b) => {
		const left = a[key];
		const right = b[key];
		if (typeof left !== 'string' || typeof right !== 'string') refuse();
		return left.localeCompare(right);
	});
}
function refuse(): never {
	throw new DevicesValidationException('Thermostat affected rows changed during the native operation.');
}

/** Fixed thermostat columns only. Values use the same driver representation as their SQL predicates. */
function stored(database: DataSource, partition: Partition, row: ObjectLiteral): Stored {
	const metadata = database.getMetadata(partition.entity);
	return Object.freeze(
		Object.fromEntries(
			partition.columns.map((key) => {
				const column = metadata.findColumnWithPropertyName(key);
				if (!column || row[key] === undefined) refuse();
				return [key, database.driver.preparePersistentValue(snapshotCreation(row[key] as unknown), column) as unknown];
			}),
		),
	);
}

export async function readControllerMutationImage(
	manager: EntityManager,
	controllerId: string,
): Promise<ControllerMutationImage> {
	const result = {} as Record<PartitionName, readonly Stored[]>;
	for (const name of Object.keys(partitions) as PartitionName[]) {
		const partition: Partition = partitions[name];
		const rows = await manager
			.createQueryBuilder(partition.entity, 'owned')
			.select(partition.columns.map((column) => `owned.${column} AS "${column}"`))
			.where(partition.membership, { controllerId })
			.callListeners(false)
			.getRawMany<Stored>();
		// Retain actual stored bytes, including legacy CURRENT_TIMESTAMP precision and JSON text.
		result[name] = Object.freeze(
			ordered(
				rows.map((row) => Object.freeze({ ...row })),
				partition.key,
			),
		);
	}
	return Object.freeze(result);
}

export async function assertControllerMutationImage(
	manager: EntityManager,
	controllerId: string,
	expected: ControllerMutationImage,
): Promise<void> {
	if (bytes(await readControllerMutationImage(manager, controllerId)) !== bytes(expected)) refuse();
}

/** Compare the desired configuration without manufacturing new identities for an unchanged image. */
export function controllerConfigurationUnchanged(
	manager: EntityManager,
	before: ControllerMutationImage,
	prepared: {
		config: ObjectLiteral;
		sources: readonly ObjectLiteral[];
		settings: readonly ObjectLiteral[];
		actuators: readonly ObjectLiteral[];
		protections: readonly ObjectLiteral[];
		coolingDependencies: readonly ObjectLiteral[];
	},
	explicitSourceIds: readonly (string | undefined)[],
): boolean {
	if (before.configuration.length !== 1) return false;
	const original = before.configuration[0];
	if (!Number.isSafeInteger(original.revision) || Number(original.revision) < 1) refuse();
	const config = stored(manager.connection, partitions.configuration, prepared.config);
	// These two fields are generated only by an applied configuration, not requested evidence refresh.
	if (bytes({ ...config, revision: original.revision, configuredAt: original.configuredAt }) !== bytes(original))
		return false;
	const compare = (
		name: 'settings' | 'claims' | 'protections' | 'cooling',
		desired: readonly ObjectLiteral[],
		incremented: boolean,
	) => {
		const partition = partitions[name];
		const previous = name === 'claims' ? before[name].filter((row) => row.state !== 'released') : before[name];
		if (previous.length !== desired.length) return false;
		return desired.every((row) => {
			const actual = stored(manager.connection, partition, row);
			const old = previous.find((candidate) => candidate[partition.key] === actual[partition.key]);
			if (!old) return false;
			if (incremented && (!Number.isSafeInteger(old.revision) || Number(old.revision) < 1)) refuse();
			return bytes(incremented ? { ...actual, revision: old.revision } : actual) === bytes(old);
		});
	};
	if (
		!compare('settings', prepared.settings, false) ||
		!compare('claims', prepared.actuators, true) ||
		!compare('protections', prepared.protections, true) ||
		!compare('cooling', prepared.coolingDependencies, true)
	)
		return false;
	if (before.sources.length !== prepared.sources.length || explicitSourceIds.length !== prepared.sources.length)
		return false;
	const matched = new Set<unknown>();
	for (const [index, source] of prepared.sources.entries()) {
		const row = stored(manager.connection, partitions.sources, source);
		const matches = before.sources.filter(
			(old) =>
				!matched.has(old.id) &&
				(!explicitSourceIds[index] || old.id === explicitSourceIds[index]) &&
				bytes({ ...row, id: old.id }) === bytes(old),
		);
		if (matches.length !== 1) return false;
		matched.add(matches[0].id);
	}
	for (const property of before.properties) {
		const next = prepared.settings.some((row) => row.propertyId === property.id)
			? [PermissionType.READ_WRITE].join(',')
			: before.settings.some((row) => row.propertyId === property.id)
				? [PermissionType.READ_ONLY].join(',')
				: property.permissions;
		if (property.permissions !== next) return false;
	}
	return true;
}

/** Retained rows use full-preimage conditional DML, never save/upsert rebirth. New rows use INSERT. */
export async function writeControllerPartition(
	manager: EntityManager,
	name: Exclude<PartitionName, 'properties'>,
	before: readonly Stored[],
	rows: readonly ObjectLiteral[],
	retainUnmentioned = false,
): Promise<readonly Stored[]> {
	const partition: Partition = partitions[name];
	const expected = new Map(before.map((row) => [row[partition.key], row]));
	const plans = rows.map((row) => {
		const image = { ...stored(manager.connection, partition, row) };
		const previous = before.find((old) => old[partition.key] === image[partition.key]);
		if (previous) {
			const metadata = manager.connection.getMetadata(partition.entity);
			for (const key of partition.columns) {
				const column = metadata.findColumnWithPropertyName(key);
				const hydrated = manager.connection.driver.prepareHydratedValue(previous[key], column) as unknown;
				const normalized = manager.connection.driver.preparePersistentValue(hydrated, column) as unknown;
				// An unchanged field keeps its original storage representation. It is still compared
				// in full in the conditional predicate and final image, never omitted from proof.
				if (JSON.stringify(normalized) === JSON.stringify(image[key])) image[key] = previous[key];
			}
		}
		return { value: snapshotCreation(row), image: Object.freeze(image) };
	});
	if (new Set(plans.map(({ image }) => image[partition.key])).size !== plans.length) refuse();
	for (const previous of before) {
		const plan = plans.find(({ image }) => image[partition.key] === previous[partition.key]);
		if (!plan && retainUnmentioned) continue;
		if (plan && bytes(plan.image) === bytes(previous)) continue;
		const query = plan
			? manager
					.createQueryBuilder()
					.update(partition.entity)
					.set(
						Object.fromEntries(
							partition.columns
								.filter((key) => JSON.stringify(plan.image[key]) !== JSON.stringify(previous[key]))
								.map((key): [string, unknown] => [key, plan.value[key] as unknown]),
						) as QueryDeepPartialEntity<ObjectLiteral>,
					)
			: manager.createQueryBuilder().delete().from(partition.entity);
		for (const key of partition.columns) query.andWhere(`"${key}" IS :old_${key}`, { [`old_${key}`]: previous[key] });
		if ((await query.execute()).affected !== 1) refuse();
		if (plan) expected.set(plan.image[partition.key], plan.image);
		else expected.delete(previous[partition.key]);
	}
	for (const plan of plans) {
		if (before.some((row) => row[partition.key] === plan.image[partition.key])) continue;
		await manager.insert(
			partition.entity,
			Object.fromEntries(
				partition.columns.map((key): [string, unknown] => [key, plan.value[key] as unknown]),
			) as QueryDeepPartialEntity<ObjectLiteral>,
		);
		expected.set(plan.image[partition.key], plan.image);
	}
	return Object.freeze(ordered([...expected.values()], partition.key));
}

/** Existing permission publications stay in their original order; each owns its complete virtual row. */
export async function writeControllerSettingPermissions(
	manager: EntityManager,
	before: ControllerMutationImage,
	settings: readonly VirtualThermostatSettingEntity[],
): Promise<readonly Stored[]> {
	const expected = new Map(before.properties.map((row) => [row.id, row]));
	const writes = [
		...before.settings
			.filter((old) => !settings.some((row) => row.propertyId === old.propertyId))
			.map((old) => ({ id: old.propertyId, permissions: [PermissionType.READ_ONLY] })),
		...settings.map((row) => ({ id: row.propertyId, permissions: [PermissionType.READ_WRITE] })),
	];
	for (const write of writes) {
		const previous = expected.get(write.id);
		if (!previous) refuse();
		const subscribers = [...manager.connection.subscribers];
		const timestampOwners = subscribers.filter((subscriber) => subscriber instanceof ChannelPropertyEntitySubscriber);
		if (timestampOwners.length > 1) refuse();
		const owner = timestampOwners[0];
		const pin = owner && captureCreation(owner, ['beforeUpdate', 'captureUpdateTimestamp', 'listenTo']);
		const current = () =>
			(!pin || pin.current()) &&
			manager.connection.subscribers.length === subscribers.length &&
			manager.connection.subscribers.every((subscriber, index) => subscriber === subscribers[index]);
		registerSqliteCommitGuard(manager, current);
		const payload = { permissions: write.permissions };
		const timestamp = pin?.values.captureUpdateTimestamp.call(pin.receiver, payload);
		try {
			const query = manager.createQueryBuilder().update(VirtualChannelPropertyEntity).set(payload);
			for (const key of propertyColumns) query.andWhere(`"${key}" IS :old_${key}`, { [`old_${key}`]: previous[key] });
			if ((await query.execute()).affected !== 1 || !current()) refuse();
			const updatedAt: unknown = timestamp
				? manager.connection.driver.preparePersistentValue(
						new Date(timestamp.read()),
						manager.connection.getMetadata(VirtualChannelPropertyEntity).findColumnWithPropertyName('updatedAt'),
					)
				: previous.updatedAt;
			expected.set(write.id, Object.freeze({ ...previous, permissions: write.permissions.join(','), updatedAt }));
		} finally {
			timestamp?.close();
		}
	}
	return Object.freeze(ordered([...expected.values()], 'id'));
}

/** Closed referenced catalog/producer partitions read before validation, never cache or history input. */
export async function captureControllerBindings(
	manager: EntityManager,
	controllerId: string,
	before: ControllerMutationImage,
	requestedProperties: readonly unknown[],
	readEdges: (manager: EntityManager) => Promise<readonly { outputPropertyId: string; sourcePropertyId: string }[]>,
): Promise<(properties?: readonly Stored[], manager?: EntityManager, advancedGraphRevision?: number) => Promise<void>> {
	const roots = new Set<string>();
	const add = (value: unknown) => {
		if (typeof value === 'string' && value) roots.add(value);
	};
	requestedProperties.forEach(add);
	for (const row of before.sources) {
		add(row.sourcePropertyId);
		add(row.sourcePropertyIdentity);
	}
	for (const row of before.claims) {
		add(row.sourcePropertyId);
		add(row.sourcePropertyIdentity);
	}
	for (const row of before.settings) add(row.propertyId);
	for (const row of before.protections) {
		add(row.sourcePropertyId);
		add(row.sourcePropertyIdentity);
	}
	for (const row of before.cooling) {
		add(row.dewPointPropertyId);
		add(row.dewPointIdentity);
		add(row.surfacePropertyId);
		add(row.surfaceIdentity);
	}
	const producerTables = [
		['devices_virtual_transform_configs', 'outputPropertyId'],
		['devices_virtual_transform_sources', 'id'],
		['devices_virtual_dew_point_configs', 'outputPropertyId'],
		['devices_virtual_dew_point_sources', 'outputPropertyId, role'],
		['devices_virtual_aggregate_configs', 'outputPropertyId'],
		['devices_virtual_aggregate_inputs', 'id'],
	] as const;
	const strings = (values: readonly unknown[]) =>
		[...new Set(values.filter((value): value is string => typeof value === 'string'))].sort();
	const read = async (readManager = manager) => {
		const select = async (table: string, key: string, ids: readonly string[], order = 'id'): Promise<Stored[]> =>
			ids.length
				? readManager.query<Stored[]>(
						`SELECT * FROM "${table}" WHERE "${key}" IN (${ids.map(() => '?').join(',')}) ORDER BY ${order}`,
						[...ids],
					)
				: [];
		const edges = [...(await readEdges(readManager))].sort(
			(a, b) =>
				a.outputPropertyId.localeCompare(b.outputPropertyId) || a.sourcePropertyId.localeCompare(b.sourcePropertyId),
		);
		const ids = new Set(roots);
		let size: number;
		do {
			size = ids.size;
			for (const edge of edges) if (ids.has(edge.outputPropertyId)) ids.add(edge.sourcePropertyId);
		} while (ids.size !== size);
		const properties = await select('devices_module_channels_properties', 'id', [...ids].sort());
		const channels = await select('devices_module_channels', 'id', strings(properties.map((row) => row.channelId)));
		const devices = await select(
			'devices_module_devices',
			'id',
			strings([controllerId, ...channels.map((row) => row.deviceId)]),
		);
		const producers: Record<string, readonly Stored[]> = {};
		for (const [table, order] of producerTables)
			producers[table] = await select(table, 'outputPropertyId', [...ids].sort(), order);
		const graph = await readManager.query<Stored[]>('SELECT * FROM devices_virtual_graph_revision WHERE id = 1');
		return { properties, channels, devices, producers, edges, graph };
	};
	// Serialize immediately: listeners retaining their query result cannot alter this private preimage.
	const expectedBytes = JSON.stringify(await read());
	return async (permissions = before.properties, readManager = manager, advancedGraphRevision?: number) => {
		const expected = JSON.parse(expectedBytes) as Awaited<ReturnType<typeof read>>;
		if (advancedGraphRevision !== undefined) {
			if (expected.graph.length > 1 || (expected.graph[0] && expected.graph[0].id !== 1)) refuse();
			const previous = expected.graph[0]?.revision ?? 0;
			if (!Number.isSafeInteger(previous) || Number(previous) < 0 || advancedGraphRevision !== Number(previous) + 1)
				refuse();
			expected.graph = [{ ...(expected.graph[0] ?? { id: 1 }), revision: advancedGraphRevision }];
		}
		for (const property of expected.properties) {
			const intended = permissions.find((row) => row.id === property.id);
			if (intended)
				expected.properties[expected.properties.indexOf(property)] = {
					...property,
					permissions: intended.permissions,
					// The permission writer owns the original subscriber timestamp before any later callback.
					updatedAt: intended.updatedAt,
				};
		}
		if (JSON.stringify(await read(readManager)) !== JSON.stringify(expected)) refuse();
	};
}
