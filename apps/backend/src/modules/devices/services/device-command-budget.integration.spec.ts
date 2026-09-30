import { ChildEntity, DataSource, Entity, EntitySubscriberInterface, PrimaryColumn, TableInheritance } from 'typeorm';

import { DevicesService } from './devices.service';

// Match the production discriminator/getter contract without loading unrelated modules.
@Entity()
@TableInheritance({ column: { type: 'varchar', name: 'type' } })
class BudgetDevice {
	@PrimaryColumn()
	id: string;

	get type(): string {
		return 'device';
	}
}

@ChildEntity('budget-integration')
class IntegrationDevice extends BudgetDevice {
	get type(): string {
		return 'budget-integration';
	}
}

class LoadProbe implements EntitySubscriberInterface {
	afterLoad = jest.fn();
}

describe('Device command budget metadata with SQLite', () => {
	let dataSource: DataSource;
	let service: DevicesService;
	let probe: LoadProbe;

	beforeEach(async () => {
		dataSource = await new DataSource({
			type: 'sqlite',
			database: ':memory:',
			entities: [BudgetDevice, IntegrationDevice],
			synchronize: true,
		}).initialize();
		probe = new LoadProbe();
		dataSource.subscribers.push(probe);
		service = Object.create(DevicesService.prototype) as DevicesService;
		Object.defineProperty(service, 'repository', { value: dataSource.getRepository(BudgetDevice) });
		await dataSource.getRepository(IntegrationDevice).insert({ id: 'target' });
	});

	afterEach(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
	});

	it('reads the stored integration discriminator without hydrating an entity or invoking subscribers', async () => {
		await expect(service.findIdentity('target')).resolves.toEqual({ id: 'target', type: 'budget-integration' });
		expect(probe.afterLoad).not.toHaveBeenCalled();
		// Control: this fixture really does invoke subscribers for a hydrated read.
		await dataSource.getRepository(BudgetDevice).findOneByOrFail({ id: 'target' });
		expect(probe.afterLoad).toHaveBeenCalled();
	});

	it('returns null for missing IDs and binds caller input as a parameter', async () => {
		await expect(service.findIdentity('missing')).resolves.toBeNull();
		await expect(service.findIdentity("target' OR 1=1 --")).resolves.toBeNull();
		expect(probe.afterLoad).not.toHaveBeenCalled();
	});

	it('observes deletion and replacement without retaining a cached identity', async () => {
		await expect(service.findIdentity('target')).resolves.toEqual({ id: 'target', type: 'budget-integration' });
		await dataSource.getRepository(BudgetDevice).delete('target');
		await expect(service.findIdentity('target')).resolves.toBeNull();
		await dataSource.getRepository(BudgetDevice).insert({ id: 'target' });
		await expect(service.findIdentity('target')).resolves.toEqual({ id: 'target', type: 'BudgetDevice' });
		expect(probe.afterLoad).not.toHaveBeenCalled();
	});
});
