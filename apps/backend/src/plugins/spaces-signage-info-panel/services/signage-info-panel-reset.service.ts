import { DataSource, Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { SpacesTypeMapperService } from '../../../modules/spaces/services/spaces-type-mapper.service';
import { SpaceType } from '../../../modules/spaces/spaces.constants';
import { CreateSignageInfoPanelSpaceDto } from '../dto/create-signage-info-panel-space.dto';
import { UpdateSignageInfoPanelSpaceDto } from '../dto/update-signage-info-panel-space.dto';
import { SignageAnnouncementEntity } from '../entities/signage-announcement.entity';
import { SignageInfoPanelSpaceEntity } from '../entities/signage-info-panel-space.entity';
import { SPACES_SIGNAGE_INFO_PANEL_PLUGIN_NAME } from '../spaces-signage-info-panel.constants';

/**
 * Factory-reset handler for the signage info-panel plugin.
 *
 * Removes plugin-owned data (announcements + signage-space rows) while
 * leaving physical room/zone spaces and synthetic singletons untouched.
 * Core `SpacesModule`'s reset (priority 280) clears every space row;
 * this plugin registers at a LOWER priority (290) so it runs before the
 * core clear and performs subtype-scoped deletes, which keeps the log
 * output informative even when the core reset would subsume the same
 * rows.
 */
@Injectable()
export class SignageInfoPanelResetService {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		SPACES_SIGNAGE_INFO_PANEL_PLUGIN_NAME,
		'SignageInfoPanelResetService',
	);

	constructor(
		@InjectRepository(SignageAnnouncementEntity)
		private readonly announcementsRepository: Repository<SignageAnnouncementEntity>,
		private readonly spacesTypeMapper: SpacesTypeMapperService,
		private readonly dataSource: DataSource,
	) {}

	async reset(): Promise<{ success: boolean; reason?: string }> {
		try {
			const announcementsDeleted = await this.announcementsRepository
				.createQueryBuilder()
				.delete()
				.from(SignageAnnouncementEntity)
				.execute();

			const mapping = this.spacesTypeMapper.getMapping<
				SignageInfoPanelSpaceEntity,
				CreateSignageInfoPanelSpaceDto,
				UpdateSignageInfoPanelSpaceDto
			>(SpaceType.SIGNAGE_INFO_PANEL);
			const subtypeRepo = this.dataSource.getRepository(mapping.class);
			const spacesDeleted = await subtypeRepo.createQueryBuilder().delete().execute();

			this.logger.log(
				`[RESET] Removed ${announcementsDeleted.affected ?? 0} announcements and ${spacesDeleted.affected ?? 0} signage spaces`,
			);

			return { success: true };
		} catch (error) {
			const err = error as Error;

			this.logger.error(`[RESET] Failed to reset plugin data: ${err.message}`, err.stack);

			return { success: false, reason: err.message };
		}
	}
}
