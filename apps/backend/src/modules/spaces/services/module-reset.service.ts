import { Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { SpaceEntity } from '../entities/space.entity';
import { SPACES_MODULE_NAME } from '../spaces.constants';

@Injectable()
export class SpacesModuleResetService {
	private readonly logger = createExtensionLogger(SPACES_MODULE_NAME, 'SpacesModuleResetService');

	constructor(
		@InjectRepository(SpaceEntity)
		private readonly spacesRepository: Repository<SpaceEntity>,
	) {}

	async reset(): Promise<{ success: boolean; reason?: string }> {
		this.logger.log('[RESET] Starting spaces module factory reset');

		try {
			// Child entities (roles, bindings, activities) cascade-delete from SpaceEntity
			await this.spacesRepository.clear();

			this.logger.log('[RESET] Spaces module factory reset completed successfully');

			return { success: true };
		} catch (error) {
			const err = error as Error;

			this.logger.error(`[RESET] Spaces module factory reset failed: ${err.message}`);

			return { success: false, reason: err.message };
		}
	}
}
