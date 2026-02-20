import { Expose, Transform } from 'class-transformer';
import {
	IsBoolean,
	IsEnum,
	IsInt,
	IsMACAddress,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	Max,
	Min,
} from 'class-validator';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { BaseEntity } from '../../../common/entities/base.entity';
import { PageEntity } from '../../dashboard/entities/dashboard.entity';
import { SpaceEntity } from '../../spaces/entities/space.entity';
import {
	DistanceUnitType,
	PrecipitationUnitType,
	PressureUnitType,
	TemperatureUnitType,
	WindSpeedUnitType,
} from '../../system/system.constants';
import { ConnectionState, DisplayRole, HomeMode } from '../displays.constants';

@ApiSchema({ name: 'DisplaysModuleDataDisplay' })
@Entity('displays_module_displays')
export class DisplayEntity extends BaseEntity {
	// === Instance Information ===

	@ApiProperty({
		name: 'mac_address',
		description: 'MAC address of the device network interface',
		type: 'string',
		format: 'mac',
		example: '00:1A:2B:3C:4D:5E',
	})
	@Expose({ name: 'mac_address' })
	@IsMACAddress()
	@Transform(({ obj }: { obj: { mac_address?: string; macAddress?: string } }) => obj.mac_address ?? obj.macAddress, {
		toClassOnly: true,
	})
	@Column({ nullable: false, unique: true })
	macAddress: string;

	@ApiProperty({
		description: 'Application version running on the display',
		type: 'string',
		example: '1.0.0',
	})
	@Expose()
	@IsString()
	@Column({ nullable: true, default: null })
	version: string | null;

	@ApiPropertyOptional({
		description: 'Build number or identifier of the app',
		type: 'string',
		nullable: true,
		example: '42',
	})
	@Expose()
	@IsOptional()
	@IsString()
	@Column({ nullable: true, default: null })
	build: string | null;

	// === Profile Information ===

	@ApiProperty({
		name: 'screen_width',
		description: 'Display screen width in pixels',
		type: 'integer',
		example: 1920,
	})
	@Expose({ name: 'screen_width' })
	@IsInt()
	@Transform(
		({ obj }: { obj: { screen_width?: number; screenWidth?: number } }) => obj.screen_width ?? obj.screenWidth,
		{
			toClassOnly: true,
		},
	)
	@Column({ type: 'int', default: 0 })
	screenWidth: number;

	@ApiProperty({
		name: 'screen_height',
		description: 'Display screen height in pixels',
		type: 'integer',
		example: 1080,
	})
	@Expose({ name: 'screen_height' })
	@IsInt()
	@Transform(
		({ obj }: { obj: { screen_height?: number; screenHeight?: number } }) => obj.screen_height ?? obj.screenHeight,
		{ toClassOnly: true },
	)
	@Column({ type: 'int', default: 0 })
	screenHeight: number;

	@ApiProperty({
		name: 'pixel_ratio',
		description: 'Display pixel ratio',
		type: 'number',
		example: 1.5,
	})
	@Expose({ name: 'pixel_ratio' })
	@IsNumber()
	@Transform(({ obj }: { obj: { pixel_ratio?: number; pixelRatio?: number } }) => obj.pixel_ratio ?? obj.pixelRatio, {
		toClassOnly: true,
	})
	@Column({ type: 'float', default: 1 })
	pixelRatio: number;

	@ApiProperty({
		name: 'unit_size',
		description: 'Display unit size',
		type: 'number',
		example: 8,
	})
	@Expose({ name: 'unit_size' })
	@IsNumber()
	@Transform(({ obj }: { obj: { unit_size?: number; unitSize?: number } }) => obj.unit_size ?? obj.unitSize, {
		toClassOnly: true,
	})
	@Column({ type: 'float', default: 8 })
	unitSize: number;

	@ApiProperty({
		description: 'Number of grid rows',
		type: 'integer',
		example: 12,
	})
	@Expose()
	@IsNumber()
	@Column({ type: 'int', default: 12 })
	rows: number;

	@ApiProperty({
		description: 'Number of grid columns',
		type: 'integer',
		example: 24,
	})
	@Expose()
	@IsNumber()
	@Column({ type: 'int', default: 24 })
	cols: number;

	// === Configuration (from DisplayConfigModel) ===

	@ApiProperty({
		name: 'dark_mode',
		description: 'Dark mode enabled state',
		type: 'boolean',
		example: false,
	})
	@Expose({ name: 'dark_mode' })
	@IsBoolean()
	@Transform(({ obj }: { obj: { dark_mode?: boolean; darkMode?: boolean } }) => obj.dark_mode ?? obj.darkMode, {
		toClassOnly: true,
	})
	@Column({ type: 'boolean', default: false })
	darkMode: boolean;

	@ApiProperty({
		description: 'Display brightness level (0-100)',
		type: 'integer',
		minimum: 0,
		maximum: 100,
		example: 100,
	})
	@Expose()
	@IsNumber()
	@Min(0)
	@Max(100)
	@Column({ type: 'int', default: 100 })
	brightness: number;

	@ApiProperty({
		name: 'screen_lock_duration',
		description: 'Screen lock duration in seconds (0-3600, 0 = disabled)',
		type: 'integer',
		minimum: 0,
		maximum: 3600,
		example: 30,
	})
	@Expose({ name: 'screen_lock_duration' })
	@IsNumber()
	@Min(0)
	@Max(3600)
	@Transform(
		({ obj }: { obj: { screen_lock_duration?: number; screenLockDuration?: number } }) =>
			obj.screen_lock_duration ?? obj.screenLockDuration,
		{ toClassOnly: true },
	)
	@Column({ type: 'int', default: 30 })
	screenLockDuration: number;

	@ApiProperty({
		name: 'screen_saver',
		description: 'Screen saver enabled state',
		type: 'boolean',
		example: true,
	})
	@Expose({ name: 'screen_saver' })
	@IsBoolean()
	@Transform(
		({ obj }: { obj: { screen_saver?: boolean; screenSaver?: boolean } }) => obj.screen_saver ?? obj.screenSaver,
		{ toClassOnly: true },
	)
	@Column({ type: 'boolean', default: true })
	screenSaver: boolean;

	// === Display Name and Settings ===

	@ApiPropertyOptional({
		description: 'Display friendly name',
		type: 'string',
		nullable: true,
		example: 'Living Room Panel',
	})
	@Expose()
	@IsOptional()
	@IsString()
	@Column({ nullable: true, default: null })
	name: string | null;

	@ApiPropertyOptional({
		description:
			'Display role defining its purpose (room: single room control, master: whole-house overview, entry: house modes and security)',
		type: 'string',
		enum: DisplayRole,
		nullable: false,
		default: DisplayRole.ROOM,
		example: DisplayRole.ROOM,
	})
	@Expose()
	@IsOptional()
	@IsEnum(DisplayRole, {
		message: '[{"field":"role","reason":"Role must be one of: room, master, entry."}]',
	})
	@Column({ type: 'varchar', length: 20, default: DisplayRole.ROOM })
	role: DisplayRole;

	// === Room Assignment (only for role=room displays) ===

	@ApiPropertyOptional({
		name: 'room_id',
		description: 'Room this display is assigned to (required for room role, must be null for master/entry roles)',
		type: 'string',
		format: 'uuid',
		nullable: true,
		example: 'f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6',
	})
	@Expose({ name: 'room_id' })
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"room_id","reason":"Room ID must be a valid UUID (version 4)."}]' })
	@Transform(({ obj }: { obj: { room_id?: string; roomId?: string } }) => obj.room_id ?? obj.roomId, {
		toClassOnly: true,
	})
	@Index()
	@Column({ nullable: true, default: null })
	roomId: string | null;

	@ManyToOne(() => SpaceEntity, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'roomId' })
	room: SpaceEntity | null;

	// === Home Page Configuration ===

	@ApiPropertyOptional({
		name: 'home_mode',
		description:
			'Home page resolution mode (auto_space: use space page if available, explicit: use configured home page, first_page: use first assigned page)',
		type: 'string',
		enum: HomeMode,
		nullable: false,
		default: HomeMode.AUTO_SPACE,
		example: HomeMode.AUTO_SPACE,
	})
	@Expose({ name: 'home_mode' })
	@IsOptional()
	@IsEnum(HomeMode, {
		message: '[{"field":"home_mode","reason":"Home mode must be one of: auto_space, explicit, first_page."}]',
	})
	@Transform(({ obj }: { obj: { home_mode?: HomeMode; homeMode?: HomeMode } }) => obj.home_mode ?? obj.homeMode, {
		toClassOnly: true,
	})
	@Column({ type: 'varchar', length: 20, default: HomeMode.AUTO_SPACE })
	homeMode: HomeMode;

	@ApiPropertyOptional({
		name: 'home_page_id',
		description: 'Explicitly configured home page ID (used when home_mode is explicit)',
		type: 'string',
		format: 'uuid',
		nullable: true,
		example: 'f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6',
	})
	@Expose({ name: 'home_page_id' })
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"home_page_id","reason":"Home page ID must be a valid UUID (version 4)."}]' })
	@Transform(({ obj }: { obj: { home_page_id?: string; homePageId?: string } }) => obj.home_page_id ?? obj.homePageId, {
		toClassOnly: true,
	})
	@Index()
	@Column({ nullable: true, default: null })
	homePageId: string | null;

	@ManyToOne(() => PageEntity, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'homePageId' })
	homePage: PageEntity | null;

	// === Audio Capabilities (set during registration) ===

	@ApiProperty({
		name: 'audio_output_supported',
		description: 'Whether the display supports audio output (speakers)',
		type: 'boolean',
		example: true,
	})
	@Expose({ name: 'audio_output_supported' })
	@IsBoolean()
	@Transform(
		({ obj }: { obj: { audio_output_supported?: boolean; audioOutputSupported?: boolean } }) =>
			obj.audio_output_supported ?? obj.audioOutputSupported,
		{ toClassOnly: true },
	)
	@Column({ type: 'boolean', default: false })
	audioOutputSupported: boolean;

	@ApiProperty({
		name: 'audio_input_supported',
		description: 'Whether the display supports audio input (microphone)',
		type: 'boolean',
		example: false,
	})
	@Expose({ name: 'audio_input_supported' })
	@IsBoolean()
	@Transform(
		({ obj }: { obj: { audio_input_supported?: boolean; audioInputSupported?: boolean } }) =>
			obj.audio_input_supported ?? obj.audioInputSupported,
		{ toClassOnly: true },
	)
	@Column({ type: 'boolean', default: false })
	audioInputSupported: boolean;

	// === Audio Settings (configurable, only relevant if supported) ===

	@ApiProperty({
		description: 'Speaker enabled state (only relevant if audio output is supported)',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsBoolean()
	@Column({ type: 'boolean', default: false })
	speaker: boolean;

	@ApiProperty({
		name: 'speaker_volume',
		description: 'Speaker volume level (0-100, only relevant if audio output is supported)',
		type: 'integer',
		minimum: 0,
		maximum: 100,
		example: 50,
	})
	@Expose({ name: 'speaker_volume' })
	@IsNumber()
	@Min(0)
	@Max(100)
	@Transform(
		({ obj }: { obj: { speaker_volume?: number; speakerVolume?: number } }) => obj.speaker_volume ?? obj.speakerVolume,
		{ toClassOnly: true },
	)
	@Column({ type: 'int', default: 50 })
	speakerVolume: number;

	@ApiProperty({
		description: 'Microphone enabled state (only relevant if audio input is supported)',
		type: 'boolean',
		example: false,
	})
	@Expose()
	@IsBoolean()
	@Column({ type: 'boolean', default: false })
	microphone: boolean;

	@ApiProperty({
		name: 'microphone_volume',
		description: 'Microphone volume level (0-100, only relevant if audio input is supported)',
		type: 'integer',
		minimum: 0,
		maximum: 100,
		example: 50,
	})
	@Expose({ name: 'microphone_volume' })
	@IsNumber()
	@Min(0)
	@Max(100)
	@Transform(
		({ obj }: { obj: { microphone_volume?: number; microphoneVolume?: number } }) =>
			obj.microphone_volume ?? obj.microphoneVolume,
		{ toClassOnly: true },
	)
	@Column({ type: 'int', default: 50 })
	microphoneVolume: number;

	// === Unit Overrides (null = use system default) ===

	@ApiPropertyOptional({
		name: 'temperature_unit',
		description: 'Temperature display unit override (null = use system default)',
		type: 'string',
		enum: TemperatureUnitType,
		nullable: true,
		example: null,
	})
	@Expose({ name: 'temperature_unit' })
	@IsOptional()
	@IsEnum(TemperatureUnitType)
	@Transform(
		({ obj }: { obj: { temperature_unit?: string; temperatureUnit?: string } }) =>
			obj.temperature_unit ?? obj.temperatureUnit ?? null,
		{ toClassOnly: true },
	)
	@Column({ type: 'varchar', length: 20, nullable: true, default: null })
	temperatureUnit: TemperatureUnitType | null;

	@ApiPropertyOptional({
		name: 'wind_speed_unit',
		description: 'Wind speed display unit override (null = use system default)',
		type: 'string',
		enum: WindSpeedUnitType,
		nullable: true,
		example: null,
	})
	@Expose({ name: 'wind_speed_unit' })
	@IsOptional()
	@IsEnum(WindSpeedUnitType)
	@Transform(
		({ obj }: { obj: { wind_speed_unit?: string; windSpeedUnit?: string } }) =>
			obj.wind_speed_unit ?? obj.windSpeedUnit ?? null,
		{ toClassOnly: true },
	)
	@Column({ type: 'varchar', length: 20, nullable: true, default: null })
	windSpeedUnit: WindSpeedUnitType | null;

	@ApiPropertyOptional({
		name: 'pressure_unit',
		description: 'Pressure display unit override (null = use system default)',
		type: 'string',
		enum: PressureUnitType,
		nullable: true,
		example: null,
	})
	@Expose({ name: 'pressure_unit' })
	@IsOptional()
	@IsEnum(PressureUnitType)
	@Transform(
		({ obj }: { obj: { pressure_unit?: string; pressureUnit?: string } }) =>
			obj.pressure_unit ?? obj.pressureUnit ?? null,
		{ toClassOnly: true },
	)
	@Column({ type: 'varchar', length: 20, nullable: true, default: null })
	pressureUnit: PressureUnitType | null;

	@ApiPropertyOptional({
		name: 'precipitation_unit',
		description: 'Precipitation display unit override (null = use system default)',
		type: 'string',
		enum: PrecipitationUnitType,
		nullable: true,
		example: null,
	})
	@Expose({ name: 'precipitation_unit' })
	@IsOptional()
	@IsEnum(PrecipitationUnitType)
	@Transform(
		({ obj }: { obj: { precipitation_unit?: string; precipitationUnit?: string } }) =>
			obj.precipitation_unit ?? obj.precipitationUnit ?? null,
		{ toClassOnly: true },
	)
	@Column({ type: 'varchar', length: 20, nullable: true, default: null })
	precipitationUnit: PrecipitationUnitType | null;

	@ApiPropertyOptional({
		name: 'distance_unit',
		description: 'Distance display unit override (null = use system default)',
		type: 'string',
		enum: DistanceUnitType,
		nullable: true,
		example: null,
	})
	@Expose({ name: 'distance_unit' })
	@IsOptional()
	@IsEnum(DistanceUnitType)
	@Transform(
		({ obj }: { obj: { distance_unit?: string; distanceUnit?: string } }) =>
			obj.distance_unit ?? obj.distanceUnit ?? null,
		{ toClassOnly: true },
	)
	@Column({ type: 'varchar', length: 20, nullable: true, default: null })
	distanceUnit: DistanceUnitType | null;

	// === Registration Information ===

	@ApiPropertyOptional({
		name: 'registered_from_ip',
		description: 'IP address from which the display was registered',
		type: 'string',
		nullable: true,
		example: '127.0.0.1',
	})
	@Expose({ name: 'registered_from_ip' })
	@IsOptional()
	@IsString()
	@Column({ nullable: true, default: null })
	registeredFromIp: string | null;

	@ApiPropertyOptional({
		name: 'current_ip_address',
		description: 'Current IP address from which the display is connected via WebSocket',
		type: 'string',
		nullable: true,
		example: '192.168.1.100',
	})
	@Expose({ name: 'current_ip_address' })
	@IsOptional()
	@IsString()
	@Column({ nullable: true, default: null })
	currentIpAddress: string | null;

	@ApiPropertyOptional({
		description: 'Display online status',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsBoolean()
	online: boolean = false;

	@ApiPropertyOptional({
		description: 'Display connection state',
		enum: ConnectionState,
		example: ConnectionState.CONNECTED,
	})
	@Expose()
	@IsEnum(ConnectionState)
	status: ConnectionState = ConnectionState.UNKNOWN;

	// === Resolved Home Page (computed, not persisted) ===

	@ApiPropertyOptional({
		name: 'resolved_home_page_id',
		description: 'Resolved home page ID based on home_mode configuration. This is computed dynamically and not stored.',
		type: 'string',
		format: 'uuid',
		nullable: true,
		example: 'f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6',
	})
	@Expose({ name: 'resolved_home_page_id' })
	@IsOptional()
	@IsUUID('4')
	resolvedHomePageId?: string | null;
}
