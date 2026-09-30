import { Module } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';

import { ConfigService } from '../../config/services/config.service';
import { PluginConfigValidatorService } from '../../config/services/plugin-config-validator.service';
import { DataTypeType } from '../../devices/devices.constants';
import { ChannelPropertyEntity } from '../../devices/entities/devices.entity';
import { PropertyValueLockService } from '../../devices/services/property-value-lock.service';
import { PropertyValueSourceRegistryService } from '../../devices/services/property-value-source.registry.service';
import { PropertyValueService } from '../../devices/services/property-value.service';
import { IManagedExtensionService } from '../../extensions/services/managed-extension-service.interface';
import { ManagedServiceManagerService } from '../../extensions/services/managed-service-manager.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { StoragePlugin } from '../interfaces/storage-plugin.interface';
import { StoragePoint } from '../storage.types';

import { StorageService } from './storage.service';

describe('Storage shutdown across Nest lifecycle phases', () => {
	it.each([0, 1024])('persists the final provider report with %i writes already buffered', async (buffered) => {
		const config = {
			getModuleConfig: () => ({ primaryStorage: 'test' }),
		} as unknown as ConfigService;
		const storage = new StorageService(config);
		const values = new PropertyValueService(storage, new PropertyValueSourceRegistryService(), {
			isEnabled: () => false,
			runExclusive: <T>(_id: string, operation: (lease: { assertOwned(): Promise<void> }) => Promise<T>) =>
				operation({ assertOwned: () => Promise.resolve() }),
		} as PropertyValueLockService);
		const manager = new ManagedServiceManagerService(
			config,
			{ get: () => 'on' } as unknown as NestConfigService,
			{} as PluginConfigValidatorService,
			{} as NotificationsService,
		);
		const history: StoragePoint[] = [];
		let release!: () => void;
		const writeGate = new Promise<void>((resolve) => (release = resolve));
		let destroyed = false;
		const backend = {
			name: 'test',
			isAvailable: () => !destroyed,
			writePoints: async (points: StoragePoint[]) => {
				await writeGate;
				expect(destroyed).toBe(false);
				history.push(...points);
			},
		} as unknown as StoragePlugin;
		storage.registerPlugin('test', backend);
		const property = { id: 'shutdown-report', dataType: DataTypeType.BOOL } as ChannelPropertyEntity;
		const timestamp = new Date(1000);
		let providerStopped = false;
		const producer: IManagedExtensionService = {
			owner: { kind: 'plugin', type: 'producer' },
			serviceId: 'device',
			getPriority: () => 100,
			getState: () => (providerStopped ? 'stopped' : 'started'),
			start: () => Promise.resolve(),
			stop: async () => {
				await values.writeLiveWithState(property, false, timestamp);
				providerStopped = true;
			},
		};
		const sink: IManagedExtensionService = {
			owner: { kind: 'plugin', type: 'test' },
			serviceId: 'storage',
			getPriority: () => 10,
			getState: () => (destroyed ? 'stopped' : 'started'),
			start: () => Promise.resolve(),
			stop: async () => {
				await storage.unregisterPlugin('test');
				destroyed = true;
			},
		};
		manager.register(sink);
		manager.register(producer);

		// Nest destroys the root module before this imported module. This reproduces
		// storage receiving onModuleDestroy before the manager stops its producers.
		@Module({ providers: [{ provide: ManagedServiceManagerService, useValue: manager }] })
		class ManagedModule {}

		const app = await Test.createTestingModule({
			imports: [ManagedModule],
			providers: [{ provide: StorageService, useValue: storage }],
		}).compile();
		await app.init();
		for (let index = 0; index < buffered; index++) {
			await storage.enqueueWritePoint({ measurement: 'test', fields: { numberValue: index } });
		}
		let closed = false;
		const shutdown = app.close().then(() => (closed = true));
		try {
			await new Promise<void>((resolve) => setImmediate(resolve));
			expect(closed).toBe(false);
			expect(destroyed).toBe(false);
		} finally {
			release();
			await shutdown;
		}
		expect(providerStopped).toBe(true);
		expect(destroyed).toBe(true);
		expect(history).toHaveLength(buffered + 1);
		expect(history.slice(0, buffered).map((point) => point.fields.numberValue)).toEqual(
			Array.from({ length: buffered }, (_, index) => index),
		);
		expect(history.at(-1)).toMatchObject({
			tags: { propertyId: property.id },
			fields: { stringValue: 'false' },
			timestamp,
		});
	});
});
