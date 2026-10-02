import { DataSource } from 'typeorm';

import { ConfigService } from '@nestjs/config';

import { AddressType } from '../../../plugins/devices-shelly-ng/devices-shelly-ng.constants';
import {
	ShellyNgChannelEntity,
	ShellyNgChannelPropertyEntity,
	ShellyNgDeviceEntity,
} from '../../../plugins/devices-shelly-ng/entities/devices-shelly-ng.entity';
import { ShellyNgDeviceAddressEntity } from '../../../plugins/devices-shelly-ng/entities/shelly-ng-device-address.entity';
import { RoomSpaceEntity } from '../../../plugins/spaces-home-control/entities/room-space.entity';
import { ZoneSpaceEntity } from '../../../plugins/spaces-home-control/entities/zone-space.entity';
import { SpaceEntity } from '../../spaces/entities/space.entity';
import { ChannelCategory, ConnectionState, DataTypeType, PermissionType, PropertyCategory } from '../devices.constants';
import { DeviceZoneEntity } from '../entities/device-zone.entity';
import {
	ChannelControlEntity,
	ChannelEntity,
	ChannelPropertyEntity,
	DeviceControlEntity,
	DeviceEntity,
} from '../entities/devices.entity';
import { PropertyValueState } from '../models/property-value-state.model';

import { DeviceCommandGraphService } from './device-command-graph.service';
import { DeviceConnectionStateService } from './device-connection-state.service';
import { PropertyMetadataService } from './property-metadata.service';
import { PropertyValueService } from './property-value.service';

describe('Command device graphs with SQLite structural invalidation', () => {
	let database: DataSource;
	let metadata: PropertyMetadataService;
	let graphs: DeviceCommandGraphService;
	let device: ShellyNgDeviceEntity;
	let channel: ShellyNgChannelEntity;
	let property: ShellyNgChannelPropertyEntity;
	let address: ShellyNgDeviceAddressEntity;
	let live: PropertyValueState;
	let online: boolean;
	const values = { readLatest: jest.fn() };
	const connectivity = { readLatest: jest.fn() };

	beforeEach(async () => {
		database = await new DataSource({
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
				RoomSpaceEntity,
				ZoneSpaceEntity,
				ShellyNgDeviceEntity,
				ShellyNgChannelEntity,
				ShellyNgChannelPropertyEntity,
				ShellyNgDeviceAddressEntity,
			],
		}).initialize();
		device = await database.getRepository(ShellyNgDeviceEntity).save({ name: 'Shelly' });
		channel = await database
			.getRepository(ShellyNgChannelEntity)
			.save({ device, name: 'Temperature', category: ChannelCategory.TEMPERATURE });
		property = await database.getRepository(ShellyNgChannelPropertyEntity).save({
			channel,
			category: PropertyCategory.TEMPERATURE,
			dataType: DataTypeType.FLOAT,
			permissions: [PermissionType.READ_WRITE],
		});
		await database.getRepository(ShellyNgChannelPropertyEntity).save({
			channel,
			category: PropertyCategory.HUMIDITY,
			dataType: DataTypeType.FLOAT,
			permissions: [PermissionType.READ_ONLY],
		});
		address = await database
			.getRepository(ShellyNgDeviceAddressEntity)
			.save({ deviceId: device.id, interfaceType: AddressType.ETHERNET, address: '192.168.2.10' });
		live = new PropertyValueState(21, '2026-10-02T00:00:00Z', 'stable');
		online = true;
		values.readLatest.mockImplementation(() => Promise.resolve(live));
		connectivity.readLatest.mockImplementation(() =>
			Promise.resolve({
				online,
				status: online ? ConnectionState.CONNECTED : ConnectionState.DISCONNECTED,
				lastChanged: new Date(1000),
			}),
		);
		metadata = new PropertyMetadataService(database, new ConfigService({ FB_PROPERTY_VALUE_LOCKS_ENABLED: false }));
		graphs = new DeviceCommandGraphService(
			metadata,
			values as unknown as PropertyValueService,
			connectivity as unknown as DeviceConnectionStateService,
		);
	});

	afterEach(async () => {
		jest.restoreAllMocks();
		metadata?.onModuleDestroy();
		if (database?.isInitialized) await database.destroy();
	});

	const read = async () => (await graphs.findOne(device.id)) as ShellyNgDeviceEntity;

	it('shares warm structural reads while refreshing live state and isolating provider mutations', async () => {
		await metadata.onModuleInit();
		const first = await read();
		expect(first).toBeInstanceOf(ShellyNgDeviceEntity);
		expect(first.addresses[0]).toBeInstanceOf(ShellyNgDeviceAddressEntity);
		expect(first.channels[0].properties[0]).toBeInstanceOf(ShellyNgChannelPropertyEntity);
		const query = jest.spyOn(database.createQueryRunner(), 'query');
		const repository = jest.spyOn(database, 'getRepository');
		first.name = 'Driver mutation';
		first.addresses[0].address = 'Wrong address';
		expect(first.createdAt).toBeInstanceOf(Date);
		(first.createdAt as Date).setFullYear(1990);
		first.channels[0].properties[0].permissions.length = 0;
		first.channels[0].properties[0].value.value = 100;
		first.status.lastChanged.setFullYear(1990);
		expect(live.value).toBe(21);
		live = new PropertyValueState(24);
		online = false;
		const target = await graphs.findPropertyTarget(property.id);
		const next = target.device as ShellyNgDeviceEntity;
		expect(next.name).toBe('Shelly');
		expect(next.addresses[0].address).toBe('192.168.2.10');
		expect((next.createdAt as Date).getFullYear()).not.toBe(1990);
		expect(next.status).toMatchObject({ online: false, lastChanged: new Date(1000) });
		expect(next.channels[0].device).toMatchObject({ status: { online: false } });
		expect(next.channels[0].properties.every((item) => item.value.value === 24 && item.permissions.length > 0)).toBe(
			true,
		);
		expect(target.property).toMatchObject({ unit: '°C', value: { value: 24 } });
		expect(query).not.toHaveBeenCalled();
		expect(repository).not.toHaveBeenCalled();
	});

	it('invalidates plugin eager addresses on update, delete and insert', async () => {
		await read();
		const addresses = database.getRepository(ShellyNgDeviceAddressEntity);
		await addresses.update(address.id, { address: '192.168.2.22' });
		expect((await read()).addresses[0].address).toBe('192.168.2.22');
		await addresses.delete(address.id);
		expect((await read()).addresses).toEqual([]);
		await addresses.save({ deviceId: device.id, interfaceType: AddressType.WIFI, address: '192.168.2.23' });
		expect((await read()).addresses[0].address).toBe('192.168.2.23');
	});

	it('refreshes device/channel controls and cascading channel deletion', async () => {
		await read();
		const controls = database.getRepository(DeviceControlEntity);
		const control = await controls.save({ device, name: 'Before' });
		expect((await read()).controls[0].name).toBe('Before');
		await controls.update(control.id, { name: 'After' });
		expect((await read()).controls[0].name).toBe('After');
		await controls.delete(control.id);
		expect((await read()).controls).toEqual([]);
		const channelControls = database.getRepository(ChannelControlEntity);
		const channelControl = await channelControls.save({ channel, name: 'Channel control' });
		expect((await read()).channels[0].controls).toHaveLength(1);
		await channelControls.update(channelControl.id, { name: 'Renamed' });
		expect((await read()).channels[0].controls[0].name).toBe('Renamed');
		await channelControls.delete(channelControl.id);
		expect((await read()).channels[0].controls).toEqual([]);
		await database.getRepository(ChannelEntity).delete(channel.id);
		expect((await read()).channels).toEqual([]);
		expect(await graphs.findPropertyTarget(property.id)).toBeNull();
	});

	it('refreshes room and zone assignments including database-side space deletion cascades', async () => {
		await read();
		const room = await database.getRepository(RoomSpaceEntity).save({ name: 'Room' });
		const zone = await database.getRepository(ZoneSpaceEntity).save({ name: 'Zone' });
		await database.getRepository(DeviceEntity).update(device.id, { roomId: room.id });
		await database.getRepository(DeviceZoneEntity).save({ deviceId: device.id, zoneId: zone.id });
		expect(await read()).toMatchObject({ roomId: room.id, zoneIds: [zone.id] });
		await database.getRepository(DeviceZoneEntity).delete({ deviceId: device.id, zoneId: zone.id });
		expect((await read()).zoneIds).toEqual([]);
		await database.getRepository(DeviceZoneEntity).save({ deviceId: device.id, zoneId: zone.id });
		await read();
		await database.getRepository(SpaceEntity).delete(zone.id);
		expect((await read()).zoneIds).toEqual([]);
		await database.getRepository(SpaceEntity).delete(room.id);
		expect((await read()).roomId).toBeNull();
	});

	it('refreshes property permissions and removes deleted devices from both projections', async () => {
		await graphs.findPropertyTarget(property.id);
		await database
			.getRepository(ChannelPropertyEntity)
			.update(property.id, { permissions: [PermissionType.READ_ONLY] });
		expect((await graphs.findPropertyTarget(property.id)).property.permissions).toEqual([PermissionType.READ_ONLY]);
		expect((await read()).channels[0].properties.find((item) => item.id === property.id).permissions).toEqual([
			PermissionType.READ_ONLY,
		]);
		await database.getRepository(DeviceEntity).delete(device.id);
		expect(await read()).toBeNull();
		expect(await graphs.findPropertyTarget(property.id)).toBeNull();
	});

	it.each(['commitTransaction', 'rollbackTransaction'] as const)(
		'discards graph reads after nested %s followed by outer rollback',
		async (settleInner) => {
			await read();
			const runner = database.createQueryRunner();
			await runner.startTransaction();
			try {
				await runner.manager.update(ShellyNgDeviceEntity, device.id, { name: 'Outer' });
				await runner.startTransaction();
				await runner.manager.update(ShellyNgDeviceAddressEntity, address.id, { address: '192.168.2.99' });
				await read();
				await runner[settleInner]();
				expect((await read()).name).toBe('Outer');
				await runner.rollbackTransaction();
				expect(await read()).toMatchObject({ name: 'Shelly', addresses: [{ address: '192.168.2.10' }] });
			} finally {
				while (runner.isTransactionActive) await runner.rollbackTransaction();
				await runner.release();
			}
		},
	);

	it('bypasses both catalogs in shared-writer mode and sees mutations without local subscribers', async () => {
		metadata.onModuleDestroy();
		metadata = new PropertyMetadataService(database, new ConfigService({ FB_PROPERTY_VALUE_LOCKS_ENABLED: true }));
		graphs = new DeviceCommandGraphService(
			metadata,
			values as unknown as PropertyValueService,
			connectivity as unknown as DeviceConnectionStateService,
		);
		await graphs.findPropertyTarget(property.id);
		await database
			.createQueryBuilder()
			.update(ShellyNgDeviceEntity)
			.set({ name: 'External writer' })
			.where('id = :id', { id: device.id })
			.callListeners(false)
			.execute();
		await database
			.createQueryBuilder()
			.update(ShellyNgChannelPropertyEntity)
			.set({ permissions: [PermissionType.READ_ONLY] })
			.where('id = :id', { id: property.id })
			.callListeners(false)
			.execute();
		const target = await graphs.findPropertyTarget(property.id);
		expect(target.device.name).toBe('External writer');
		expect(target.property.permissions).toEqual([PermissionType.READ_ONLY]);
	});

	it('allows explicit bulk-reset invalidation and retries unknown device IDs', async () => {
		await read();
		await database
			.createQueryBuilder()
			.update(ShellyNgDeviceEntity)
			.set({ name: 'Reset' })
			.where('id = :id', { id: device.id })
			.callListeners(false)
			.execute();
		metadata.invalidate();
		expect((await read()).name).toBe('Reset');
		const query = jest.spyOn(database.createQueryRunner(), 'query');
		expect(await graphs.findOne('missing')).toBeNull();
		expect(await graphs.findOne('missing')).toBeNull();
		expect(query).toHaveBeenCalledTimes(2);
	});
});
