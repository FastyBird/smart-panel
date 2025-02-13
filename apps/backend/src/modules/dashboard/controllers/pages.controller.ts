import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import {
	BadRequestException,
	Body,
	Controller,
	Delete,
	Get,
	Header,
	Logger,
	NotFoundException,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	UnprocessableEntityException,
} from '@nestjs/common';

import { ValidationExceptionFactory } from '../../../common/validation/validation-exception-factory';
import { DashboardModulePrefix } from '../dashboard.constants';
import { DashboardException } from '../dashboard.exceptions';
import { CreatePageDto, ReqCreatePageDto } from '../dto/create-page.dto';
import { ReqUpdatePageDto, UpdatePageDto } from '../dto/update-page.dto';
import { PageEntity } from '../entities/dashboard.entity';
import { PageTypeMapping, PagesTypeMapperService } from '../services/pages-type-mapper.service';
import { PagesService } from '../services/pages.service';

@Controller('pages')
export class PagesController {
	private readonly logger = new Logger(PagesController.name);

	constructor(
		private readonly pagesService: PagesService,
		private readonly pagesMapperService: PagesTypeMapperService,
	) {}

	// Pages
	@Get()
	async findAll(): Promise<PageEntity[]> {
		this.logger.debug('[LOOKUP ALL] Fetching all pages');

		const pages = await this.pagesService.findAll();

		this.logger.debug(`[LOOKUP ALL] Retrieved ${pages.length} pages`);

		return pages;
	}

	@Get(':id')
	async findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<PageEntity> {
		this.logger.debug(`[LOOKUP] Fetching page id=${id}`);

		const page = await this.getOneOrThrow(id);

		this.logger.debug(`[LOOKUP] Found page id=${page.id}`);

		return page;
	}

	@Post()
	@Header('Location', `:baseUrl/${DashboardModulePrefix}/pages/:id`)
	async create(@Body() createDto: ReqCreatePageDto): Promise<PageEntity> {
		this.logger.debug('[CREATE] Incoming request to create a new page');

		const type: string | undefined = createDto.data.type;

		if (!type) {
			this.logger.error('[VALIDATION] Missing required field: type');

			throw new BadRequestException([JSON.stringify({ field: 'type', reason: 'Page property type is required.' })]);
		}

		let mapping: PageTypeMapping<PageEntity, CreatePageDto, UpdatePageDto>;

		try {
			mapping = this.pagesMapperService.getMapping<PageEntity, CreatePageDto, UpdatePageDto>(type);
		} catch (error) {
			const err = error as Error;

			this.logger.error(`[ERROR] Unsupported page type: ${type}`, { message: err.message, stack: err.stack });

			if (error instanceof DashboardException) {
				throw new BadRequestException([JSON.stringify({ field: 'type', reason: `Unsupported page type: ${type}` })]);
			}

			throw error;
		}

		const dtoInstance = plainToInstance(mapping.createDto, createDto.data, {
			enableImplicitConversion: true,
			exposeUnsetFields: false,
		});

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
			stopAtFirstError: false,
		});

		if (errors.length > 0) {
			this.logger.error(`[VALIDATION FAILED] Validation failed for page creation error=${JSON.stringify(errors)}`);

			throw ValidationExceptionFactory.createException(errors);
		}

		try {
			const page = await this.pagesService.create(createDto.data);

			this.logger.debug(`[CREATE] Successfully created page id=${page.id}`);

			return page;
		} catch (error) {
			if (error instanceof DashboardException) {
				throw new UnprocessableEntityException('Page could not be created. Please try again later');
			}

			throw error;
		}
	}

	@Patch(':id')
	async update(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() updateDto: ReqUpdatePageDto,
	): Promise<PageEntity> {
		this.logger.debug(`[UPDATE] Incoming update request for page id=${id}`);

		const page = await this.getOneOrThrow(id);

		let mapping: PageTypeMapping<PageEntity, CreatePageDto, UpdatePageDto>;

		try {
			mapping = this.pagesMapperService.getMapping<PageEntity, CreatePageDto, UpdatePageDto>(page.type);
		} catch (error) {
			const err = error as Error;

			this.logger.error(`[ERROR] Unsupported page type for update: ${page.type}`, {
				message: err.message,
				stack: err.stack,
			});

			if (error instanceof DashboardException) {
				throw new BadRequestException([
					JSON.stringify({ field: 'type', reason: `Unsupported page type: ${page.type}` }),
				]);
			}

			throw error;
		}

		const dtoInstance = plainToInstance(mapping.updateDto, updateDto.data, {
			enableImplicitConversion: true,
			exposeUnsetFields: false,
		});

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});

		if (errors.length > 0) {
			this.logger.error(`[VALIDATION FAILED] Validation failed for page modification error=${JSON.stringify(errors)}`);

			throw ValidationExceptionFactory.createException(errors);
		}

		try {
			const updatedPage = await this.pagesService.update(page.id, updateDto.data);

			this.logger.debug(`[UPDATE] Successfully updated page id=${updatedPage.id}`);

			return updatedPage;
		} catch (error) {
			if (error instanceof DashboardException) {
				throw new UnprocessableEntityException('Page could not be updated. Please try again later');
			}

			throw error;
		}
	}

	@Delete(':id')
	async remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<void> {
		this.logger.debug(`[DELETE] Incoming request to delete page id=${id}`);

		const page = await this.getOneOrThrow(id);

		await this.pagesService.remove(page.id);

		this.logger.debug(`[DELETE] Successfully deleted page id=${id}`);
	}

	private async getOneOrThrow(id: string): Promise<PageEntity> {
		this.logger.debug(`[LOOKUP] Checking existence of page id=${id}`);

		const page = await this.pagesService.findOne(id);

		if (!page) {
			this.logger.error(`[ERROR] Page with id=${id} not found`);

			throw new NotFoundException('Requested page does not exist');
		}

		return page;
	}
}
