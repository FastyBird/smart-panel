import { Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger';
import { MasterSpaceEntity } from '../entities/master-space.entity';
import {
	SPACES_SYNTHETIC_MASTER_DEFAULT_NAME,
	SPACES_SYNTHETIC_MASTER_PLUGIN_NAME,
	SPACES_SYNTHETIC_MASTER_SPACE_ID,
} from '../spaces-synthetic-master.constants';

/**
 * Ensures exactly one master space exists per installation.
 *
 * Called from `SpacesSyntheticMasterPlugin.onModuleInit` after the type
 * mapping is registered, and again from `MasterSpaceResetService` after a
 * factory reset wipes the core spaces table.
 *
 * Idempotent: subsequent calls short-circuit when the singleton already exists.
 */
@Injectable()
export class MasterSpaceSeederService {
	private readonly logger = createExtensionLogger(SPACES_SYNTHETIC_MASTER_PLUGIN_NAME, 'MasterSpaceSeederService');

	constructor(
		@InjectRepository(MasterSpaceEntity)
		private readonly repository: Repository<MasterSpaceEntity>,
	) {}

	async seed(): Promise<MasterSpaceEntity> {
		const existing = await this.repository.findOne({ where: {} });

		if (existing) {
			this.logger.debug(`[SEED] Master space already exists (id=${existing.id}), skipping`);

			return existing;
		}

		const space = this.repository.create({
			id: SPACES_SYNTHETIC_MASTER_SPACE_ID,
			name: SPACES_SYNTHETIC_MASTER_DEFAULT_NAME,
			description: null,
			category: null,
			parentId: null,
			icon: null,
			displayOrder: 0,
			suggestionsEnabled: false,
			statusWidgets: null,
			lastActivityAt: null,
		});

		await this.repository.save(space);

		this.logger.log(`[SEED] Created master space (id=${space.id})`);

		return space;
	}
}
