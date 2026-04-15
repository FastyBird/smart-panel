import { Expose, Type } from 'class-transformer';
import { IsOptional, IsString, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

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
	@ApiProperty({ type: () => CreateBackupDto })
	@Expose()
	@ValidateNested()
	@Type(() => CreateBackupDto)
	data: CreateBackupDto;
}
