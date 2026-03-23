import { Expose } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Matches } from 'class-validator';

import { ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'SystemModuleReqInstallUpdate' })
export class ReqInstallUpdateDto {
	@ApiPropertyOptional({ description: 'Specific version to install (semver)', type: 'string', example: '1.3.0' })
	@Expose()
	@IsOptional()
	@IsString()
	@Matches(/^\d+\.\d+\.\d+(-[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*)?$/, {
		message: 'version must be a valid semver string (e.g. 1.3.0 or 2.0.0-beta.1)',
	})
	version?: string;

	@ApiPropertyOptional({
		description: 'Whether to allow major version updates',
		type: 'boolean',
		default: false,
	})
	@Expose({ name: 'allow_major' })
	@IsOptional()
	@IsBoolean()
	allowMajor?: boolean;
}
