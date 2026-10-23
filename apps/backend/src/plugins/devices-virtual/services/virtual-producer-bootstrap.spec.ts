import { DataSource } from 'typeorm';

import { ConfigService as NestConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { SqliteDataSource } from '../../../common/database/sqlite-data-source';
import { PropertyProducerRegistryService } from '../../../modules/devices/services/property-producer.registry.service';

import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { VirtualProducerStateService } from './virtual-producer-state.service';

describe('virtual producer lifecycle startup', () => {
	it('skips runtime database queries for CLI schema generation', async () => {
		const find = jest.fn();
		const transaction = jest.fn();
		const database = { manager: { find }, transaction } as unknown as DataSource;
		const config = new NestConfigService({ FB_CLI: 'on' });
		const graph = new VirtualDependencyGraphService(database, config);
		const state = new VirtualProducerStateService(
			database,
			new PropertyProducerRegistryService(),
			graph,
			new EventEmitter2(),
			config,
		);
		await state.onModuleInit();
		await graph.onApplicationBootstrap();
		expect(find).not.toHaveBeenCalled();
		expect(transaction).not.toHaveBeenCalled();
	});

	it('keeps an actual missing production migration fatal', async () => {
		const missingMigration = new Error('no such table: devices_module_channels_properties');
		const database = new DataSource({ type: 'sqlite', database: ':memory:' });
		const transaction = jest.spyOn(database, 'transaction').mockRejectedValue(missingMigration);
		const config = new NestConfigService({ FB_CLI: 'off' });
		const graph = new VirtualDependencyGraphService(database, config);
		const state = new VirtualProducerStateService(
			database,
			new PropertyProducerRegistryService(),
			graph,
			new EventEmitter2(),
			config,
		);
		await expect(state.onModuleInit()).rejects.toBe(missingMigration);
		expect(transaction).toHaveBeenCalledTimes(1);
		state.onModuleDestroy();
	});

	it('rejects a native missing catalog table without schema creation in an owned empty SQLite database', async () => {
		const database = await new SqliteDataSource({
			type: 'sqlite',
			database: ':memory:',
			synchronize: false,
			migrationsRun: false,
			entities: [__dirname + '/../../../**/*.entity.ts'],
		}).initialize();
		const events = new EventEmitter2(),
			producers = new PropertyProducerRegistryService(events);
		const config = new NestConfigService({ FB_CLI: 'off' });
		const graph = new VirtualDependencyGraphService(database, config);
		const state = new VirtualProducerStateService(database, producers, graph, events, config);
		const tables = () =>
			database.query<{ name: string }[]>("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
		try {
			expect(await tables()).toEqual([]);
			let failure: unknown;
			try {
				await state.onModuleInit();
			} catch (error) {
				failure = error;
			}
			expect(failure).toBeInstanceOf(Error);
			if (!(failure instanceof Error)) throw new Error('Expected actual native missing-table failure');
			expect(failure.message).toMatch(/no such table: .*channels_properties/);
			expect(await tables()).toEqual([]);
			expect(producers.readOwnedOperationCounts()).toEqual({ activeBatches: 0, observedIds: 0 });
		} finally {
			state.onModuleDestroy();
			producers.onModuleDestroy();
			await database.destroy();
		}
	});
});
