import { DataSource, Repository } from 'typeorm';

import { EventEmitter2 } from '@nestjs/event-emitter';

import { AutomationRunRecordStatus, EventType } from '../automations.constants';
import { AutomationRunEntity } from '../entities/automation-runs.entity';
import { AutomationEntity } from '../entities/automations.entity';

import { AutomationsModuleResetService } from './module-reset.service';

describe('AutomationsModuleResetService', () => {
	let dataSource: DataSource;
	let repository: Repository<AutomationEntity>;
	let runsRepository: Repository<AutomationRunEntity>;
	let eventEmitter: { emit: jest.Mock };
	let service: AutomationsModuleResetService;

	beforeEach(async () => {
		dataSource = new DataSource({
			type: 'sqlite',
			database: ':memory:',
			entities: [AutomationEntity, AutomationRunEntity],
			synchronize: true,
		});
		await dataSource.initialize();

		repository = dataSource.getRepository(AutomationEntity);
		eventEmitter = { emit: jest.fn() };
		runsRepository = dataSource.getRepository(AutomationRunEntity);
		service = new AutomationsModuleResetService(repository, runsRepository, eventEmitter as unknown as EventEmitter2);
	});

	afterEach(async () => {
		if (dataSource.isInitialized) {
			await dataSource.destroy();
		}
	});

	it('deletes every automation and announces the reset', async () => {
		await repository.insert([{ name: 'First' }, { name: 'Second' }]);

		await expect(service.reset()).resolves.toEqual({ success: true });

		expect(await repository.count()).toBe(0);
		expect(eventEmitter.emit).toHaveBeenCalledWith(EventType.MODULE_RESET, { automationsDeleted: 2 });
	});

	it('deletes the run history with the automations', async () => {
		const automation = await repository.save(repository.create({ name: 'First' }));

		await runsRepository.insert({
			automationId: automation.id,
			revision: 1,
			status: AutomationRunRecordStatus.COMPLETED,
			triggerNodeId: 't',
			startedAt: new Date(),
			finishedAt: new Date(),
			durationMs: 3,
			endReason: null,
			trace: { trigger: { node_id: 't', manual: true, data: {} }, steps: [], truncated: false },
		});

		await expect(service.reset()).resolves.toEqual({ success: true });

		expect(await runsRepository.count()).toBe(0);
		expect(await repository.count()).toBe(0);
	});

	it('reports a failure instead of throwing', async () => {
		await dataSource.destroy();

		const result = await service.reset();

		expect(result.success).toBe(false);
		expect(result.reason).toEqual(expect.any(String));
		expect(eventEmitter.emit).not.toHaveBeenCalled();
	});
});
