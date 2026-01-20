import { Expose, Transform, Type } from 'class-transformer';
import {
	IsBoolean,
	IsEnum,
	IsInt,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	Max,
	Min,
	ValidateIf,
	ValidateNested,
} from 'class-validator';

import { ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { DisplayRole, HomeMode } from '../displays.constants';

@ApiSchema({ name: 'DisplaysModuleUpdateDisplay' })
export class UpdateDisplayDto {
	@ApiPropertyOptional({
		description: 'Application version running on the display',
		type: 'string',
		example: '1.0.0',
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsString({ message: '[{"field":"version","reason":"Version must be a string."}]' })
	version?: string;

	@ApiPropertyOptional({
		description: 'Build number or identifier of the app',
		type: 'string',
		nullable: true,
		example: '42',
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"build","reason":"Build must be a string."}]' })
	@ValidateIf((_, value) => value !== null)
	build?: string | null;

	@ApiPropertyOptional({
		name: 'screen_width',
		description: 'Display screen width in pixels',
		type: 'integer',
		example: 1920,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsInt({ message: '[{"field":"screen_width","reason":"Screen width must be an integer."}]' })
	screen_width?: number;

	@ApiPropertyOptional({
		name: 'screen_height',
		description: 'Display screen height in pixels',
		type: 'integer',
		example: 1080,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsInt({ message: '[{"field":"screen_height","reason":"Screen height must be an integer."}]' })
	screen_height?: number;

	@ApiPropertyOptional({
		name: 'pixel_ratio',
		description: 'Display pixel ratio',
		type: 'number',
		example: 1.5,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsNumber({}, { message: '[{"field":"pixel_ratio","reason":"Pixel ratio must be a number."}]' })
	pixel_ratio?: number;

	@ApiPropertyOptional({
		name: 'unit_size',
		description: 'Display unit size',
		type: 'number',
		example: 8,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsNumber({}, { message: '[{"field":"unit_size","reason":"Unit size must be a number."}]' })
	unit_size?: number;

	@ApiPropertyOptional({
		description: 'Number of grid rows',
		type: 'integer',
		example: 12,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsInt({ message: '[{"field":"rows","reason":"Rows must be an integer."}]' })
	rows?: number;

	@ApiPropertyOptional({
		description: 'Number of grid columns',
		type: 'integer',
		example: 24,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsInt({ message: '[{"field":"cols","reason":"Cols must be an integer."}]' })
	cols?: number;

	@ApiPropertyOptional({
		name: 'dark_mode',
		description: 'Dark mode enabled state',
		type: 'boolean',
		example: false,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsBoolean({ message: '[{"field":"dark_mode","reason":"Dark mode must be a boolean."}]' })
	dark_mode?: boolean;

	@ApiPropertyOptional({
		description: 'Display brightness level (0-100)',
		type: 'integer',
		minimum: 0,
		maximum: 100,
		example: 100,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsNumber({}, { message: '[{"field":"brightness","reason":"Brightness must be a number."}]' })
	@Min(0, { message: '[{"field":"brightness","reason":"Brightness must be at least 0."}]' })
	@Max(100, { message: '[{"field":"brightness","reason":"Brightness must be at most 100."}]' })
	brightness?: number;

	@ApiPropertyOptional({
		name: 'screen_lock_duration',
		description: 'Screen lock duration in seconds (0-3600, 0 = disabled)',
		type: 'integer',
		minimum: 0,
		maximum: 3600,
		example: 30,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsNumber({}, { message: '[{"field":"screen_lock_duration","reason":"Screen lock duration must be a number."}]' })
	@Min(0, { message: '[{"field":"screen_lock_duration","reason":"Screen lock duration must be at least 0."}]' })
	@Max(3600, {
		message: '[{"field":"screen_lock_duration","reason":"Screen lock duration must be at most 3600."}]',
	})
	screen_lock_duration?: number;

	@ApiPropertyOptional({
		name: 'screen_saver',
		description: 'Screen saver enabled state',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsBoolean({ message: '[{"field":"screen_saver","reason":"Screen saver must be a boolean."}]' })
	screen_saver?: boolean;

	@ApiPropertyOptional({
		description: 'Display friendly name',
		type: 'string',
		nullable: true,
		example: 'Living Room Panel',
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"name","reason":"Name must be a string."}]' })
	@ValidateIf((_, value) => value !== null)
	name?: string | null;

	@ApiPropertyOptional({
		description:
			'Display role defining its purpose (room: single room control, master: whole-house overview, entry: house modes and security)',
		type: 'string',
		enum: DisplayRole,
		example: DisplayRole.ROOM,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsEnum(DisplayRole, {
		message: '[{"field":"role","reason":"Role must be one of: room, master, entry."}]',
	})
	role?: DisplayRole;

	// === Room Assignment (only for role=room displays) ===

	@ApiPropertyOptional({
		name: 'room_id',
		description: 'Room this display is assigned to (required for room role, must be null for master/entry roles)',
		type: 'string',
		format: 'uuid',
		nullable: true,
		example: 'f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6',
	})
	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"room_id","reason":"Room ID must be a valid UUID (version 4)."}]' })
	@ValidateIf((_, value) => value !== null)
	room_id?: string | null;

	// === Home Page Configuration ===

	@ApiPropertyOptional({
		name: 'home_mode',
		description:
			'Home page resolution mode (auto_space: use space page if available, explicit: use configured home page, first_page: use first assigned page)',
		type: 'string',
		enum: HomeMode,
		example: HomeMode.AUTO_SPACE,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsEnum(HomeMode, {
		message: '[{"field":"home_mode","reason":"Home mode must be one of: auto_space, explicit, first_page."}]',
	})
	home_mode?: HomeMode;

	@ApiPropertyOptional({
		name: 'home_page_id',
		description: 'Explicitly configured home page ID (used when home_mode is explicit)',
		type: 'string',
		format: 'uuid',
		nullable: true,
		example: 'f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6',
	})
	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"home_page_id","reason":"Home page ID must be a valid UUID (version 4)."}]' })
	@ValidateIf((_, value) => value !== null)
	home_page_id?: string | null;

	// === Audio Settings (only editable if the display supports the feature) ===

	@ApiPropertyOptional({
		description: 'Speaker enabled state (only applicable if display supports audio output)',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsBoolean({ message: '[{"field":"speaker","reason":"Speaker must be a boolean."}]' })
	speaker?: boolean;

	@ApiPropertyOptional({
		name: 'speaker_volume',
		description: 'Speaker volume level (0-100, only applicable if display supports audio output)',
		type: 'integer',
		minimum: 0,
		maximum: 100,
		example: 50,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsNumber({}, { message: '[{"field":"speaker_volume","reason":"Speaker volume must be a number."}]' })
	@Min(0, { message: '[{"field":"speaker_volume","reason":"Speaker volume must be at least 0."}]' })
	@Max(100, { message: '[{"field":"speaker_volume","reason":"Speaker volume must be at most 100."}]' })
	speaker_volume?: number;

	@ApiPropertyOptional({
		description: 'Microphone enabled state (only applicable if display supports audio input)',
		type: 'boolean',
		example: false,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsBoolean({ message: '[{"field":"microphone","reason":"Microphone must be a boolean."}]' })
	microphone?: boolean;

	@ApiPropertyOptional({
		name: 'microphone_volume',
		description: 'Microphone volume level (0-100, only applicable if display supports audio input)',
		type: 'integer',
		minimum: 0,
		maximum: 100,
		example: 50,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsNumber({}, { message: '[{"field":"microphone_volume","reason":"Microphone volume must be a number."}]' })
	@Min(0, { message: '[{"field":"microphone_volume","reason":"Microphone volume must be at least 0."}]' })
	@Max(100, { message: '[{"field":"microphone_volume","reason":"Microphone volume must be at most 100."}]' })
	microphone_volume?: number;

	@ApiPropertyOptional({
		name: 'current_ip_address',
		description: 'Current IP address from which the display is connected via WebSocket',
		type: 'string',
		nullable: true,
		example: '192.168.1.100',
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"current_ip_address","reason":"Current IP address must be a string."}]' })
	@ValidateIf((_, value) => value !== null)
	current_ip_address?: string | null;
}

@ApiSchema({ name: 'DisplaysModuleReqUpdateDisplay' })
export class ReqUpdateDisplayDto {
	@ApiPropertyOptional({
		description: 'Display update data',
		type: () => UpdateDisplayDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => UpdateDisplayDto)
	data: UpdateDisplayDto;
}
