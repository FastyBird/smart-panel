import { Expose, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { DeviceCategory } from '../../../modules/devices/devices.constants';

@ApiSchema({ name: 'DevicesZigbee2mqttPluginDataWizardPermitJoin' })
export class Z2mWizardPermitJoinModel {
	@ApiProperty({ description: 'Whether bridge is currently in pairing mode', example: false })
	@Expose()
	@IsBoolean()
	active: boolean;

	@ApiPropertyOptional({
		description: 'Permit_join expiry timestamp',
		nullable: true,
		example: '2026-04-30T12:04:14.000Z',
	})
	@Expose()
	@IsString()
	@IsOptional()
	expiresAt: string | null;

	@ApiProperty({ description: 'Remaining permit_join seconds (0 when inactive)', example: 0 })
	@Expose()
	@IsInt()
	remainingSeconds: number;
}

@ApiSchema({ name: 'DevicesZigbee2mqttPluginDataWizardDevice' })
export class Z2mWizardDeviceSnapshotModel {
	@ApiProperty({ description: 'Device IEEE address (unique key)', example: '0x00158d0001a1b2c3' })
	@Expose()
	@IsString()
	ieeeAddress: string;

	@ApiProperty({ description: 'Z2M friendly name (raw, as configured in zigbee2mqtt)', example: 'living_room_lamp' })
	@Expose()
	@IsString()
	friendlyName: string;

	@ApiPropertyOptional({ description: 'Manufacturer (vendor)', nullable: true, example: 'Philips' })
	@Expose()
	@IsString()
	@IsOptional()
	manufacturer: string | null;

	@ApiPropertyOptional({ description: 'Model identifier', nullable: true, example: 'LCT001' })
	@Expose()
	@IsString()
	@IsOptional()
	model: string | null;

	@ApiPropertyOptional({
		description: 'Human-readable model description',
		nullable: true,
		example: 'Hue White and Color Ambiance E27',
	})
	@Expose()
	@IsString()
	@IsOptional()
	description: string | null;

	@ApiProperty({
		description: 'Wizard candidate status',
		enum: ['ready', 'unsupported', 'already_registered', 'failed'],
		example: 'ready',
	})
	@Expose()
	@IsIn(['ready', 'unsupported', 'already_registered', 'failed'])
	status: 'ready' | 'unsupported' | 'already_registered' | 'failed';

	@ApiProperty({
		description: 'Available target device categories',
		type: 'array',
		items: { type: 'string', enum: Object.values(DeviceCategory) },
		example: [DeviceCategory.LIGHTING],
	})
	@Expose()
	@IsArray()
	@IsEnum(DeviceCategory, { each: true })
	categories: DeviceCategory[];

	@ApiPropertyOptional({
		description: 'Suggested target device category from descriptor',
		nullable: true,
		enum: DeviceCategory,
		example: DeviceCategory.LIGHTING,
	})
	@Expose()
	@IsEnum(DeviceCategory)
	@IsOptional()
	suggestedCategory: DeviceCategory | null;

	@ApiProperty({ description: 'Channel count predicted by the mapping preview', example: 4 })
	@Expose()
	@IsInt()
	previewChannelCount: number;

	@ApiProperty({
		description: 'Identifiers of channels that would be created (for tooltip)',
		type: 'array',
		items: { type: 'string' },
		example: ['light', 'illuminance', 'battery'],
	})
	@Expose()
	@IsArray()
	@IsString({ each: true })
	previewChannelIdentifiers: string[];

	@ApiPropertyOptional({ description: 'Already registered device id', nullable: true, example: null })
	@Expose()
	@IsString()
	@IsOptional()
	registeredDeviceId: string | null;

	@ApiPropertyOptional({ description: 'Already registered device name', nullable: true, example: null })
	@Expose()
	@IsString()
	@IsOptional()
	registeredDeviceName: string | null;

	@ApiPropertyOptional({
		description: 'Already registered device category',
		nullable: true,
		enum: DeviceCategory,
		example: null,
	})
	@Expose()
	@IsEnum(DeviceCategory)
	@IsOptional()
	registeredDeviceCategory: DeviceCategory | null;

	@ApiPropertyOptional({ description: 'Last lookup error message', nullable: true, example: null })
	@Expose()
	@IsString()
	@IsOptional()
	error: string | null;

	@ApiProperty({ description: 'Last time this candidate was observed', example: '2026-04-30T12:00:00.000Z' })
	@Expose()
	@IsString()
	lastSeenAt: string;
}

@ApiSchema({ name: 'DevicesZigbee2mqttPluginDataWizardSession' })
export class Z2mWizardSessionModel {
	@ApiProperty({ description: 'Wizard session id', example: 'c66808d8-0af1-4b93-bd61-4131cf62f20f' })
	@Expose()
	@IsString()
	id: string;

	@ApiProperty({ description: 'Whether bridge is currently online', example: true })
	@Expose()
	@IsBoolean()
	bridgeOnline: boolean;

	@ApiProperty({ description: 'Wizard session start timestamp', example: '2026-04-30T12:00:00.000Z' })
	@Expose()
	@IsString()
	startedAt: string;

	@ApiProperty({ description: 'Permit_join state', type: () => Z2mWizardPermitJoinModel })
	@Expose()
	@ValidateNested()
	@Type(() => Z2mWizardPermitJoinModel)
	permitJoin: Z2mWizardPermitJoinModel;

	@ApiProperty({
		description: 'Discovered Zigbee device candidates',
		type: 'array',
		items: { $ref: getSchemaPath(Z2mWizardDeviceSnapshotModel) },
	})
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => Z2mWizardDeviceSnapshotModel)
	devices: Z2mWizardDeviceSnapshotModel[];
}

@ApiSchema({ name: 'DevicesZigbee2mqttPluginDataWizardAdoptionResult' })
export class Z2mWizardAdoptionResultModel {
	@ApiProperty({ description: 'Device IEEE address', example: '0x00158d0001a1b2c3' })
	@Expose()
	@IsString()
	ieeeAddress: string;

	@ApiProperty({ description: 'Resolved Smart Panel device name', example: 'Living Room Lamp' })
	@Expose()
	@IsString()
	name: string;

	@ApiProperty({ description: 'Adoption outcome', enum: ['created', 'updated', 'failed'], example: 'created' })
	@Expose()
	@IsIn(['created', 'updated', 'failed'])
	status: 'created' | 'updated' | 'failed';

	@ApiPropertyOptional({ description: 'Failure message', nullable: true, example: null })
	@Expose()
	@IsString()
	@IsOptional()
	error: string | null;
}

@ApiSchema({ name: 'DevicesZigbee2mqttPluginDataWizardAdoption' })
export class Z2mWizardAdoptionModel {
	@ApiProperty({
		description: 'Per-device adoption results',
		type: 'array',
		items: { $ref: getSchemaPath(Z2mWizardAdoptionResultModel) },
	})
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => Z2mWizardAdoptionResultModel)
	results: Z2mWizardAdoptionResultModel[];
}
