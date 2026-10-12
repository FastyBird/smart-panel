import { randomUUID } from 'node:crypto';
import { SqliteQueryRunner } from 'typeorm/driver/sqlite/SqliteQueryRunner';

import { ConfigService } from '@nestjs/config';

import { TokenOwnerType } from '../../modules/auth/auth.constants';
import {
	AccessTokenEntity,
	LongLiveTokenEntity,
	RefreshTokenEntity,
	TokenEntity,
} from '../../modules/auth/entities/auth.entity';
import { TokenMetadataService } from '../../modules/auth/services/token-metadata.service';
import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../modules/devices/devices.constants';
import { DeviceZoneEntity } from '../../modules/devices/entities/device-zone.entity';
import {
	ChannelControlEntity,
	ChannelEntity,
	ChannelPropertyEntity,
	DeviceControlEntity,
	DeviceEntity,
} from '../../modules/devices/entities/devices.entity';
import { PropertyMetadataService } from '../../modules/devices/services/property-metadata.service';
import { SpaceEntity } from '../../modules/spaces/entities/space.entity';
import { UserEntity } from '../../modules/users/entities/users.entity';
import {
	SimulatorChannelEntity,
	SimulatorChannelPropertyEntity,
	SimulatorDeviceEntity,
} from '../../plugins/simulator/entities/simulator.entity';

import { SqliteDataSource, createSqliteDataSource } from './sqlite-data-source';

describe('SQLite coordinator with production token/property metadata subscribers', () => {
	let database: SqliteDataSource;
	let tokens: TokenMetadataService;
	let properties: PropertyMetadataService;
	let propertyId: string;
	let tokenId: string;
	const tokenHash = 'credential-facts';

	beforeEach(async () => {
		database = await createSqliteDataSource({
			type: 'sqlite',
			database: ':memory:',
			synchronize: true,
			entities: [
				UserEntity,
				TokenEntity,
				AccessTokenEntity,
				RefreshTokenEntity,
				LongLiveTokenEntity,
				DeviceEntity,
				ChannelEntity,
				ChannelPropertyEntity,
				DeviceControlEntity,
				ChannelControlEntity,
				DeviceZoneEntity,
				SpaceEntity,
				SimulatorDeviceEntity,
				SimulatorChannelEntity,
				SimulatorChannelPropertyEntity,
			],
		});
		const config = new ConfigService({ FB_PROPERTY_VALUE_LOCKS_ENABLED: false });
		tokens = new TokenMetadataService(database, config);
		properties = new PropertyMetadataService(database, config);
		const deviceId = randomUUID();
		const channelId = randomUUID();
		propertyId = randomUUID();
		tokenId = randomUUID();
		await database.getRepository(SimulatorDeviceEntity).save({
			id: deviceId,
			name: 'Device',
			category: DeviceCategory.GENERIC,
		});
		await database.getRepository(SimulatorChannelEntity).save({
			id: channelId,
			name: 'Channel',
			category: ChannelCategory.GENERIC,
			device: { id: deviceId },
		});
		await database.getRepository(SimulatorChannelPropertyEntity).save({
			id: propertyId,
			name: 'Original',
			channel: { id: channelId },
			category: PropertyCategory.ON,
			dataType: DataTypeType.BOOL,
			permissions: [PermissionType.READ_WRITE],
		});
		await database.getRepository(LongLiveTokenEntity).save({
			id: tokenId,
			hashedToken: tokenHash,
			ownerType: TokenOwnerType.DISPLAY,
			revoked: true,
		});
		await properties.onModuleInit();
	});

	afterEach(async () => {
		jest.restoreAllMocks();
		properties?.onModuleDestroy();
		tokens?.onModuleDestroy();
		if (database?.isInitialized) await database.destroy();
	});

	it.each([false, true])('invalidates transaction-time cache reads after rollback (nested: %s)', async (nested) => {
		expect((await properties.findOne(propertyId)).name).toBe('Original');
		expect((await tokens.findByHash(tokenHash)).revoked).toBe(true);
		await expect(
			database.transaction(async (manager) => {
				await manager.update(SimulatorChannelPropertyEntity, propertyId, { name: 'Uncommitted' });
				await manager.update(LongLiveTokenEntity, tokenId, { revoked: false });
				if (nested) {
					await manager.transaction(async () => {
						expect((await properties.findOne(propertyId)).name).toBe('Uncommitted');
						expect((await tokens.findByHash(tokenHash)).revoked).toBe(false);
					});
				}
				expect((await properties.findOne(propertyId)).name).toBe('Uncommitted');
				expect((await tokens.findByHash(tokenHash)).revoked).toBe(false);
				throw new Error('rollback');
			}),
		).rejects.toThrow('rollback');
		expect((await properties.findOne(propertyId)).name).toBe('Original');
		expect((await tokens.findByHash(tokenHash)).revoked).toBe(true);
	});

	it('invalidates both catalogs after fallback rollback cleanup', async () => {
		// eslint-disable-next-line @typescript-eslint/unbound-method
		const original = SqliteQueryRunner.prototype.query;
		let fail = true;
		jest.spyOn(SqliteQueryRunner.prototype, 'query').mockImplementation(function (...args) {
			if (fail && args[0] === 'ROLLBACK') {
				fail = false;
				return Promise.reject(new Error('injected rollback failure'));
			}
			return original.apply(this, args) as Promise<unknown>;
		});
		await expect(
			database.transaction(async (manager) => {
				await manager.update(SimulatorChannelPropertyEntity, propertyId, { name: 'Uncommitted' });
				await manager.update(LongLiveTokenEntity, tokenId, { revoked: false });
				expect((await properties.findOne(propertyId)).name).toBe('Uncommitted');
				expect((await tokens.findByHash(tokenHash)).revoked).toBe(false);
				throw new Error('rollback');
			}),
		).rejects.toThrow('rollback');
		expect((await properties.findOne(propertyId)).name).toBe('Original');
		expect((await tokens.findByHash(tokenHash)).revoked).toBe(true);
	});
});
