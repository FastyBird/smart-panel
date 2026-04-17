import { Expose, Type } from 'class-transformer';
import { IsOptional, IsString, ValidateNested } from 'class-validator';

import { ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'SystemModuleCreateBackup' })
export class CreateBackupDto {
	@ApiPropertyOptional({ description: 'Backup name', type: 'string', example: 'before-update' })
	@Expose()
	@IsOptional()
	@IsString()
	name?: string;
}

@ApiSchema({ name: 'SystemModuleReqCreateBackup' })
export class ReqCreateBackupDto {
	// Must be optional — empty-body POST coerces to `{}` and would otherwise fail validation
	@ApiPropertyOptional({ type: () => CreateBackupDto })
	@Expose()
	@IsOptional()
	@ValidateNested()
	@Type(() => CreateBackupDto)
	data?: CreateBackupDto;
}
