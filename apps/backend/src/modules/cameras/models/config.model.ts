import { Expose, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { ModuleConfigModel } from '../../config/models/config.model';
import {
	CAMERAS_DEFAULT_MAX_SESSIONS,
	CAMERAS_DEFAULT_MAX_SESSIONS_PER_CAMERA,
	CAMERAS_MODULE_NAME,
	GO2RTC_DEFAULT_BINARY_PATH,
	GO2RTC_MODES,
	Go2rtcMode,
} from '../cameras.constants';

@ApiSchema({ name: 'CamerasModuleDataGo2rtcConfig' })
export class CamerasGo2rtcConfigModel {
	@ApiProperty({
		description: 'How the go2rtc relay is provided: run by the panel, an external instance, or off',
		enum: GO2RTC_MODES,
		example: 'managed',
	})
	@Expose()
	@IsIn(GO2RTC_MODES)
	mode: Go2rtcMode = 'managed';

	@ApiProperty({
		name: 'binary_path',
		description: 'Absolute path of the go2rtc binary used in managed mode',
		type: 'string',
		example: GO2RTC_DEFAULT_BINARY_PATH,
	})
	@Expose({ name: 'binary_path' })
	@IsString()
	binaryPath: string = GO2RTC_DEFAULT_BINARY_PATH;

	@ApiProperty({
		name: 'external_url',
		description: 'Base URL of an external go2rtc instance used in external mode',
		type: 'string',
		nullable: true,
		example: 'http://192.168.1.5:1984',
	})
	@Expose({ name: 'external_url' })
	@IsOptional()
	@IsString()
	externalUrl: string | null = null;
}

@ApiSchema({ name: 'CamerasModuleDataConfig' })
export class CamerasConfigModel extends ModuleConfigModel {
	@ApiProperty({
		description: 'Module identifier',
		type: 'string',
		example: 'cameras-module',
	})
	@Expose()
	@IsString()
	type: string = CAMERAS_MODULE_NAME;

	@ApiProperty({
		description: 'Module enabled state',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsBoolean()
	override enabled: boolean = true;

	@ApiProperty({
		description: 'go2rtc live relay configuration',
		type: () => CamerasGo2rtcConfigModel,
	})
	@Expose()
	@ValidateNested()
	@Type(() => CamerasGo2rtcConfigModel)
	go2rtc: CamerasGo2rtcConfigModel = new CamerasGo2rtcConfigModel();

	@ApiProperty({
		name: 'max_sessions',
		description: 'Maximum number of concurrent live sessions',
		type: 'integer',
		minimum: 1,
		maximum: 32,
		example: CAMERAS_DEFAULT_MAX_SESSIONS,
	})
	@Expose({ name: 'max_sessions' })
	@IsInt()
	@Min(1)
	@Max(32)
	maxSessions: number = CAMERAS_DEFAULT_MAX_SESSIONS;

	@ApiProperty({
		name: 'max_sessions_per_camera',
		description: 'Maximum number of concurrent live sessions per camera',
		type: 'integer',
		minimum: 1,
		maximum: 16,
		example: CAMERAS_DEFAULT_MAX_SESSIONS_PER_CAMERA,
	})
	@Expose({ name: 'max_sessions_per_camera' })
	@IsInt()
	@Min(1)
	@Max(16)
	maxSessionsPerCamera: number = CAMERAS_DEFAULT_MAX_SESSIONS_PER_CAMERA;
}
