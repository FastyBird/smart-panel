import { Expose } from 'class-transformer';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

/**
 * Update info data model
 */
@ApiSchema({ name: 'SystemModuleDataUpdateInfo' })
export class UpdateInfoModel {
	@ApiProperty({ description: 'Current installed version', type: 'string', example: '1.2.0' })
	@Expose({ name: 'current_version' })
	currentVersion: string;

	@ApiProperty({ description: 'Latest available version', type: 'string', nullable: true, example: '1.3.0' })
	@Expose({ name: 'latest_version' })
	latestVersion: string | null;

	@ApiProperty({ description: 'Whether an update is available', type: 'boolean', example: true })
	@Expose({ name: 'update_available' })
	updateAvailable: boolean;

	@ApiProperty({
		description: 'Type of update',
		enum: ['patch', 'minor', 'major'],
		nullable: true,
		example: 'minor',
	})
	@Expose({ name: 'update_type' })
	updateType: 'patch' | 'minor' | 'major' | null;

	@ApiProperty({ description: 'When the update was last checked', type: 'string', format: 'date-time', nullable: true })
	@Expose({ name: 'last_checked' })
	lastChecked: string | null;

	@ApiPropertyOptional({ description: 'URL to changelog/release notes', type: 'string', nullable: true })
	@Expose({ name: 'changelog_url' })
	changelogUrl: string | null;

	@ApiProperty({
		description: 'Current update process status',
		enum: ['idle', 'checking', 'downloading', 'stopping', 'installing', 'migrating', 'starting', 'complete', 'failed'],
		example: 'idle',
	})
	@Expose()
	status: string;

	@ApiPropertyOptional({ description: 'Current phase description', type: 'string', nullable: true })
	@Expose()
	phase: string | null;

	@ApiPropertyOptional({ description: 'Progress percentage (0-100)', type: 'number', nullable: true })
	@Expose({ name: 'progress_percent' })
	progressPercent: number | null;

	@ApiPropertyOptional({ description: 'Error message if status is failed', type: 'string', nullable: true })
	@Expose()
	error: string | null;
}

/**
 * Update status data model
 */
@ApiSchema({ name: 'SystemModuleDataUpdateStatus' })
export class UpdateStatusModel {
	@ApiProperty({
		description: 'Current update status',
		enum: ['idle', 'checking', 'downloading', 'stopping', 'installing', 'migrating', 'starting', 'complete', 'failed'],
		example: 'idle',
	})
	@Expose()
	status: string;

	@ApiProperty({ description: 'Current phase description', type: 'string', nullable: true })
	@Expose()
	phase: string | null;

	@ApiProperty({ description: 'Progress percentage (0-100)', type: 'number', nullable: true })
	@Expose({ name: 'progress_percent' })
	progressPercent: number | null;

	@ApiProperty({ description: 'Status message', type: 'string', nullable: true })
	@Expose()
	message: string | null;

	@ApiProperty({ description: 'Error message if status is failed', type: 'string', nullable: true })
	@Expose()
	error: string | null;
}
