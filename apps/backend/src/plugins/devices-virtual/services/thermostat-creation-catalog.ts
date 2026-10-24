import { DataSource, EntityManager, QueryRunner } from 'typeorm';

import { SqliteDataSource } from '../../../common/database/sqlite-data-source';
import { captureCreation } from '../../../modules/devices/services/creation-capture';
import {
	VirtualChannelEntity,
	VirtualChannelPropertyEntity,
	VirtualDeviceEntity,
} from '../entities/devices-virtual.entity';

const TABLES = ['devices_module_devices', 'devices_module_channels', 'devices_module_channels_properties'] as const;
const ALLOCATOR = 'devices_virtual_thermostat_catalog_birth_allocator';
const SEAL = 'devices_virtual_thermostat_catalog_birth_schema';
const CONTRACT = 'thermostat-catalog-row-birth:v1';
const MAX = 9007199254740991n;
type Row = Record<string, unknown>;

// This schema is independently frozen in migration 48. Never repair an installed mismatch.
const DDL = Object.freeze({
	[ALLOCATOR]: `CREATE TABLE "${ALLOCATOR}" (
		"issued" INTEGER PRIMARY KEY AUTOINCREMENT CHECK(typeof("issued") = 'integer' AND "issued" BETWEEN 0 AND ${MAX}),
		"marker" INTEGER NOT NULL DEFAULT 0 CHECK("marker" = 0)
	)`,
	[SEAL]: `CREATE TABLE "${SEAL}" (
		"id" INTEGER PRIMARY KEY CHECK("id" = 1),
		"state" TEXT NOT NULL CHECK("state" IN ('INSTALLING', 'INSTALLED')),
		"contract" TEXT NOT NULL CHECK("contract" = '${CONTRACT}'), "manifest" TEXT NOT NULL
	)`,
	...Object.fromEntries(
		TABLES.flatMap((table) =>
			['insert', 'id'].map((event) => {
				const name = `${table}_thermostat_catalog_birth_${event}`;
				return [
					name,
					`CREATE TRIGGER "${name}" AFTER ${event === 'insert' ? 'INSERT' : 'UPDATE OF "id"'} ON "${table}"
			${event === 'id' ? 'WHEN NEW."id" IS NOT OLD."id"' : ''} BEGIN
			SELECT CASE WHEN (SELECT COUNT(*) FROM "${ALLOCATOR}") <> 1 OR EXISTS (
				SELECT 1 FROM "${ALLOCATOR}" WHERE typeof(issued) <> 'integer' OR issued < 0 OR issued >= ${MAX} OR marker IS NOT 0
			) THEN RAISE(ABORT, 'THERMOSTAT_CATALOG_CAPACITY') END;
			INSERT INTO "${ALLOCATOR}" (marker) VALUES (0);
			SELECT CASE WHEN (SELECT COUNT(*) FROM "${ALLOCATOR}") <> 2 OR NOT EXISTS (
				SELECT 1 FROM "${ALLOCATOR}" WHERE issued = last_insert_rowid() AND typeof(issued) = 'integer'
				AND issued BETWEEN 1 AND ${MAX} AND issued > (SELECT MIN(issued) FROM "${ALLOCATOR}")
			) THEN RAISE(ABORT, 'THERMOSTAT_CATALOG_ALLOCATION') END;
			DELETE FROM "${ALLOCATOR}" WHERE issued < last_insert_rowid();
			UPDATE "${table}" SET catalogBirth = last_insert_rowid() WHERE id = NEW.id;
			SELECT CASE WHEN NOT EXISTS (
				SELECT 1 FROM "${table}" WHERE id = NEW.id AND typeof(catalogBirth) = 'integer'
				AND catalogBirth = last_insert_rowid() AND catalogBirth BETWEEN 1 AND ${MAX}
			) THEN RAISE(ABORT, 'THERMOSTAT_CATALOG_STAMP') END;
		END`,
				];
			}),
		),
	),
});
const MANIFEST = JSON.stringify({ columns: TABLES, ddl: DDL });
const NAMES = Object.keys(DDL);
const SCHEMA_SQL = `SELECT 'object' section, json_object('name', name, 'sql', sql) payload
	FROM sqlite_master WHERE name IN (${NAMES.map((name) => `'${name}'`).join(',')})
	UNION ALL ${TABLES.map(
		(table) => `SELECT 'column', json_object('table', '${table}',
		'type', type, 'notnull', "notnull", 'default', dflt_value, 'pk', pk, 'hidden', hidden,
		'sql', (SELECT sql FROM sqlite_master WHERE name = '${table}'))
		FROM pragma_table_xinfo('${table}') WHERE name = 'catalogBirth'`,
	).join(' UNION ALL ')}
	UNION ALL SELECT 'seal', json_object('id', id, 'state', state, 'contract', contract, 'manifest', manifest) FROM "${SEAL}"`;

function invalid(): never {
	throw new Error('Invalid thermostat creation catalog identity');
}
function safeInteger(value: unknown, minimum = 0n): bigint {
	if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value)) invalid();
	const number = BigInt(value);
	if (number < minimum || number > MAX) invalid();
	return number;
}
function column(c: Row): void {
	if (
		(typeof c.type === 'string' ? c.type.toUpperCase() : '') !== 'INTEGER' ||
		c.notnull !== 0 ||
		c.default !== null ||
		c.pk !== 0 ||
		c.hidden !== 0 ||
		typeof c.sql !== 'string' ||
		!/"catalogBirth"\s+integer\s*(?=,|\))/i.test(c.sql) ||
		(c.sql.match(/"catalogBirth"/g) ?? []).length !== 1
	)
		invalid();
}
function schema(rows: readonly Row[], state = 'INSTALLED'): string {
	const decoded = rows.map((row) => {
		if (typeof row.payload !== 'string') invalid();
		const value: unknown = JSON.parse(row.payload);
		if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
		return { section: row.section, value: value as Row };
	});
	const objects = decoded.filter((row) => row.section === 'object');
	const columns = decoded.filter((row) => row.section === 'column');
	const seals = decoded.filter((row) => row.section === 'seal');
	if (
		objects.length !== NAMES.length ||
		new Set(objects.map((row) => row.value.name)).size !== NAMES.length ||
		objects.some(({ value }) => typeof value.name !== 'string' || DDL[value.name] !== value.sql) ||
		columns.length !== 3 ||
		seals.length !== 1 ||
		decoded.length !== NAMES.length + 4
	)
		invalid();
	for (const table of TABLES) {
		const matches = columns.filter(({ value }) => value.table === table);
		if (matches.length !== 1) invalid();
		column(matches[0].value);
	}
	const seal = seals[0].value;
	if (seal.id !== 1 || seal.state !== state || seal.contract !== CONTRACT || seal.manifest !== MANIFEST) invalid();
	return JSON.stringify([...rows].sort((a, b) => (a.payload as string).localeCompare(b.payload as string)));
}
async function verify(manager: EntityManager, state = 'INSTALLED', original?: readonly string[]): Promise<void> {
	schema(await manager.query<Row[]>(SCHEMA_SQL), state);
	const heads = await manager.query<Row[]>(
		`SELECT CAST(issued AS TEXT) h, typeof(issued) t, marker FROM "${ALLOCATOR}"`,
	);
	if (heads.length !== 1 || heads[0].t !== 'integer' || heads[0].marker !== 0) invalid();
	const head = safeInteger(heads[0].h);
	const sequence = await manager.query<Row[]>(
		'SELECT CAST(seq AS TEXT) s, typeof(seq) t FROM sqlite_sequence WHERE name = ?',
		[ALLOCATOR],
	);
	if (
		sequence.length !== 1 ||
		sequence[0].t !== 'integer' ||
		typeof sequence[0].s !== 'string' ||
		!/^(0|[1-9][0-9]*)$/.test(sequence[0].s) ||
		BigInt(sequence[0].s) < head
	)
		invalid();
	const rows = await manager.query<Row[]>(
		TABLES.map(
			(table) => `SELECT '${table}' kind, id, CAST(catalogBirth AS TEXT) b, typeof(catalogBirth) t FROM "${table}"`,
		).join(' UNION ALL '),
	);
	const seen = new Set<string>();
	for (const row of rows) {
		const birth = safeInteger(row.b, 1n);
		if (row.t !== 'integer' || birth > head || seen.has(birth.toString())) invalid();
		seen.add(birth.toString());
	}
	if (
		original &&
		JSON.stringify(rows.map((row) => JSON.stringify([row.kind, row.id])).sort()) !==
			JSON.stringify([...original].sort())
	)
		invalid();
}

export async function initializeThermostatCreationCatalog(
	manager: EntityManager,
	fresh: boolean,
	legacy = false,
	blocked = false,
): Promise<void> {
	const runner = manager.queryRunner;
	if (!runner?.isTransactionActive || Reflect.get(runner, 'transactionDepth') !== 1 || runner.manager !== manager)
		invalid();
	await manager.query('INSERT OR IGNORE INTO "devices_virtual_graph_revision" ("id", "revision") VALUES (1, 0)');
	const objects = await manager.query<Row[]>(
		`SELECT name FROM sqlite_master WHERE name IN (${NAMES.map(() => '?').join(',')})`,
		NAMES,
	);
	if (objects.length) return verify(manager);
	if (!fresh || blocked) invalid();
	const journal = await manager.query<Row[]>(
		"SELECT name FROM sqlite_master WHERE name = 'migrations' AND type = 'table'",
	);
	if (
		journal.length &&
		(
			await manager.query<Row[]>(
				"SELECT 1 FROM migrations WHERE name = 'AddThermostatCreationCatalogBirths1000000000048'",
			)
		).length
	)
		invalid();
	const existing = await manager.query<Row[]>(
		TABLES.map(
			(table) => `SELECT type, "notnull", dflt_value AS "default", pk, hidden,
			(SELECT sql FROM sqlite_master WHERE name = '${table}') sql
			FROM pragma_table_xinfo('${table}') WHERE name = 'catalogBirth'`,
		).join(' UNION ALL '),
	);
	if (existing.length !== 3 && !(legacy && existing.length === 0)) invalid();
	for (const existingColumn of existing) column(existingColumn);
	if (!existing.length)
		for (const table of TABLES) await manager.query(`ALTER TABLE "${table}" ADD COLUMN "catalogBirth" integer`);
	const originals: { table: string; id: string }[] = [];
	for (const table of TABLES) {
		const rows = await manager.query<Row[]>(`SELECT id, catalogBirth FROM "${table}" ORDER BY id`);
		for (const row of rows) {
			if (typeof row.id !== 'string' || row.catalogBirth !== null) invalid();
			originals.push({ table, id: row.id });
		}
	}
	for (const sql of Object.values(DDL)) await manager.query(sql);
	await manager.query(`INSERT INTO "${ALLOCATOR}" (issued, marker) VALUES (0, 0)`);
	await manager.query(`INSERT INTO "${SEAL}" VALUES (1, 'INSTALLING', ?, ?)`, [CONTRACT, MANIFEST]);
	let previous = 0n;
	for (const { table, id } of originals) {
		await manager.query(`INSERT INTO "${ALLOCATOR}" (marker) VALUES (0)`);
		const allocation = await manager.query<Row[]>(
			`SELECT CAST(issued AS TEXT) b, typeof(issued) t, CAST(last_insert_rowid() AS TEXT) actual FROM "${ALLOCATOR}" ORDER BY issued`,
		);
		if (
			allocation.length !== 2 ||
			allocation.some((row) => row.t !== 'integer') ||
			safeInteger(allocation[0].b) !== previous ||
			allocation[1].b !== allocation[1].actual
		)
			invalid();
		const birth = safeInteger(allocation[1].b, 1n);
		if (birth <= previous) invalid();
		await manager.query(`DELETE FROM "${ALLOCATOR}" WHERE issued < ?`, [String(birth)]);
		await manager.query(
			`UPDATE "${table}" SET catalogBirth = CAST(? AS INTEGER) WHERE id = ? AND catalogBirth IS NULL`,
			[String(birth), id],
		);
		const stamped = await manager.query<Row[]>(
			`SELECT changes() n, CAST(catalogBirth AS TEXT) b, typeof(catalogBirth) t FROM "${table}" WHERE id = ?`,
			[id],
		);
		if (stamped.length !== 1 || stamped[0].n !== 1 || stamped[0].t !== 'integer' || stamped[0].b !== String(birth))
			invalid();
		previous = birth;
	}
	await verify(
		manager,
		'INSTALLING',
		originals.map(({ table, id }) => JSON.stringify([table, id])),
	);
	await manager.query(`UPDATE "${SEAL}" SET state = 'INSTALLED' WHERE id = 1`);
	await verify(manager);
}

export type CatalogMember = Readonly<
	| { kind: 'device'; id: string; type: 'virtual' }
	| { kind: 'channel'; id: string; type: 'virtual'; deviceId: string; parentId: null }
	| { kind: 'property'; id: string; type: 'virtual'; channelId: string }
>;
export type CatalogBirth = CatalogMember & Readonly<{ birth: string }>;
export interface CatalogWitness {
	readonly schema: string;
	readonly members: readonly CatalogBirth[];
}
const OBSERVATION_SQL = `WITH root AS (SELECT * FROM "${TABLES[0]}" WHERE id = ?),
	channels AS (SELECT c.* FROM "${TABLES[1]}" c JOIN root r ON c.deviceId = r.id)
	SELECT 'member' section, json_object('kind', 'device', 'id', id, 'type', type,
		'birth', CAST(catalogBirth AS TEXT), 'nativeType', typeof(catalogBirth)) payload FROM root
	UNION ALL SELECT 'member', json_object('kind', 'channel', 'id', id, 'type', type,
		'deviceId', deviceId, 'parentId', parentId, 'birth', CAST(catalogBirth AS TEXT), 'nativeType', typeof(catalogBirth)) FROM channels
	UNION ALL SELECT 'member', json_object('kind', 'property', 'id', p.id, 'type', p.type,
		'channelId', p.channelId, 'birth', CAST(p.catalogBirth AS TEXT), 'nativeType', typeof(p.catalogBirth))
		FROM "${TABLES[2]}" p JOIN channels c ON p.channelId = c.id
	UNION ALL ${SCHEMA_SQL}`;
const order = (a: CatalogMember, b: CatalogMember) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id);
function membersEqual(actual: readonly CatalogMember[], expected: readonly CatalogMember[]): boolean {
	return JSON.stringify([...actual].sort(order)) === JSON.stringify([...expected].sort(order));
}
export function expectedThermostatCatalog(draft: {
	id: string;
	channels: { id: string; properties: { id: string }[] }[];
}): readonly CatalogMember[] {
	const result: CatalogMember[] = [Object.freeze({ kind: 'device', id: draft.id, type: 'virtual' })];
	for (const channel of draft.channels) {
		result.push(
			Object.freeze({ kind: 'channel', id: channel.id, type: 'virtual', deviceId: draft.id, parentId: null }),
		);
		for (const property of channel.properties)
			result.push(Object.freeze({ kind: 'property', id: property.id, type: 'virtual', channelId: channel.id }));
	}
	if (
		result.some((row) => typeof row.id !== 'string' || !row.id) ||
		new Set(result.map((row) => `${row.kind}:${row.id}`)).size !== result.length
	)
		invalid();
	return Object.freeze(result.sort(order));
}
export function assertThermostatCatalog(actual: readonly CatalogMember[], expected: readonly CatalogMember[]): void {
	if (!membersEqual(actual, expected)) invalid();
}
type NativeKinds = Readonly<Record<CatalogMember['kind'], string>>;
function witness(raw: unknown, expected: readonly CatalogMember[], nativeKinds: NativeKinds): CatalogWitness {
	if (!Array.isArray(raw)) invalid();
	const rows = raw as Row[];
	const members: CatalogBirth[] = [];
	const births = new Set<string>();
	for (const row of rows.filter((row) => row.section === 'member')) {
		if (typeof row.payload !== 'string') invalid();
		const value: unknown = JSON.parse(row.payload);
		if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
		const item = value as Row;
		const { birth, nativeType, ...membership } = item;
		if (nativeType !== 'integer' || typeof item.id !== 'string') invalid();
		safeInteger(birth, 1n);
		if (births.has(birth as string)) invalid();
		births.add(birth as string);
		const original = expected.find((entry) => entry.kind === item.kind && entry.id === item.id);
		if (!original || item.type !== nativeKinds[original.kind]) invalid();
		// The API kind is virtual; the stored STI discriminator is independently pinned above.
		membership.type = original.type;
		if (
			Object.keys(item).length !== Object.keys(original).length + 2 ||
			!membersEqual([membership as CatalogMember], [original])
		)
			invalid();
		members.push(Object.freeze({ ...original, birth: birth as string }));
	}
	assertThermostatCatalog(
		members.map(({ birth: _birth, ...member }) => member as CatalogMember),
		expected,
	);
	return Object.freeze({
		schema: schema(rows.filter((row) => row.section !== 'member')),
		members: Object.freeze(members.sort(order)),
	});
}
export function sameThermostatCatalog(actual: CatalogWitness, original: CatalogWitness): void {
	if (actual.schema !== original.schema || JSON.stringify(actual.members) !== JSON.stringify(original.members))
		invalid();
}
interface PhysicalDriver {
	connection: DataSource;
	databaseConnection: object;
	createQueryRunner: () => QueryRunner;
}
function pinReader(source: DataSource) {
	if (!(source instanceof SqliteDataSource) || !source.isInitialized) invalid();
	const sourcePin = captureCreation(source, [
		'manager',
		'driver',
		'query',
		'createQueryRunner',
		'isInitialized',
		'getMetadata',
		'entityMetadatas',
	]);
	const nativePins: { current(): boolean }[] = [];
	const registered = [...sourcePin.values.entityMetadatas];
	function nativeKind(
		target: typeof VirtualDeviceEntity | typeof VirtualChannelEntity | typeof VirtualChannelPropertyEntity,
		table: string,
	): string {
		const metadata = captureCreation(sourcePin.values.getMetadata.call(source, target), [
			'target',
			'discriminatorValue',
			'tableName',
			'discriminatorColumn',
		]);
		const values = metadata.values;
		const discriminator: unknown = values.discriminatorValue;
		if (
			registered.filter((entry) => entry.target === target).length !== 1 ||
			!registered.includes(metadata.receiver) ||
			values.target !== target ||
			values.tableName !== table ||
			typeof discriminator !== 'string' ||
			!discriminator ||
			!values.discriminatorColumn
		)
			invalid();
		const column = captureCreation(values.discriminatorColumn, ['databaseName', 'isDiscriminator']);
		if (column.values.databaseName !== 'type' || column.values.isDiscriminator !== true) invalid();
		nativePins.push(metadata, column);
		return discriminator;
	}
	const nativeKinds: NativeKinds = Object.freeze({
		device: nativeKind(VirtualDeviceEntity, TABLES[0]),
		channel: nativeKind(VirtualChannelEntity, TABLES[1]),
		property: nativeKind(VirtualChannelPropertyEntity, TABLES[2]),
	});
	const manager = sourcePin.values.manager;
	const managerPin = captureCreation(manager, ['connection', 'query', 'queryRunner']);
	const driver = sourcePin.values.driver as unknown as PhysicalDriver;
	const descriptor = Object.getOwnPropertyDescriptor(driver, 'databaseConnection');
	if (
		!descriptor ||
		!('value' in descriptor) ||
		!descriptor.value ||
		typeof descriptor.value !== 'object' ||
		managerPin.values.connection !== source ||
		managerPin.values.queryRunner !== undefined ||
		driver.connection !== source
	)
		invalid();
	const driverPin = captureCreation(driver, ['connection', 'databaseConnection', 'createQueryRunner']);
	const physical = driverPin.values.databaseConnection;
	let observation: readonly Readonly<{ section: string; payload: string }>[] | undefined;
	const current = () =>
		sourcePin.current() &&
		managerPin.current() &&
		driverPin.current() &&
		nativePins.every((pin) => pin.current()) &&
		source.entityMetadatas.length === registered.length &&
		registered.every((entry, index) => source.entityMetadatas[index] === entry) &&
		source.isInitialized &&
		driver.databaseConnection === physical;
	function check(): void {
		if (!current()) invalid();
	}
	function reader(selected: EntityManager, scoped?: QueryRunner) {
		const selectedPin = captureCreation(selected, ['connection', 'query', 'queryRunner']);
		const runnerPin = scoped
			? captureCreation(scoped as QueryRunner & { driver: PhysicalDriver }, [
					'manager',
					'connection',
					'driver',
					'query',
					'connect',
				])
			: undefined;
		const valid = () => {
			check();
			if (
				!selectedPin.current() ||
				selectedPin.values.connection !== source ||
				selectedPin.values.queryRunner !== scoped ||
				(scoped &&
					(!runnerPin.current() ||
						scoped.manager !== selected ||
						scoped.connection !== source ||
						runnerPin.values.driver !== driver ||
						!scoped.isTransactionActive ||
						Reflect.get(scoped, 'transactionDepth') !== 1))
			)
				invalid();
		};
		return async (root: string, expected: readonly CatalogMember[]) => {
			observation = undefined;
			valid();
			const raw: unknown = await selectedPin.values.query.call(selected, OBSERVATION_SQL, [root]);
			if (
				Array.isArray(raw) &&
				raw.every((row: Row) => typeof row.section === 'string' && typeof row.payload === 'string')
			)
				observation = Object.freeze(
					(raw as { section: string; payload: string }[]).map(({ section, payload }) =>
						Object.freeze({ section, payload }),
					),
				);
			valid();
			return witness(raw, expected, nativeKinds);
		};
	}
	return Object.freeze({
		current,
		check,
		read: reader(manager),
		evidence: () => observation,
		scoped(manager: EntityManager) {
			check();
			if (!manager.queryRunner) invalid();
			return reader(manager, manager.queryRunner);
		},
	});
}
export const thermostatCreationCatalog = Object.freeze({
	pin: pinReader,
	expected: expectedThermostatCatalog,
	same: sameThermostatCatalog,
	assert: assertThermostatCatalog,
});
