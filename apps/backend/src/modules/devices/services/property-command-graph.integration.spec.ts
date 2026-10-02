import { DataSource, EntitySchema } from 'typeorm';

import { IntentsService } from '../../intents/services/intents.service';
import { ConnectionState, DataTypeType, PermissionType } from '../devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../entities/devices.entity';
import { IDevicePropertyData } from '../platforms/device.platform';

import { ChannelsPropertiesService } from './channels.properties.service';
import { ChannelsService } from './channels.service';
import { DeviceCommandGraphService } from './device-command-graph.service';
import { DevicesService } from './devices.service';
import { PlatformRegistryService } from './platform.registry.service';
import { PropertyCommandDispatchService } from './property-command-dispatch.service';
import { PropertyCommandWindowService } from './property-command-window.service';
import { PropertyCommandService } from './property-command.service';
import { PropertyMetadataService } from './property-metadata.service';
import { PropertyValueService } from './property-value.service';

// Keep the production graph's relation names so the real DevicesService query runs against SQLite.
const deviceSchema = new EntitySchema<DeviceEntity>({
	name: 'CommandGraphDevice',
	columns: {
		id: { type: String, primary: true },
		type: { type: String },
		status: { type: 'simple-json' },
	},
	relations: {
		channels: { type: 'one-to-many', target: 'CommandGraphChannel', inverseSide: 'device' },
		controls: { type: 'one-to-many', target: 'CommandGraphDeviceControl', inverseSide: 'device' },
		deviceZones: { type: 'one-to-many', target: 'CommandGraphZone', inverseSide: 'device' },
	},
});
const channelSchema = new EntitySchema<ChannelEntity>({
	name: 'CommandGraphChannel',
	columns: { id: { type: String, primary: true }, identifier: { type: String } },
	relations: {
		device: { type: 'many-to-one', target: 'CommandGraphDevice', joinColumn: true },
		properties: { type: 'one-to-many', target: 'CommandGraphProperty', inverseSide: 'channel' },
		controls: { type: 'one-to-many', target: 'CommandGraphChannelControl', inverseSide: 'channel' },
	},
});
const propertySchema = new EntitySchema<ChannelPropertyEntity>({
	name: 'CommandGraphProperty',
	columns: {
		id: { type: String, primary: true },
		identifier: { type: String },
		dataType: { type: String },
		permissions: { type: 'simple-array' },
	},
	relations: { channel: { type: 'many-to-one', target: 'CommandGraphChannel', joinColumn: true } },
});
const deviceControlSchema = new EntitySchema<{ id: string; device: { id: string } }>({
	name: 'CommandGraphDeviceControl',
	columns: { id: { type: String, primary: true } },
	relations: { device: { type: 'many-to-one', target: 'CommandGraphDevice', joinColumn: true } },
});
const channelControlSchema = new EntitySchema<{ id: string; channel: { id: string } }>({
	name: 'CommandGraphChannelControl',
	columns: { id: { type: String, primary: true } },
	relations: { channel: { type: 'many-to-one', target: 'CommandGraphChannel', joinColumn: true } },
});
const zoneSchema = new EntitySchema<{ id: string; device: { id: string } }>({
	name: 'CommandGraphZone',
	columns: { id: { type: String, primary: true } },
	relations: { device: { type: 'many-to-one', target: 'CommandGraphDevice', joinColumn: true } },
});

describe('Property command preparation with a fresh SQLite device graph', () => {
	let dataSource: DataSource;
	let service: PropertyCommandService;
	let channels: ChannelsService;
	let dispatchBatch: jest.Mock;
	let completeIntent: jest.Mock;
	let channelRead: jest.SpyInstance;
	let propertyRead: jest.SpyInstance;
	let query: jest.SpyInstance;

	beforeEach(async () => {
		dataSource = await new DataSource({
			type: 'sqlite',
			database: ':memory:',
			entities: [deviceSchema, channelSchema, propertySchema, deviceControlSchema, channelControlSchema, zoneSchema],
			synchronize: true,
		}).initialize();
		await dataSource.getRepository(deviceSchema).insert(
			['device', 'other-device'].map((id) => ({
				id,
				type: 'test-integration',
				status: { online: true, status: ConnectionState.CONNECTED },
			})),
		);
		await dataSource.getRepository(channelSchema).insert([
			{ id: 'channel', identifier: 'switch:2', device: { id: 'device' } },
			{ id: 'other-channel', identifier: 'switch:3', device: { id: 'other-device' } },
		]);
		await dataSource.getRepository(propertySchema).insert({
			id: 'property',
			identifier: 'output',
			dataType: DataTypeType.BOOL,
			permissions: [PermissionType.READ_WRITE],
			channel: { id: 'channel' },
		});
		await dataSource.getRepository(deviceControlSchema).insert({ id: 'device-control', device: { id: 'device' } });
		await dataSource.getRepository(channelControlSchema).insert({ id: 'channel-control', channel: { id: 'channel' } });

		const devices = Object.create(DevicesService.prototype) as DevicesService;
		Object.defineProperties(devices, {
			repository: { value: dataSource.getRepository(deviceSchema) },
			logger: { value: { debug: jest.fn() } },
		});
		dispatchBatch = jest.fn().mockResolvedValue({ success: true });
		completeIntent = jest.fn();
		channels = Object.create(ChannelsService.prototype) as ChannelsService;
		Object.defineProperties(channels, {
			repository: { value: dataSource.getRepository(channelSchema) },
			logger: { value: { debug: jest.fn() } },
		});
		const properties = Object.create(ChannelsPropertiesService.prototype) as ChannelsPropertiesService;
		Object.defineProperties(properties, {
			repository: { value: dataSource.getRepository(propertySchema) },
			logger: { value: { debug: jest.fn() } },
		});
		channelRead = jest.spyOn(channels, 'findOne');
		propertyRead = jest.spyOn(properties, 'findOne');
		service = new PropertyCommandService(
			devices as unknown as DeviceCommandGraphService,
			channels,
			// This graph-shape fixture deliberately uses fresh SQL for metadata; the production
			// catalog and its invalidation are covered in HomeKit convergence integration tests.
			properties as unknown as PropertyMetadataService,
			{ readLatest: () => Promise.resolve(null) } as unknown as PropertyValueService,
			{ get: () => ({}), getCommandTtlMs: () => 3000 } as unknown as PlatformRegistryService,
			{ createIntent: () => ({ id: 'intent' }), completeIntent } as unknown as IntentsService,
			{ dispatchBatch } as unknown as PropertyCommandDispatchService,
			{} as PropertyCommandWindowService,
		);
		query = jest.spyOn(dataSource.logger, 'logQuery');
	});

	afterEach(async () => {
		await dataSource.destroy();
	});

	const execute = () => service.processApiPropertyCommand('device', 'channel', 'property', true);

	it('uses three SQL reads before dispatch without reloading the channel graph', async () => {
		const expectedChannel = await channels.findOne('channel', 'device');
		query.mockClear();
		channelRead.mockClear();

		await execute();

		expect(query.mock.calls.filter(([sql]: [string]) => sql.startsWith('SELECT'))).toHaveLength(3);
		expect(channelRead).not.toHaveBeenCalled();
		expect(propertyRead).toHaveBeenCalledTimes(2);
		expect(propertyRead).toHaveBeenCalledWith('property');
		expect(dispatchBatch).toHaveBeenCalledTimes(1);
		const [updates] = dispatchBatch.mock.calls[0] as [IDevicePropertyData[]];
		const [{ device, channel, property, value }] = updates;
		expect(channel).toBe(device.channels[0]);
		expect(channel).toEqual(expectedChannel);
		expect(channel.properties[0].id).toBe(property.id);
		expect(channel).toMatchObject({ identifier: 'switch:2', device: { id: 'device' } });
		expect(property).toMatchObject({ identifier: 'output', channel: { id: 'channel', device: { id: 'device' } } });
		expect(device.controls).toMatchObject([{ id: 'device-control' }]);
		expect(channel.controls).toMatchObject([{ id: 'channel-control' }]);
		expect(value).toBe(true);
	});

	it.each(['deleted', 'reparented', 'read-only'] as const)(
		'observes a %s property on the next command instead of retaining the previous graph',
		async (mutation) => {
			await execute();
			expect(dispatchBatch).toHaveBeenCalledTimes(1);
			dispatchBatch.mockClear();
			const properties = dataSource.getRepository(propertySchema);
			if (mutation === 'deleted') {
				await properties.delete('property');
			} else if (mutation === 'reparented') {
				await properties.update('property', { channel: { id: 'other-channel' } });
			} else {
				await properties.update('property', { permissions: [PermissionType.READ_ONLY] });
			}

			await execute();

			expect(dispatchBatch).not.toHaveBeenCalled();
			expect(completeIntent).toHaveBeenLastCalledWith('intent', [
				expect.objectContaining({
					error: mutation === 'read-only' ? 'Property is not writable' : 'Property not found',
				}),
			]);
		},
	);

	it('rejects a channel moved to another device', async () => {
		await dataSource.getRepository(channelSchema).update('channel', { device: { id: 'other-device' } });

		await execute();

		expect(dispatchBatch).not.toHaveBeenCalled();
		expect(completeIntent).toHaveBeenLastCalledWith('intent', [
			expect.objectContaining({ error: 'Channel not found' }),
		]);
	});
});
