import { DataSource } from 'typeorm';

import { ConfigService as NestConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

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
		const database = { manager: { find: jest.fn().mockRejectedValue(missingMigration) } } as unknown as DataSource;
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
		state.onModuleDestroy();
	});
});
