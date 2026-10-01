import { instanceToPlain } from 'class-transformer';
import { DataSource } from 'typeorm';

import {
	ChannelCategory,
	ConnectionState,
	DataTypeType,
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
import { IDevicePlatform, IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DeviceConnectionStateService } from '../../../modules/devices/services/device-connection-state.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { PlatformRegistryService } from '../../../modules/devices/services/platform.registry.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { ChannelPropertyEntitySubscriber } from '../../../modules/devices/subscribers/channel-property-entity.subscriber';
import { DeviceEntitySubscriber } from '../../../modules/devices/subscribers/device-entity.subscriber';
import { SpaceEntity } from '../../../modules/spaces/entities/space.entity';
import {
	SimulatorChannelEntity,
	SimulatorChannelPropertyEntity,
	SimulatorDeviceEntity,
} from '../../simulator/entities/simulator.entity';
import {
	VirtualChannelEntity,
	VirtualChannelPropertyEntity,
	VirtualDeviceEntity,
	VirtualValueOrigin,
} from '../entities/devices-virtual.entity';

import { VirtualDevicePlatform } from './virtual-device.platform';

describe('Virtual source forwarding with the real SQLite device graph', () => {
	let database: DataSource;

	afterEach(async () => {
		jest.restoreAllMocks();
		if (database?.isInitialized) await database.destroy();
	});

	it('forwards complete channel metadata and fresh values without a separate channel query', async () => {
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
				SimulatorDeviceEntity,
				SimulatorChannelEntity,
				SimulatorChannelPropertyEntity,
			],
		}).initialize();
		let liveValue = 21;
		new ChannelPropertyEntitySubscriber(
			{ readLatest: () => Promise.resolve({ value: liveValue }) } as unknown as PropertyValueService,
			null as never,
			database,
		);
		new DeviceEntitySubscriber(
			{
				readLatest: () =>
					Promise.resolve({ online: true, status: ConnectionState.CONNECTED, lastChanged: new Date(0) }),
			} as unknown as DeviceConnectionStateService,
			database,
		);
		const devices = new DevicesService(
			database.getRepository(DeviceEntity),
			database.getRepository(SpaceEntity),
			null as never,
			null as never,
			null as never,
			null as never,
			null as never,
			null as never,
			database,
			null as never,
		);
		const properties = new ChannelsPropertiesService(
			database.getRepository(ChannelPropertyEntity),
			null as never,
			null as never,
			null as never,
			null as never,
			null as never,
			null as never,
			database,
			null as never,
		);
		const channels = new ChannelsService(
			database.getRepository(ChannelEntity),
			null as never,
			properties,
			null as never,
			null as never,
			database,
			null as never,
		);
		const device = await database.getRepository(SimulatorDeviceEntity).save({ name: 'Source' });
		const channel = await database.getRepository(SimulatorChannelEntity).save({
			device,
			name: 'Temperature',
			category: ChannelCategory.TEMPERATURE,
		});
		const property = await database.getRepository(SimulatorChannelPropertyEntity).save({
			channel,
			category: PropertyCategory.TEMPERATURE,
			dataType: DataTypeType.FLOAT,
			permissions: [PermissionType.READ_WRITE],
		});
		await database.getRepository(SimulatorChannelPropertyEntity).save({
			channel,
			category: PropertyCategory.HUMIDITY,
			dataType: DataTypeType.FLOAT,
			permissions: [PermissionType.READ_ONLY],
		});
		await database.getRepository(ChannelControlEntity).save({ channel, name: 'Channel control' });
		await database.getRepository(DeviceControlEntity).save({ device, name: 'Device control' });
		const baselineChannel = await channels.findOne(channel.id);
		const findChannel = jest.spyOn(channels, 'findOne');
		const findDevice = jest.spyOn(devices, 'findOne');
		const findProperty = jest.spyOn(properties, 'findOne');
		const processBatch = jest.fn<Promise<boolean>, [IDevicePropertyData[]]>().mockResolvedValue(true);
		const sourcePlatform = { processBatch } as unknown as IDevicePlatform;
		const platform = new VirtualDevicePlatform(devices, channels, properties, {
			get: () => sourcePlatform,
		} as unknown as PlatformRegistryService);
		const virtualProperty = Object.assign(new VirtualChannelPropertyEntity(), {
			id: 'alias',
			valueOrigin: VirtualValueOrigin.SOURCE,
			sourcePropertyId: property.id,
		});
		const updates = [
			{ device: new VirtualDeviceEntity(), channel: new VirtualChannelEntity(), property: virtualProperty, value: 22 },
		];
		expect(await platform.processBatch(updates)).toBe(true);
		const forwarded = processBatch.mock.calls[0][0][0];
		expect(findChannel).not.toHaveBeenCalled();
		expect(findProperty).toHaveBeenCalledTimes(1);
		expect(findDevice).toHaveBeenCalledTimes(1);
		expect(instanceToPlain(forwarded.channel, { enableCircularCheck: true })).toEqual(
			instanceToPlain(baselineChannel, { enableCircularCheck: true }),
		);
		expect(forwarded.channel).toBe(forwarded.device.channels.find((item: ChannelEntity) => item.id === channel.id));
		expect(forwarded.channel.controls).toHaveLength(1);
		expect(forwarded.channel.properties).toHaveLength(2);
		expect(forwarded.property).toBeInstanceOf(SimulatorChannelPropertyEntity);
		expect(forwarded.property).toMatchObject({ unit: '°C', value: { value: 21 } });
		expect(forwarded.property.channel).toMatchObject({ device: { id: device.id } });
		expect(forwarded.device.status.online).toBe(true);
		expect(forwarded.device.controls).toHaveLength(1);
		liveValue = 24;
		expect(await platform.processBatch(updates)).toBe(true);
		expect(processBatch.mock.calls[1][0][0].property.value.value).toBe(24);
		expect(
			processBatch.mock.calls[1][0][0].channel.properties.every(
				(item: ChannelPropertyEntity) => item.value.value === 24,
			),
		).toBe(true);
	});
});
