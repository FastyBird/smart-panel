import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsMACAddress, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { Column, Entity } from 'typeorm';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { BaseEntity } from '../../../common/entities/base.entity';

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
}
