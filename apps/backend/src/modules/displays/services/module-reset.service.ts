import { Repository } from 'typeorm';

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { TokenOwnerType } from '../../auth/auth.constants';
import { TokensService } from '../../auth/services/tokens.service';
import { DisplayEntity } from '../entities/displays.entity';

@Injectable()
export class DisplaysModuleResetService {
	private readonly logger = new Logger(DisplaysModuleResetService.name);

	constructor(
		@InjectRepository(DisplayEntity)
		private readonly displayRepository: Repository<DisplayEntity>,
		private readonly tokensService: TokensService,
	) {}

	async reset(): Promise<void> {
		this.logger.debug('[RESET] Resetting displays module');

		// First revoke all display tokens
		const displays = await this.displayRepository.find();

		for (const display of displays) {
			await this.tokensService.revokeByOwnerId(display.id, TokenOwnerType.DISPLAY);
		}

		// Clear the displays table
		await this.displayRepository.clear();

		this.logger.debug('[RESET] Displays module reset complete');
	}
}
