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
	// Creating a backup without a custom name is the primary flow — the client sends
	// no body at all. The pipe coerces that to {}, so `data` must be optional or
	// validation rejects the request before the controller can default the name.
	@ApiPropertyOptional({ type: () => CreateBackupDto })
	@Expose()
	@IsOptional()
	@ValidateNested()
	@Type(() => CreateBackupDto)
	data?: CreateBackupDto;
}
