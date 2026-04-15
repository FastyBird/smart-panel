import { Expose } from 'class-transformer';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

/**
 * Backup contribution data model
 */
@ApiSchema({ name: 'SystemModuleDataBackupContribution' })
export class BackupContributionModel {
	@ApiProperty({
		description: 'Source module or plugin that contributed this item',
		type: 'string',
		example: 'system-module',
	})
	@Expose()
	source: string;

	@ApiProperty({
		description: 'Human-readable label for the contribution',
		type: 'string',
		example: 'Environment configuration',
	})
	@Expose()
	label: string;

	@ApiProperty({ description: 'Type of the contributed item', enum: ['file', 'directory'], example: 'file' })
	@Expose()
	type: string;

	@ApiProperty({ description: 'Original file system path', type: 'string', example: '/var/lib/smart-panel/.env' })
	@Expose()
	path: string;
}

/**
 * Backup data model
 */
@ApiSchema({ name: 'SystemModuleDataBackup' })
export class BackupDataModel {
	@ApiProperty({
		description: 'Unique backup identifier',
		type: 'string',
		format: 'uuid',
		example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
	})
	@Expose()
	id: string;

	@ApiProperty({ description: 'Backup name', type: 'string', example: 'before-update' })
	@Expose()
	name: string;

	@ApiProperty({ description: 'Application version at the time of backup', type: 'string', example: '1.2.0' })
	@Expose()
	version: string;

	@ApiProperty({ description: 'Timestamp when the backup was created', type: 'string', format: 'date-time' })
	@Expose({ name: 'created_at' })
	createdAt: string;

	@ApiProperty({ description: 'Size of the backup archive in bytes', type: 'number', example: 1048576 })
	@Expose({ name: 'size_bytes' })
	sizeBytes: number;

	@ApiProperty({
		description: 'List of contributions included in the backup',
		type: [BackupContributionModel],
	})
	@Expose()
	contributions: BackupContributionModel[];
}
