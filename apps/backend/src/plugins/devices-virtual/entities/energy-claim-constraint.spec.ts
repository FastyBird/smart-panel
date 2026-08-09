import { DataSource } from 'typeorm';

import { DataTypeType, PermissionType, PropertyCategory } from '../../../modules/devices/devices.constants';
import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';

import { VirtualChannelPropertyEntity } from './devices-virtual.entity';

/**
 * The claim is only worth something if the database refuses a second one, and there are two places
 * that build the schema: the migration, for an installation that upgrades, and `synchronize`, which
 * CI and the e2e suite run with `FB_DB_SYNC=true`. The migration has its own spec; this one holds the
 * other half, because a constraint declared in only one of them is absent exactly where the tests
 * that rely on it run.
 */
describe('the energy claim constraint under synchronize', () => {
	let dataSource: DataSource;

	beforeAll(async () => {
		dataSource = new DataSource({
			type: 'sqlite',
			database: ':memory:',
			// The whole graph, so the single-table inheritance the projection lives in resolves.
			entities: [__dirname + '/../../../**/*.entity.ts'],
			synchronize: true,
		});

		await dataSource.initialize();
	});

	afterAll(async () => {
		await dataSource.destroy();
	});

	const projection = async (id: string, claim: string | null): Promise<void> => {
		await dataSource.getRepository(VirtualChannelPropertyEntity).insert({
			id,
			category: PropertyCategory.CONSUMPTION,
			permissions: [PermissionType.READ_ONLY],
			dataType: DataTypeType.FLOAT,
			energyClaimPropertyId: claim,
		} as never);
	};

	it('is created from the entity metadata, not only by the migration', async () => {
		const indexes: { name: string }[] = await dataSource.query(
			`SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'devices_module_channels_properties'`,
		);

		expect(indexes.map((index) => index.name)).toContain('UQ_channels_properties_energyClaim');
	});

	it('refuses a second claimant on the same meter', async () => {
		await dataSource.getRepository(ChannelPropertyEntity).insert({
			id: 'meter',
			category: PropertyCategory.CONSUMPTION,
			permissions: [PermissionType.READ_ONLY],
			dataType: DataTypeType.FLOAT,
		} as never);

		await projection('holder', 'meter');

		await expect(projection('contender', 'meter')).rejects.toThrow(/UNIQUE constraint failed/);
	});

	// Partial, or every projection that claims nothing would be competing for one NULL slot — which is
	// most of them, since only an energy-bearing destination ever earns a claim.
	it('lets any number of projections claim nothing', async () => {
		await projection('owned-a', null);
		await projection('owned-b', null);

		const unclaimed = await dataSource
			.getRepository(VirtualChannelPropertyEntity)
			.count({ where: { energyClaimPropertyId: null } });

		expect(unclaimed).toBeGreaterThanOrEqual(2);
	});

	// The claim is a link like the one beside it: deleting the meter releases it in the same statement
	// that orphans the projection, with nothing application-side involved.
	it('releases the claim when the meter row is deleted', async () => {
		await dataSource.getRepository(ChannelPropertyEntity).insert({
			id: 'doomed-meter',
			category: PropertyCategory.CONSUMPTION,
			permissions: [PermissionType.READ_ONLY],
			dataType: DataTypeType.FLOAT,
		} as never);

		await projection('claimant', 'doomed-meter');

		await dataSource.query(`PRAGMA foreign_keys = ON`);
		await dataSource.query(`DELETE FROM "devices_module_channels_properties" WHERE "id" = 'doomed-meter'`);

		const after = await dataSource.getRepository(VirtualChannelPropertyEntity).findOne({ where: { id: 'claimant' } });

		expect(after?.energyClaimPropertyId ?? null).toBeNull();
	});
});
