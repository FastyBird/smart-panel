import { instanceToPlain } from 'class-transformer';
import { validate } from 'class-validator';
import { getMetadataArgsStorage } from 'typeorm';

import { toInstance } from '../../../common/utils/transform.utils';
import { DEVICES_UNIFI_PROTECT_TYPE } from '../devices-unifi-protect.constants';
import { CreateProtectChannelDto } from '../dto/create-channel.dto';
import { CreateProtectDeviceChannelPropertyDto } from '../dto/create-device-channel-property.dto';
import { CreateProtectDeviceDto } from '../dto/create-device.dto';
import { UpdateProtectChannelPropertyDto } from '../dto/update-channel-property.dto';
import { UpdateProtectDeviceDto } from '../dto/update-device.dto';

import {
	ProtectChannelEntity,
	ProtectChannelPropertyEntity,
	ProtectDeviceEntity,
} from './devices-unifi-protect.entity';

describe('UniFi Protect entities', () => {
	it('uses the plugin discriminator and exposes the identity columns in snake case', () => {
		const device = toInstance(ProtectDeviceEntity, {
			id: 'd',
			protect_nvr_id: 'n',
			protect_device_id: 'c',
			protect_model_key: 'camera',
		});

		expect(device.type).toBe('devices-unifi-protect');
		expect(device.protectNvrId).toBe('n');
		expect(device.protectDeviceId).toBe('c');
		expect(device.protectModelKey).toBe('camera');
		expect(instanceToPlain(device)).toMatchObject({
			type: 'devices-unifi-protect',
			protect_nvr_id: 'n',
			protect_device_id: 'c',
			protect_model_key: 'camera',
		});

		const discriminators = getMetadataArgsStorage().discriminatorValues;

		for (const target of [ProtectDeviceEntity, ProtectChannelEntity, ProtectChannelPropertyEntity]) {
			expect(discriminators.find((d) => d.target === target)?.value).toBe(DEVICES_UNIFI_PROTECT_TYPE);
		}
	});

	it('exposes the mapping name of a property in snake case', () => {
		const property = toInstance(ProtectChannelPropertyEntity, { id: 'p', protect_mapping_name: 'motion' });

		expect(property.type).toBe(DEVICES_UNIFI_PROTECT_TYPE);
		expect(property.protectMappingName).toBe('motion');
		expect(instanceToPlain(property)).toMatchObject({ protect_mapping_name: 'motion' });
	});

	it('keeps the generic identifiers next to the Protect identity', () => {
		const device = Object.assign(new ProtectDeviceEntity(), { id: 'device-id', identifier: 'protect-device' });
		const channel = Object.assign(new ProtectChannelEntity(), { id: 'channel-id', identifier: 'camera' });

		expect(device.identifier).toBe('protect-device');
		expect(device.toString()).toContain('protect-device');
		expect(channel.type).toBe(DEVICES_UNIFI_PROTECT_TYPE);
		expect(channel.toString()).toContain('camera');
	});

	it('declares the identity columns as nullable varchar and the partial unique index', () => {
		const storage = getMetadataArgsStorage();
		const columns = (target: new () => unknown) =>
			storage.columns.filter((column) => column.target === target).map((column) => column.propertyName);
		const column = (target: new () => unknown, name: string) =>
			storage.columns.find((candidate) => candidate.target === target && candidate.propertyName === name)?.options;

		expect(columns(ProtectDeviceEntity)).toEqual(['protectNvrId', 'protectDeviceId', 'protectModelKey']);
		expect(columns(ProtectChannelPropertyEntity)).toEqual(['protectMappingName']);

		for (const name of ['protectNvrId', 'protectDeviceId', 'protectModelKey']) {
			expect(column(ProtectDeviceEntity, name)).toMatchObject({ type: 'varchar', nullable: true });
		}

		expect(column(ProtectChannelPropertyEntity, 'protectMappingName')).toMatchObject({
			type: 'varchar',
			nullable: true,
		});

		const index = storage.indices.find((candidate) => candidate.name === 'UQ_unifi_protect_device_identity');

		expect(index?.target).toBe(ProtectDeviceEntity);
		expect(index?.unique).toBe(true);
		expect(index?.columns).toEqual(['protectNvrId', 'protectDeviceId']);
		expect(index?.where).toBe(
			`"type" = 'devices-unifi-protect' AND "protectNvrId" IS NOT NULL AND "protectDeviceId" IS NOT NULL`,
		);
	});
});

describe('UniFi Protect DTOs', () => {
	it('does not accept identity changes through the update DTO', () => {
		const dto = toInstance(UpdateProtectDeviceDto, {
			type: 'devices-unifi-protect',
			protect_nvr_id: 'x',
			protect_device_id: 'x',
			protect_model_key: 'x',
		});

		expect(dto.type).toBe(DEVICES_UNIFI_PROTECT_TYPE);
		expect(dto as unknown as Record<string, unknown>).not.toHaveProperty('protectNvrId');
		expect((dto as unknown as Record<string, unknown>).protectDeviceId).toBeUndefined();
		expect((dto as unknown as Record<string, unknown>).protectModelKey).toBeUndefined();
	});

	it('accepts the identity on create and bounds each value to 64 characters', async () => {
		const valid = toInstance(CreateProtectDeviceDto, {
			type: DEVICES_UNIFI_PROTECT_TYPE,
			category: 'camera',
			name: 'Dome',
			protect_nvr_id: 'nvr',
			protect_device_id: 'cam',
			protect_model_key: 'camera',
		});

		expect(valid.protectNvrId).toBe('nvr');
		expect(valid.protectDeviceId).toBe('cam');
		expect(valid.protectModelKey).toBe('camera');
		expect((await validate(valid)).filter((error) => error.property.startsWith('protect'))).toEqual([]);

		const tooLong = toInstance(CreateProtectDeviceDto, {
			type: DEVICES_UNIFI_PROTECT_TYPE,
			category: 'camera',
			name: 'Dome',
			protect_nvr_id: 'n'.repeat(65),
			protect_device_id: 'c'.repeat(64),
			protect_model_key: 'k'.repeat(65),
		});

		expect((await validate(tooLong)).map((error) => error.property).sort()).toEqual([
			'protectModelKey',
			'protectNvrId',
		]);
	});

	it('bounds the mapping name to 128 characters', async () => {
		const base = {
			type: DEVICES_UNIFI_PROTECT_TYPE,
			category: 'generic',
			name: 'p',
			data_type: 'bool',
			permissions: ['ro'],
		};
		const ok = toInstance(CreateProtectDeviceChannelPropertyDto, { ...base, protect_mapping_name: 'm'.repeat(128) });
		const tooLong = toInstance(CreateProtectDeviceChannelPropertyDto, {
			...base,
			protect_mapping_name: 'm'.repeat(129),
		});

		expect(ok.protectMappingName).toHaveLength(128);
		expect((await validate(ok)).map((error) => error.property)).not.toContain('protectMappingName');
		expect((await validate(tooLong)).map((error) => error.property)).toContain('protectMappingName');
	});

	it('does not accept a category or mapping change through the property update DTO', async () => {
		const dto = toInstance(UpdateProtectChannelPropertyDto, {
			type: DEVICES_UNIFI_PROTECT_TYPE,
			category: 'brightness',
			protect_mapping_name: 'other',
			name: 'Renamed',
		});

		expect(dto.type).toBe(DEVICES_UNIFI_PROTECT_TYPE);
		expect(dto.name).toBe('Renamed');
		expect(dto as unknown as Record<string, unknown>).not.toHaveProperty('category');
		expect(dto as unknown as Record<string, unknown>).not.toHaveProperty('protectMappingName');
		expect(instanceToPlain(dto)).not.toHaveProperty('category');
		expect(await validate(dto)).toEqual([]);
	});

	it('requires the plugin type on the channel create DTO', async () => {
		const missing = toInstance(CreateProtectChannelDto, { category: 'generic', name: 'c' });

		expect((await validate(missing)).map((error) => error.property)).toContain('type');
	});
});
