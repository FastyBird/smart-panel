import { createHash, randomUUID } from 'node:crypto';

import { ClimateAutomationSourceFacts } from '../../../modules/devices/contracts/climate-automation.contract';
import {
	ClimateAutomationSlotEntity,
	ClimateAutomationSourceEntity,
} from '../../../modules/devices/entities/climate-automation.entity';
import { ClimateAutomationLedgerService } from '../../../modules/devices/services/climate-automation-ledger.service';
import { canonical } from '../../../modules/devices/services/climate-automation-ledger.utils';
import { ClimateAutomationRegistryService } from '../../../modules/devices/services/climate-automation.registry.service';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { SpaceLifecycleRegistryService } from '../../../modules/spaces/services/space-lifecycle-registry.service';
import {
	ACTIVITY_STATE_CHANGED,
	ActivityActivationStatus,
	ActivityDomain,
	ActivityDomainStatus,
	ActivityMode,
} from '../activity/space-activity.constants';
import { SpaceActivityConfigEntity } from '../entities/space-activity-config.entity';
import { SpaceActivityStateEntity } from '../entities/space-activity-state.entity';

import { activityTestDatabase } from './activity-test-support';
import { SpaceActivityConfigService } from './space-activity-config.service';
import { SPACE_ACTIVITY_CLIMATE_PRODUCER, SpaceClimateAutomationService } from './space-climate-automation.service';
import { SpaceModeService } from './space-mode.service';

/** Real coordinated SQLite and source/slot CAS; no fake native receipts or transport assertions. */
describe('activity climate producer and atomic lifecycle', () => {
	let harness: Awaited<ReturnType<typeof activityTestDatabase>>;
	let registry: ClimateAutomationRegistryService;
	let ledger: ClimateAutomationLedgerService;
	let service: SpaceClimateAutomationService;
	let configs: SpaceActivityConfigService;
	let state: SpaceActivityStateEntity;
	let source: ClimateAutomationSourceFacts;
	let controllerId: string;
	beforeEach(async () => {
		harness = await activityTestDatabase();
		const { database, room, events } = harness;
		registry = new ClimateAutomationRegistryService();
		const structure = new DeviceStructureLockService();
		ledger = new ClimateAutomationLedgerService(database, structure, registry);
		const lifecycle = new SpaceLifecycleRegistryService(structure, ledger);
		service = new SpaceClimateAutomationService(database, registry, ledger, structure, lifecycle);
		service.onModuleInit();
		configs = new SpaceActivityConfigService(database, lifecycle, events, service);
		const config = await harness.configs.get(room.id, ActivityMode.WORK);
		config.activityConfiguration.climate = { enabled: true, thermostat_preset: 'eco' };
		await database.getRepository(SpaceActivityConfigEntity).save(config);
		state = await database.getRepository(SpaceActivityStateEntity).save({
			spaceId: room.id,
			activationId: randomUUID(),
			selectedActivityMode: ActivityMode.WORK,
			selectedActivityRevision: 1,
			activityStatus: ActivityActivationStatus.ACTIVATING,
			activityActor: 'authenticated-user',
			activityResults: [],
		});
		const evidence = canonical(await service.readEvidence(database.manager, room.id, state.activationId, false));
		// Native lifecycle fixture, deliberately not a provider-install/runtime proof.
		source = {
			generationId: randomUUID(),
			ownerId: randomUUID(),
			producerKey: SPACE_ACTIVITY_CLIMATE_PRODUCER,
			subjectId: room.id,
			generationIndex: 1,
			revision: 1,
			isCurrent: true,
			state: 'FINALIZED_LIVE',
			evidence,
			evidenceDigest: createHash('sha256').update(evidence).digest('hex'),
		};
		await database.manager.insert(ClimateAutomationSourceEntity, source);
		controllerId = randomUUID();
		await database.manager.insert(ClimateAutomationSlotEntity, {
			controllerId,
			providerKey: 'virtual-thermostat:v1',
			controllerIncarnation: randomUUID(),
			slotRevision: 1,
			manualGeneration: randomUUID(),
			manualCounter: 1,
			manualHold: false,
			state: 'LIVE',
			ownerId: source.ownerId,
			baselineId: randomUUID(),
			generationId: source.generationId,
			candidateId: randomUUID(),
			bundleId: randomUUID(),
			selection: '{"preset":"eco","setpoints":null}',
			installEvidence: '{}',
			legacyDigest: null,
		});
	});
	afterEach(async () => {
		configs.onModuleDestroy();
		service.onModuleDestroy();
		registry.onModuleDestroy();
		harness.configs.onModuleDestroy();
		await harness.database.destroy();
	});
	it.each([
		[ActivityActivationStatus.ACTIVATING, ActivityDomainStatus.SUCCEEDED, true, true],
		[ActivityActivationStatus.ACTIVE, ActivityDomainStatus.SUCCEEDED, false, true],
		[ActivityActivationStatus.PARTIAL, ActivityDomainStatus.SUCCEEDED, false, true],
		[ActivityActivationStatus.PARTIAL, ActivityDomainStatus.FAILED, false, false],
		[ActivityActivationStatus.INTERRUPTED, ActivityDomainStatus.SUCCEEDED, false, false],
		[ActivityActivationStatus.DEACTIVATED, ActivityDomainStatus.SUCCEEDED, false, false],
	])(
		'separates admission and installed currentness for %s / %s',
		async (status, climateStatus, admission, installed) => {
			const { database, room } = harness;
			await database.manager.update(
				SpaceActivityStateEntity,
				{ id: state.id },
				{
					activityStatus: status,
					activityResults: [{ domain: ActivityDomain.CLIMATE, status: climateStatus, reason: 'actual-domain-result' }],
				},
			);
			expect((await service.readEvidence(database.manager, room.id, state.activationId, false)) !== null).toBe(
				admission,
			);
			const producer = registry.captureProducer(SPACE_ACTIVITY_CLIMATE_PRODUCER);
			expect((await producer.implementation.validateInManager(database.manager, source, 'prepare')) !== null).toBe(
				installed,
			);
		},
	);
	it('keeps exact authoring bytes and refuses changed configuration even with the same actor and revision', async () => {
		const { database, room } = harness;
		const producer = registry.captureProducer(SPACE_ACTIVITY_CLIMATE_PRODUCER);
		expect(await producer.implementation.validateInManager(database.manager, source, 'prepare')).not.toBeNull();
		await database.query<unknown[]>(
			`UPDATE spaces_module_space_roles SET activityConfiguration = activityConfiguration || ' ' WHERE spaceId=? AND type='activity_config' AND activityMode=?`,
			[room.id, ActivityMode.WORK],
		);
		expect(await producer.implementation.validateInManager(database.manager, source, 'prepare')).toBeNull();
	});
	it('deactivates and retires the exact native source and slot before emitting the original event once', async () => {
		const { database, room, events } = harness;
		const current = registry.captureProducer(SPACE_ACTIVITY_CLIMATE_PRODUCER).implementation.captureCurrent(source);
		const emitted: string[] = [];
		events.on(ACTIVITY_STATE_CHANGED, () => {
			emitted.push('state');
		});
		const modes = new SpaceModeService(database, configs, {} as never, events, undefined, service);
		const result = await modes.deactivateMode(room.id, state.activationId, 'operator');
		expect(result.activityStatus).toBe(ActivityActivationStatus.DEACTIVATED);
		expect(current()).toBe(false);
		expect(
			await database.manager.findOneBy(ClimateAutomationSourceEntity, { generationId: source.generationId }),
		).toMatchObject({ state: 'REVOKED' });
		expect(await database.manager.findOneBy(ClimateAutomationSlotEntity, { controllerId })).toMatchObject({
			state: 'RETIRED',
			manualHold: false,
			manualCounter: 1,
		});
		expect(emitted).toEqual(['state']);
	});
	it('rolls back source, slot and activity state together if retirement fails; no after-commit event', async () => {
		const { database, room, events } = harness;
		const rows = async () =>
			Promise.all([
				database.query<unknown[]>('SELECT * FROM devices_module_climate_automation_sources'),
				database.query<unknown[]>('SELECT * FROM devices_module_climate_automation_slots'),
				database.query<unknown[]>('SELECT * FROM spaces_module_space_roles ORDER BY id'),
			]);
		const before = await rows();
		const retire = service.retireInManager.bind(service) as SpaceClimateAutomationService['retireInManager'];
		jest.spyOn(service, 'retireInManager').mockImplementation(async (...args) => {
			await retire(...args);
			throw new Error('retirement failure');
		});
		const emit = jest.spyOn(events, 'emit');
		const modes = new SpaceModeService(database, configs, {} as never, events, undefined, service);
		await expect(modes.deactivateMode(room.id, state.activationId, 'operator')).rejects.toThrow('retirement failure');
		expect(await rows()).toEqual(before);
		expect(emit).not.toHaveBeenCalled();
	});
	it('leaves another activity configuration and its installed-current token untouched', async () => {
		const { database, room } = harness;
		const current = registry.captureProducer(SPACE_ACTIVITY_CLIMATE_PRODUCER).implementation.captureCurrent(source);
		await configs.reset(room.id, ActivityMode.RELAX, 1);
		expect(current()).toBe(true);
		expect(
			await database.manager.findOneBy(ClimateAutomationSourceEntity, { generationId: source.generationId }),
		).toMatchObject({ state: 'FINALIZED_LIVE', revision: 1 });
		await configs.reset(room.id, ActivityMode.WORK, 1);
		expect(current()).toBe(false);
		expect(
			await database.manager.findOneBy(ClimateAutomationSourceEntity, { generationId: source.generationId }),
		).toMatchObject({ state: 'REVOKED' });
	});
});
