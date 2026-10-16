import { SpaceEntity } from '../../../modules/spaces/entities/space.entity';
import { domainResult } from '../activity/activity-result.utils';
import {
	ACTIVITY_STATE_CHANGED,
	ActivityMode,
	ActivityDomain as Domain,
	ActivityActivationStatus as State,
	ActivityDomainStatus as Status,
} from '../activity/space-activity.constants';
import { defaultActivityConfiguration } from '../activity/space-activity.defaults';
import { SpaceActivityStateEntity } from '../entities/space-activity-state.entity';

import { activityTestDatabase, deferred } from './activity-test-support';
import { SpaceActivationIdentity } from './space-climate-automation.port';
import { SpaceModeService } from './space-mode.service';

jest.setTimeout(30000);
describe('SQLite activity orchestration persistence and fencing', () => {
	let harness: Awaited<ReturnType<typeof activityTestDatabase>>;
	let service: SpaceModeService;
	let run: jest.Mock;
	beforeEach(async () => {
		harness = await activityTestDatabase();
		run = jest.fn((domain: Domain) =>
			Promise.resolve(domainResult(domain, domain === Domain.LIGHTING ? Status.SUCCEEDED : Status.NO_TARGETS, 'test')),
		);
		service = new SpaceModeService(harness.database, harness.configs, { run } as never, harness.events);
	});
	afterEach(async () => {
		await harness.database.destroy();
	});
	it('preview performs no state writes or events, and selected mode survives partial failure and restart', async () => {
		const { database, room, configs, events } = harness;
		const emitted = jest.spyOn(events, 'emit');
		await service.preview(room.id, ActivityMode.WORK, 1);
		expect(await database.getRepository(SpaceActivityStateEntity).count()).toBe(0);
		expect(emitted).not.toHaveBeenCalled();
		run.mockImplementation((domain: Domain) =>
			Promise.resolve(
				domainResult(domain, domain === Domain.LIGHTING ? Status.SUCCEEDED : Status.UNSUPPORTED, 'missing_adapter'),
			),
		);
		const result = await service.activateMode(room.id, ActivityMode.WORK, 1, 'user:trusted');
		expect(result).toMatchObject({
			selectedActivityMode: ActivityMode.WORK,
			activityStatus: State.PARTIAL,
			activityActor: 'user:trusted',
		});
		expect(result.activityResults).toHaveLength(5);
		const restarted = new SpaceModeService(database, configs, { run } as never, events);
		await restarted.onApplicationBootstrap();
		expect(await restarted.getActiveMode(room.id)).toMatchObject({
			activationId: result.activationId,
			activityStatus: State.PARTIAL,
		});
		expect(emitted).toHaveBeenCalledWith(
			ACTIVITY_STATE_CHANGED,
			expect.objectContaining({ space_id: room.id, activation_id: result.activationId, configuration_revision: 1 }),
		);
	});
	it('rejects disabled modes and stale revision without starting domain I/O', async () => {
		const { configs, room } = harness;
		await configs.update(room.id, ActivityMode.WORK, {
			expected_revision: 1,
			enabled: false,
			display_order: 0,
			configuration: defaultActivityConfiguration(ActivityMode.WORK),
		});
		await expect(service.activateMode(room.id, ActivityMode.WORK, 2, 'actor')).rejects.toThrow('disabled');
		await expect(service.activateMode(room.id, ActivityMode.RELAX, 8, 'actor')).rejects.toThrow('revision');
		expect(run).not.toHaveBeenCalled();
	});
	it('rejects overlapping requests with no queue; deactivation fences old completion', async () => {
		const { room } = harness;
		const started = deferred<void>(),
			finish = deferred<void>();
		let identity!: SpaceActivationIdentity;
		run.mockImplementation(async (domain: Domain, _config: unknown, current: SpaceActivationIdentity) => {
			identity = current;
			if (domain === Domain.LIGHTING) {
				started.resolve();
				await finish.promise;
			}
			return domainResult(domain, Status.SUCCEEDED, 'executed');
		});
		const activation = service.activateMode(room.id, ActivityMode.WORK, 1, 'actor');
		await started.promise;
		await expect(service.activateMode(room.id, ActivityMode.RELAX, 1, 'actor')).rejects.toThrow('in progress');
		const active = await service.getActiveMode(room.id);
		const cleared = await service.deactivateMode(room.id, active.activationId, 'display:trusted');
		expect(await identity.isCurrent()).toBe(false);
		finish.resolve();
		await activation;
		expect(await service.getActiveMode(room.id)).toMatchObject({
			selectedActivityMode: null,
			activationId: cleared.activationId,
			activityStatus: State.DEACTIVATED,
			activityResults: [],
		});
		await expect(service.deactivateMode(room.id, active.activationId, 'actor')).rejects.toThrow('identity');
		expect(await service.activateMode(room.id, ActivityMode.RELAX, 1, 'actor')).toMatchObject({
			selectedActivityMode: ActivityMode.RELAX,
		});
	});
	it('configuration revision invalidates in-flight completion while preserving selection', async () => {
		const { configs, room } = harness;
		const started = deferred<void>(),
			finish = deferred<void>();
		run.mockImplementation(async (domain: Domain) => {
			if (domain === Domain.LIGHTING) {
				started.resolve();
				await finish.promise;
			}
			return domainResult(domain, Status.SUCCEEDED, 'executed');
		});
		const activation = service.activateMode(room.id, ActivityMode.WORK, 1, 'actor');
		await started.promise;
		await configs.reset(room.id, ActivityMode.WORK, 1);
		finish.resolve();
		await activation;
		expect(await service.getActiveMode(room.id)).toMatchObject({
			selectedActivityMode: ActivityMode.WORK,
			selectedActivityRevision: 1,
			activityStatus: State.INTERRUPTED,
		});
	});
	it('space removal cannot be undone by a delayed completion', async () => {
		const { database, room } = harness;
		const started = deferred<void>(),
			finish = deferred<void>();
		run.mockImplementation(async (domain: Domain) => {
			if (domain === Domain.LIGHTING) {
				started.resolve();
				await finish.promise;
			}
			return domainResult(domain, Status.SUCCEEDED, 'done');
		});
		const activation = service.activateMode(room.id, ActivityMode.WORK, 1, 'actor');
		await started.promise;
		await database.getRepository(SpaceEntity).delete(room.id);
		finish.resolve();
		expect(await activation).toBeNull();
		expect(await database.getRepository(SpaceActivityStateEntity).count()).toBe(0);
	});
	it('marks unfinished persisted activation interrupted on restart without dispatch', async () => {
		const { database, room } = harness;
		await database.getRepository(SpaceActivityStateEntity).save({
			spaceId: room.id,
			activationId: 'crashed',
			selectedActivityMode: ActivityMode.WORK,
			selectedActivityRevision: 1,
			activityStatus: State.ACTIVATING,
			activityResults: [],
		});
		await service.onApplicationBootstrap();
		expect(await service.getActiveMode(room.id)).toMatchObject({
			selectedActivityMode: ActivityMode.WORK,
			activityStatus: State.INTERRUPTED,
		});
		expect(run).not.toHaveBeenCalled();
	});
});
