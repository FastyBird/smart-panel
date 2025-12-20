import { Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger';
import { TokenOwnerType } from '../../auth/auth.constants';
import { TokensService } from '../../auth/services/tokens.service';
import { InfluxDbService } from '../../influxdb/services/influxdb.service';
import { DISPLAYS_MODULE_NAME } from '../displays.constants';
import { DisplayEntity } from '../entities/displays.entity';

@Injectable()
export class DisplaysModuleResetService {
	private readonly logger = createExtensionLogger(DISPLAYS_MODULE_NAME, 'DisplaysModuleResetService');

	constructor(
		@InjectRepository(DisplayEntity)
		private readonly displayRepository: Repository<DisplayEntity>,
		private readonly tokensService: TokensService,
		private readonly influxDbService: InfluxDbService,
	) {}

	async reset(): Promise<void> {
		this.logger.debug('Resetting displays module');

		// First revoke all display tokens
		const displays = await this.displayRepository.find();

		for (const display of displays) {
			await this.tokensService.revokeByOwnerId(display.id, TokenOwnerType.DISPLAY);
		}

		// Clear the displays table
		await this.displayRepository.clear();

		// Clear display status data from InfluxDB
		try {
			await this.influxDbService.dropMeasurement('display_status');
			this.logger.debug('Cleared display status data from InfluxDB');
		} catch (error) {
			const err = error as Error;
			this.logger.warn(`Failed to clear display status data from InfluxDB: ${err.message}`, err.stack);
		}

		this.logger.debug('Displays module reset complete');
	}
}
