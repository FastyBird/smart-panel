import { Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { ENERGY_MODULE_NAME } from '../energy.constants';
import { EnergyDeltaEntity } from '../entities/energy-delta.entity';

@Injectable()
export class EnergyModuleResetService {
	private readonly logger = createExtensionLogger(ENERGY_MODULE_NAME, 'EnergyModuleResetService');

	constructor(
		@InjectRepository(EnergyDeltaEntity)
		private readonly deltasRepository: Repository<EnergyDeltaEntity>,
	) {}

	async reset(): Promise<{ success: boolean; reason?: string }> {
		this.logger.log('[RESET] Starting energy module factory reset');

		try {
			await this.deltasRepository.clear();

			this.logger.log('[RESET] Energy module factory reset completed successfully');

			return { success: true };
		} catch (error) {
			const err = error as Error;

			this.logger.error(`[RESET] Energy module factory reset failed: ${err.message}`);

			return { success: false, reason: err.message };
		}
	}
}
