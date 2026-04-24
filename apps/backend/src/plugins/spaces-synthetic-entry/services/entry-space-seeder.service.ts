import { Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger';
import { EntrySpaceEntity } from '../entities/entry-space.entity';
import {
	SPACES_SYNTHETIC_ENTRY_DEFAULT_NAME,
	SPACES_SYNTHETIC_ENTRY_PLUGIN_NAME,
	SPACES_SYNTHETIC_ENTRY_SPACE_ID,
} from '../spaces-synthetic-entry.constants';

/**
 * Ensures exactly one entry space exists per installation.
 *
 * Called from `SpacesSyntheticEntryPlugin.onModuleInit` after the type
 * mapping is registered, and again from `EntrySpaceResetService` after a
 * factory reset wipes the core spaces table.
 *
 * Idempotent: subsequent calls short-circuit when the singleton already exists.
 */
@Injectable()
export class EntrySpaceSeederService {
	private readonly logger = createExtensionLogger(SPACES_SYNTHETIC_ENTRY_PLUGIN_NAME, 'EntrySpaceSeederService');

	constructor(
		@InjectRepository(EntrySpaceEntity)
		private readonly repository: Repository<EntrySpaceEntity>,
	) {}

	async seed(): Promise<EntrySpaceEntity> {
		const existing = await this.repository.findOne({ where: {} });

		if (existing) {
			this.logger.debug(`[SEED] Entry space already exists (id=${existing.id}), skipping`);

			return existing;
		}

		const space = this.repository.create({
			id: SPACES_SYNTHETIC_ENTRY_SPACE_ID,
			name: SPACES_SYNTHETIC_ENTRY_DEFAULT_NAME,
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

		this.logger.log(`[SEED] Created entry space (id=${space.id})`);

		return space;
	}
}
