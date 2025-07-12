import { Repository } from 'typeorm';

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { EventType } from '../dashboard.constants';
import { DataSourceEntity, PageEntity, TileEntity } from '../entities/dashboard.entity';

@Injectable()
export class ModuleResetService {
	private readonly logger = new Logger(ModuleResetService.name);

	constructor(
		@InjectRepository(PageEntity)
		private readonly pagesRepository: Repository<PageEntity>,
		@InjectRepository(TileEntity)
		private readonly tilesRepository: Repository<TileEntity>,
		@InjectRepository(DataSourceEntity)
		private readonly dataSourcesRepository: Repository<DataSourceEntity>,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async reset(): Promise<{ success: boolean; reason?: string }> {
		try {
			this.logger.debug(`[RESET] Resetting all module data`);

			await this.dataSourcesRepository.delete({});

			this.eventEmitter.emit(EventType.DATA_SOURCE_RESET, null);

			await this.tilesRepository.delete({});

			this.eventEmitter.emit(EventType.TILE_RESET, null);

			await this.pagesRepository.delete({});

			this.eventEmitter.emit(EventType.PAGE_RESET, null);

			this.logger.log('[RESET] Module data were successfully reset');

			this.eventEmitter.emit(EventType.MODULE_RESET, null);

			return { success: true };
		} catch (error) {
			const err = error as Error;

			this.logger.error('[RESET] Failed to reset module data', { message: err.message, stack: err.stack });

			return { success: false, reason: error instanceof Error ? error.message : 'Unknown error' };
		}
	}
}
