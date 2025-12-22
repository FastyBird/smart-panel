import inquirer from 'inquirer';
import { validate as uuidValidate } from 'uuid';

import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { toInstance } from '../../../common/utils/transform.utils';
import { SeedTools, Seeder } from '../../seed/services/seed.service';
import { DASHBOARD_MODULE_NAME } from '../dashboard.constants';
import { CreateDataSourceDto } from '../dto/create-data-source.dto';
import { CreatePageDto } from '../dto/create-page.dto';
import { CreateTileDto } from '../dto/create-tile.dto';
import { DataSourceEntity, PageEntity, TileEntity } from '../entities/dashboard.entity';

import { DataSourcesTypeMapperService } from './data-source-type-mapper.service';
import { DataSourcesService } from './data-sources.service';
import { PagesTypeMapperService } from './pages-type-mapper.service';
import { PagesService } from './pages.service';
import { TilesTypeMapperService } from './tiles-type-mapper.service';
import { TilesService } from './tiles.service';

// Default seed file names
const DEFAULT_PAGES_FILE = 'pages.json';
const DEFAULT_TILES_FILE = 'tiles.json';
const DEFAULT_TILES_DATA_SOURCE_FILE = 'tiles_data_source.json';

@Injectable()
export class DashboardSeederService implements Seeder {
	private readonly logger = createExtensionLogger(DASHBOARD_MODULE_NAME, 'DashboardSeederService');

	constructor(
		private readonly pagesService: PagesService,
		private readonly tilesService: TilesService,
		private readonly dataSourceService: DataSourcesService,
		private readonly pagesMapperService: PagesTypeMapperService,
		private readonly tilesMapperService: TilesTypeMapperService,
		private readonly dataSourcesMapperService: DataSourcesTypeMapperService,
		private readonly seedTools: SeedTools,
	) {}

	async seed(): Promise<void> {
		const { seed } = await inquirer.prompt<{ seed: boolean }>([
			{
				type: 'confirm',
				name: 'seed',
				message: 'Would you like to seed the database with demo data for the Dashboard module?',
				default: true,
			},
		]);

		if (!seed) {
			this.logger.log('[SEED] Skipping Dashboard module.');

			return;
		}

		this.logger.log('[SEED] Seeding dashboard module...');

		const pages = this.seedTools.loadJsonData(DEFAULT_PAGES_FILE);
		const tiles = this.seedTools.loadJsonData(DEFAULT_TILES_FILE);
		const dataSources = this.seedTools.loadJsonData(DEFAULT_TILES_DATA_SOURCE_FILE);

		await this.seedPages(pages);
		await this.seedTiles(tiles);
		await this.seedDataSources(dataSources);

		this.logger.log(`[SEED] Successfully seeded ${pages.length} pages.`);
	}

	private async seedPages(pages: Record<string, any>[]): Promise<void> {
		for (const item of pages) {
			if (!('type' in item) || typeof item.type !== 'string') {
				this.logger.error(`[SEED] Page definition is missing type definition`);

				continue;
			}

			let mapping: {
				type: string;
				class: new (...args: any[]) => PageEntity;
				createDto: new (...args: any[]) => CreatePageDto;
			};

			try {
				mapping = this.pagesMapperService.getMapping(item.type);
			} catch {
				this.logger.error(`[SEED] Unknown Page type: ${item.type}`);

				continue;
			}

			const dtoInstance = toInstance(mapping.createDto, item);

			try {
				await this.pagesService.create(dtoInstance);
			} catch (error) {
				const err = error as Error;

				this.logger.error(`[SEED] Failed to create page: ${JSON.stringify(item)}`, {
					message: err.message,
					stack: err.stack,
				});
			}
		}
	}

	private async seedTiles(tiles: Record<string, any>[]): Promise<void> {
		for (const item of tiles) {
			if (!('type' in item) || typeof item.type !== 'string') {
				this.logger.error(`[SEED] Tile definition is missing type definition`);

				continue;
			}

			const pageId: string | undefined = 'page' in item ? (item.page as string) : undefined;

			if (!uuidValidate(pageId)) {
				this.logger.error(`[SEED] Tile relation page is not a valid UUIDv4`);

				continue;
			}

			const page = await this.pagesService.findOne(pageId);

			if (!page) {
				this.logger.error(`[SEED] Tile relation page is not present in database`);

				continue;
			}

			let mapping: {
				type: string;
				class: new (...args: any[]) => TileEntity;
				createDto: new (...args: any[]) => CreateTileDto;
			};

			try {
				mapping = this.tilesMapperService.getMapping(item.type);
			} catch {
				this.logger.error(`[SEED] Unknown Tile type: ${item.type}`);

				continue;
			}

			const dtoInstance = toInstance(mapping.createDto, item);

			try {
				await this.tilesService.create(dtoInstance, { parentType: 'page', parentId: page.id });
			} catch (error) {
				const err = error as Error;

				this.logger.error(`[SEED] Failed to create tile: ${JSON.stringify(item)}`, {
					message: err.message,
					stack: err.stack,
				});
			}
		}
	}

	private async seedDataSources(dataSources: Record<string, any>[]): Promise<void> {
		for (const item of dataSources) {
			if (!('type' in item) || typeof item.type !== 'string') {
				this.logger.error(`[SEED] Data source definition is missing type definition`);

				continue;
			}

			const tileId: string | undefined = 'tile' in item ? (item.tile as string) : undefined;

			if (!uuidValidate(tileId)) {
				this.logger.error(`[SEED] Data source relation tile is not a valid UUIDv4`);

				continue;
			}

			const tile = await this.tilesService.findOne(tileId);

			if (!tile) {
				this.logger.error(`[SEED] Data source relation tile is not present in database`);

				continue;
			}

			let mapping: {
				type: string;
				class: new (...args: any[]) => DataSourceEntity;
				createDto: new (...args: any[]) => CreateDataSourceDto;
			};

			try {
				mapping = this.dataSourcesMapperService.getMapping(item.type);
			} catch {
				this.logger.error(`[SEED] Unknown data source type: ${item.type}`);

				continue;
			}

			const dtoInstance = toInstance(mapping.createDto, item);

			try {
				await this.dataSourceService.create(dtoInstance, { parentType: 'tile', parentId: tile.id });
			} catch (error) {
				const err = error as Error;

				this.logger.error(`[SEED] Failed to create data source: ${JSON.stringify(item)}`, {
					message: err.message,
					stack: err.stack,
				});
			}
		}
	}
}
