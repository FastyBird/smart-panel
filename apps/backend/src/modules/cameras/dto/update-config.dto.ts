import { Expose, Type } from 'class-transformer';
import {
	IsIn,
	IsInt,
	IsObject,
	IsOptional,
	IsString,
	Max,
	Min,
	Validate,
	ValidateIf,
	ValidateNested,
	ValidatorConstraint,
	ValidatorConstraintInterface,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdateModuleConfigDto } from '../../config/dto/config.dto';
import { isValidGo2rtcBinaryPath, isValidGo2rtcExternalUrl } from '../cameras.config.utils';
import { CAMERAS_MODULE_NAME, GO2RTC_MODES, Go2rtcMode } from '../cameras.constants';

@ValidatorConstraint({ name: 'isGo2rtcBinaryPath', async: false })
export class IsGo2rtcBinaryPathConstraint implements ValidatorConstraintInterface {
	validate(value: unknown): boolean {
		return isValidGo2rtcBinaryPath(value);
	}
}

@ValidatorConstraint({ name: 'isGo2rtcExternalUrl', async: false })
export class IsGo2rtcExternalUrlConstraint implements ValidatorConstraintInterface {
	validate(value: unknown): boolean {
		return isValidGo2rtcExternalUrl(value);
	}
}

@ApiSchema({ name: 'CamerasModuleUpdateConfigGo2rtc' })
export class UpdateCamerasGo2rtcConfigDto {
	@ApiPropertyOptional({
		description: 'How the go2rtc relay is provided: run by the panel, an external instance, or off',
		enum: GO2RTC_MODES,
		example: 'managed',
	})
	@Expose()
	@ValidateIf((o: UpdateCamerasGo2rtcConfigDto) => o.mode !== undefined)
	@IsIn(GO2RTC_MODES, {
		message: '[{"field":"mode","reason":"Mode must be one of managed, external or disabled."}]',
	})
	mode?: Go2rtcMode;

	@ApiPropertyOptional({
		name: 'binary_path',
		description: 'Absolute path of the go2rtc binary used in managed mode',
		type: 'string',
		example: '/usr/local/lib/smart-panel/go2rtc/go2rtc',
	})
	@Expose({ name: 'binary_path' })
	@ValidateIf((o: UpdateCamerasGo2rtcConfigDto) => o.binaryPath !== undefined)
	@Validate(IsGo2rtcBinaryPathConstraint, {
		message:
			'[{"field":"binary_path","reason":"Binary path must be an absolute path whose file name starts with go2rtc."}]',
	})
	binaryPath?: string;

	@ApiPropertyOptional({
		name: 'external_url',
		description: 'Base URL of an external go2rtc instance used in external mode',
		type: 'string',
		nullable: true,
		example: 'http://192.168.1.5:1984',
	})
	@Expose({ name: 'external_url' })
	@IsOptional()
	@ValidateIf((o: UpdateCamerasGo2rtcConfigDto) => o.externalUrl !== null)
	@Validate(IsGo2rtcExternalUrlConstraint, {
		message:
			'[{"field":"external_url","reason":"External URL must be an http or https URL without credentials, query or fragment."}]',
	})
	externalUrl?: string | null;
}

@ApiSchema({ name: 'CamerasModuleUpdateConfig' })
export class UpdateCamerasConfigDto extends UpdateModuleConfigDto {
	@ApiProperty({
		description: 'Module identifier',
		type: 'string',
		example: 'cameras-module',
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: string = CAMERAS_MODULE_NAME;

	@ApiPropertyOptional({
		description: 'go2rtc live relay configuration',
		type: () => UpdateCamerasGo2rtcConfigDto,
	})
	@Expose()
	@ValidateIf((o: UpdateCamerasConfigDto) => o.go2rtc !== undefined)
	@IsObject({ message: '[{"field":"go2rtc","reason":"go2rtc must be an object."}]' })
	@ValidateNested()
	@Type(() => UpdateCamerasGo2rtcConfigDto)
	go2rtc?: UpdateCamerasGo2rtcConfigDto;

	@ApiPropertyOptional({
		name: 'max_sessions',
		description: 'Maximum number of concurrent live sessions',
		type: 'integer',
		minimum: 1,
		maximum: 32,
		example: 8,
	})
	@Expose({ name: 'max_sessions' })
	@ValidateIf((o: UpdateCamerasConfigDto) => o.maxSessions !== undefined)
	@IsInt({ message: '[{"field":"max_sessions","reason":"Max sessions must be a whole number."}]' })
	@Min(1, { message: '[{"field":"max_sessions","reason":"Max sessions must be at least 1."}]' })
	@Max(32, { message: '[{"field":"max_sessions","reason":"Max sessions must be at most 32."}]' })
	maxSessions?: number;

	@ApiPropertyOptional({
		name: 'max_sessions_per_camera',
		description: 'Maximum number of concurrent live sessions per camera',
		type: 'integer',
		minimum: 1,
		maximum: 16,
		example: 4,
	})
	@Expose({ name: 'max_sessions_per_camera' })
	@ValidateIf((o: UpdateCamerasConfigDto) => o.maxSessionsPerCamera !== undefined)
	@IsInt({
		message: '[{"field":"max_sessions_per_camera","reason":"Max sessions per camera must be a whole number."}]',
	})
	@Min(1, { message: '[{"field":"max_sessions_per_camera","reason":"Max sessions per camera must be at least 1."}]' })
	@Max(16, { message: '[{"field":"max_sessions_per_camera","reason":"Max sessions per camera must be at most 16."}]' })
	maxSessionsPerCamera?: number;
}
