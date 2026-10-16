import { SpaceEntity } from '../../../modules/spaces/entities/space.entity';
import {
	ActivityActivationStatus,
	ActivityDomain,
	ActivityDomainStatus,
	ActivityMode,
} from '../activity/space-activity.constants';
import { defaultActivityConfiguration } from '../activity/space-activity.defaults';
import { SpaceActivityConfigEntity } from '../entities/space-activity-config.entity';
import { SpaceActivityStateEntity } from '../entities/space-activity-state.entity';
import { ZoneSpaceEntity } from '../entities/zone-space.entity';

import { activityTestDatabase } from './activity-test-support';

jest.setTimeout(30000);
describe('persisted activity configuration and lifecycle', () => {
	let harness: Awaited<ReturnType<typeof activityTestDatabase>>;
	beforeEach(async () => {
		harness = await activityTestDatabase();
	});
	afterEach(async () => {
		await harness.database.destroy();
	});
	it('materializes five independent rows for new rooms and zones; GET never writes', async () => {
		const { database, lifecycle, configs, room } = harness;
		const zone = await database
			.getRepository(ZoneSpaceEntity)
			.save(database.getRepository(ZoneSpaceEntity).create({ name: 'Floor' }));
		await database.transaction((manager) => lifecycle.reconcile(zone, manager));
		const before = await database.getRepository(SpaceActivityConfigEntity).count();
		const modes = await configs.list(room.id);
		expect(modes).toHaveLength(5);
		expect(await configs.list(zone.id)).toHaveLength(5);
		expect(modes.every((mode) => mode.spaceId === room.id && mode.activityRevision === 1)).toBe(true);
		expect(await database.getRepository(SpaceActivityConfigEntity).count()).toBe(before);
		await expect(configs.get(room.id, ActivityMode.WORK)).resolves.toMatchObject({
			activityConfiguration: defaultActivityConfiguration(ActivityMode.WORK),
		});
	});
	it('persists overrides, rejects stale CAS and reset copies authored defaults', async () => {
		const { configs, room } = harness;
		const configuration = defaultActivityConfiguration(ActivityMode.RELAX);
		configuration.lighting.brightness = 40;
		const saved = await configs.update(room.id, ActivityMode.RELAX, {
			expected_revision: 1,
			enabled: false,
			display_order: 20,
			configuration,
		});
		expect(saved).toMatchObject({
			activityRevision: 2,
			activityEnabled: false,
			activityOrder: 20,
			activityConfiguration: { lighting: { brightness: 40 } },
		});
		await expect(configs.reset(room.id, ActivityMode.RELAX, 1)).rejects.toThrow('revision');
		expect(await configs.reset(room.id, ActivityMode.RELAX, 2)).toMatchObject({
			activityRevision: 3,
			activityEnabled: true,
			activityConfiguration: defaultActivityConfiguration(ActivityMode.RELAX),
		});
		expect((await configs.get(room.id, ActivityMode.WORK)).activityRevision).toBe(1);
	});
	it('removes owned roles on scope transition and recreates defaults on return', async () => {
		const { database, lifecycle, configs, room } = harness;
		await database.query(`UPDATE spaces_module_spaces SET type = 'entry' WHERE id = ?`, [room.id]);
		const entry = await database.getRepository(SpaceEntity).findOneByOrFail({ id: room.id });
		await database.transaction((manager) => lifecycle.reconcile(entry, manager));
		expect(await database.getRepository(SpaceActivityConfigEntity).count()).toBe(0);
		await expect(configs.list(room.id)).rejects.toThrow('rooms and zones');
		await database.query(`UPDATE spaces_module_spaces SET type = 'room' WHERE id = ?`, [room.id]);
		await database.transaction((manager) => lifecycle.reconcile(room, manager));
		expect(await configs.list(room.id)).toHaveLength(5);
		await database.getRepository(SpaceEntity).delete(room.id);
		expect(await database.getRepository(SpaceActivityConfigEntity).count()).toBe(0);
		expect(await database.getRepository(SpaceActivityStateEntity).count()).toBe(0);
	});
	it('enforces partial uniqueness without interfering with other STI role kinds', async () => {
		const { database, configs, room } = harness;
		const existing = await configs.get(room.id, ActivityMode.WORK);
		await expect(
			database.getRepository(SpaceActivityConfigEntity).insert({ ...existing, id: undefined }),
		).rejects.toThrow();
	});
	it.each(Object.values(ActivityActivationStatus))(
		'editing a selected %s configuration preserves completed outcomes and only interrupts pending work',
		async (status) => {
			const { database, configs, room } = harness;
			const results = [
				{ domain: ActivityDomain.LIGHTING, status: ActivityDomainStatus.SUCCEEDED, reason: 'completed' },
			];
			const repository = database.getRepository(SpaceActivityStateEntity);
			const state = await repository.save(
				repository.create({
					spaceId: room.id,
					activationId: 'existing-selection',
					selectedActivityMode: status === ActivityActivationStatus.DEACTIVATED ? null : ActivityMode.WORK,
					selectedActivityRevision: 1,
					activityStatus: status,
					activityResults: results,
				}),
			);
			const saved = await configs.update(room.id, ActivityMode.WORK, {
				expected_revision: 1,
				enabled: true,
				display_order: 0,
				configuration: defaultActivityConfiguration(ActivityMode.WORK),
			});
			expect(saved.activityRevision).toBe(2);
			expect(await repository.findOneByOrFail({ id: state.id })).toMatchObject({
				activationId: state.activationId,
				selectedActivityRevision: 1,
				activityResults: results,
				activityStatus: status === ActivityActivationStatus.ACTIVATING ? ActivityActivationStatus.INTERRUPTED : status,
			});
		},
	);
});
