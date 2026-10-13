import { randomUUID } from 'crypto';

import { SqliteDataSource, createSqliteDataSource } from '../../../common/database/sqlite-data-source';
import { AddShellySampleSources1000000000028 } from '../../../migrations/1000000000028-AddShellySampleSources';
import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { DeviceZoneEntity } from '../../../modules/devices/entities/device-zone.entity';
import {
	ChannelControlEntity,
	ChannelEntity,
	ChannelPropertyEntity,
	DeviceControlEntity,
	DeviceEntity,
} from '../../../modules/devices/entities/devices.entity';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { SpaceEntity } from '../../../modules/spaces/entities/space.entity';
import { nativeTemperatureIdentity } from '../contracts/native-temperature.contract';
import {
	ShellyNgChannelEntity,
	ShellyNgChannelPropertyEntity,
	ShellyNgDeviceEntity,
} from '../entities/devices-shelly-ng.entity';
import { ShellyNgDeviceAddressEntity } from '../entities/shelly-ng-device-address.entity';
import { ShellySampleSourceEntity } from '../entities/shelly-sample-source.entity';

import { ShellySampleSourcesService } from './shelly-sample-sources.service';

const config = {
	id: 100,
	type: 'analog',
	enable: true,
	invert: false,
	xpercent: { expr: 'x/2', unit: 'Celsius' },
	password: 'must-not-store',
	authentication: { token: 'must-not-store' },
};
const peripheral = { analog_in: { 'input:100': { io: 0, privateData: 'must-not-store' } } };

describe('durable Shelly sensor metadata and process-local generation leases', () => {
	let database: SqliteDataSource;
	let sources: ShellySampleSourcesService;
	let deviceId: string;
	let propertyId: string;
	let channelId: string;
	let reportSample: jest.Mock;
	beforeEach(async () => {
		database = await createSqliteDataSource({
			type: 'sqlite',
			database: ':memory:',
			synchronize: true,
			entities: [
				DeviceEntity,
				ChannelEntity,
				ChannelPropertyEntity,
				DeviceControlEntity,
				ChannelControlEntity,
				DeviceZoneEntity,
				SpaceEntity,
				ShellyNgDeviceEntity,
				ShellyNgChannelEntity,
				ShellyNgChannelPropertyEntity,
				ShellyNgDeviceAddressEntity,
				ShellySampleSourceEntity,
			],
		});
		deviceId = randomUUID();
		channelId = randomUUID();
		propertyId = randomUUID();
		await database
			.getRepository(ShellyNgDeviceEntity)
			.save({ id: deviceId, name: 'Fixture', category: DeviceCategory.GENERIC });
		await database
			.getRepository(ShellyNgChannelEntity)
			.save({ id: channelId, name: 'Temperature', category: ChannelCategory.TEMPERATURE, device: { id: deviceId } });
		await database
			.getRepository(ShellyNgChannelPropertyEntity)
			.save({
				id: propertyId,
				channel: { id: channelId },
				category: PropertyCategory.TEMPERATURE,
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
			});
		reportSample = jest.fn().mockResolvedValue({});
		sources = new ShellySampleSourcesService(database.getRepository(ShellySampleSourceEntity), {
			reportSample,
		} as unknown as ChannelsPropertiesService);
	});
	afterEach(async () => {
		jest.restoreAllMocks();
		if (database?.isInitialized) await database.destroy();
	});

	it('persists literal unit/expression and only whitelisted sensor identity; reads do not write heartbeat timestamps', async () => {
		const snapshot = nativeTemperatureIdentity('input:100', config, peripheral);
		await sources.bind(propertyId, deviceId, snapshot);
		const row = await database.getRepository(ShellySampleSourceEntity).findOneByOrFail({ propertyId });
		expect(row).toMatchObject({
			unit: 'Celsius',
			expression: 'x/2',
			componentKey: 'input:100',
			fingerprint: snapshot.fingerprint,
			peripheral: { kind: 'analog_in', io: 0, address: null },
		});
		expect(JSON.stringify(row)).not.toContain('must-not-store');
		const initialTime = row.identifiedAt.getTime();
		for (let i = 0; i < 3; i++) {
			await sources.get(propertyId);
			await sources.bind(propertyId, deviceId, snapshot);
		}
		expect(
			(await database.getRepository(ShellySampleSourceEntity).findOneByOrFail({ propertyId })).identifiedAt.getTime(),
		).toBe(initialTime);
		expect(reportSample).not.toHaveBeenCalled();
	});

	it('a new or restarted source refuses packets observed before identity/connection activation', async () => {
		await sources.bind(propertyId, deviceId, nativeTemperatureIdentity('input:100', config, peripheral));
		const lease = await sources.get(propertyId);
		expect(sources.isCurrent(lease, new Date(lease.activatedAt.getTime() - 1))).toBe(false);
		expect(sources.isCurrent(lease, lease.activatedAt)).toBe(false);
		expect(sources.isCurrent(lease, new Date(lease.activatedAt.getTime() + 1))).toBe(true);
		sources.revoke(propertyId);
		expect(sources.isCurrent(lease, new Date(Date.now() + 1))).toBe(false);
		const restarted = new ShellySampleSourcesService(database.getRepository(ShellySampleSourceEntity), {
			reportSample,
		} as unknown as ChannelsPropertiesService);
		const nextLease = await restarted.get(propertyId);
		expect(restarted.isCurrent(nextLease, new Date(nextLease.activatedAt.getTime() - 1))).toBe(false);
		expect((await restarted.getReadiness({ id: propertyId } as ChannelPropertyEntity, 1000)).currentQualification).toBe(
			'awaiting_sample',
		);
	});

	it('identity changes revoke old leases and old scalar eligibility while preserving metadata for history/aliases', async () => {
		await sources.bind(propertyId, deviceId, nativeTemperatureIdentity('input:100', config, peripheral));
		const oldLease = await sources.get(propertyId);
		const replacementId = randomUUID();
		await database
			.getRepository(ShellyNgChannelPropertyEntity)
			.save({
				id: replacementId,
				channel: { id: channelId },
				category: PropertyCategory.VALUE,
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
			});
		await sources.bind(
			replacementId,
			deviceId,
			nativeTemperatureIdentity('input:100', { ...config, xpercent: { expr: 'x/3', unit: '°C' } }, peripheral),
		);
		expect(sources.isCurrent(oldLease, new Date(Date.now() + 1))).toBe(false);
		expect(await sources.get(propertyId)).toBeNull();
		expect((await database.getRepository(ShellySampleSourceEntity).findOneByOrFail({ propertyId })).active).toBe(false);
		expect(reportSample).toHaveBeenCalledWith(
			propertyId,
			expect.objectContaining({ value: null }),
			expect.objectContaining({ provenance: 'live' }),
		);
		expect(
			(await database.getRepository(ShellySampleSourceEntity).findOneByOrFail({ propertyId: replacementId })).active,
		).toBe(true);
	});

	it('migration and synchronized metadata agree on columns and property deletion cascades', async () => {
		const runner = database.createQueryRunner();
		try {
			const synced = await runner.getTable('devices_shelly_ng_sample_sources');
			await runner.dropTable('devices_shelly_ng_sample_sources');
			const migration = new AddShellySampleSources1000000000028();
			await migration.up(runner);
			const migrated = await runner.getTable('devices_shelly_ng_sample_sources');
			expect(
				migrated.columns.map((column) => ({
					name: column.name,
					type: column.type,
					nullable: column.isNullable,
					primary: column.isPrimary,
				})),
			).toEqual(
				synced.columns.map((column) => ({
					name: column.name,
					type: column.type,
					nullable: column.isNullable,
					primary: column.isPrimary,
				})),
			);
			expect(migrated.foreignKeys).toHaveLength(1);
			expect(migrated.foreignKeys[0].onDelete).toBe('CASCADE');
			await sources.bind(propertyId, deviceId, nativeTemperatureIdentity('input:100', config, peripheral));
			await database.getRepository(ShellyNgChannelPropertyEntity).delete(propertyId);
			expect(await database.getRepository(ShellySampleSourceEntity).count()).toBe(0);
			await migration.down(runner);
			expect(await runner.hasTable('devices_shelly_ng_sample_sources')).toBe(false);
		} finally {
			await runner.release();
		}
	});
});
