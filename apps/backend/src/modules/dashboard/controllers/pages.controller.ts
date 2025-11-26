import { validate } from 'class-validator';

import {
	BadRequestException,
	Body,
	Controller,
	Delete,
	Get,
	Header,
	HttpCode,
	Logger,
	NotFoundException,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	UnprocessableEntityException,
} from '@nestjs/common';
import { ApiBody, ApiNoContentResponse, ApiOperation, ApiParam } from '@nestjs/swagger';

import {
	ApiBadRequestResponse,
	ApiCreatedSuccessResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
	ApiUnprocessableEntityResponse,
} from '../../../common/decorators/api-documentation.decorator';
import { ApiTag } from '../../../common/decorators/api-tag.decorator';
import { toInstance } from '../../../common/utils/transform.utils';
import { ValidationExceptionFactory } from '../../../common/validation/validation-exception-factory';
import {
	DASHBOARD_MODULE_API_TAG_DESCRIPTION,
	DASHBOARD_MODULE_API_TAG_NAME,
	DASHBOARD_MODULE_NAME,
	DASHBOARD_MODULE_PREFIX,
} from '../dashboard.constants';
import { DashboardException } from '../dashboard.exceptions';
import { CreatePageDto, ReqCreatePageDto } from '../dto/create-page.dto';
import { ReqUpdatePageDto, UpdatePageDto } from '../dto/update-page.dto';
import { PageEntity } from '../entities/dashboard.entity';
import { PageResponseModel, PagesResponseModel } from '../models/dashboard-response.model';
import { PageTypeMapping, PagesTypeMapperService } from '../services/pages-type-mapper.service';
import { PagesService } from '../services/pages.service';

@ApiTag({
	tagName: DASHBOARD_MODULE_NAME,
	displayName: DASHBOARD_MODULE_API_TAG_NAME,
	description: DASHBOARD_MODULE_API_TAG_DESCRIPTION,
})
@Controller('pages')
export class PagesController {
	private readonly logger = new Logger(PagesController.name);

	constructor(
		private readonly pagesService: PagesService,
		private readonly pagesMapperService: PagesTypeMapperService,
	) {}

	// Pages
	@Get()
	@ApiOperation({ summary: 'Retrieve all pages' })
	@ApiSuccessResponse(PagesResponseModel)
	@ApiInternalServerErrorResponse('Internal server error')
	async findAll(): Promise<PagesResponseModel> {
		this.logger.debug('[LOOKUP ALL] Fetching all pages');

		const pages = await this.pagesService.findAll();

		this.logger.debug(`[LOOKUP ALL] Retrieved ${pages.length} pages`);

		return toInstance(PagesResponseModel, { data: pages });
	}

	@Get(':id')
	@ApiOperation({ summary: 'Retrieve a specific page by ID' })
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Page ID' })
	@ApiSuccessResponse(PageResponseModel)
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Page not found')
	@ApiInternalServerErrorResponse('Internal server error')
	async findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<PageResponseModel> {
		this.logger.debug(`[LOOKUP] Fetching page id=${id}`);

		const page = await this.getOneOrThrow(id);

		this.logger.debug(`[LOOKUP] Found page id=${page.id}`);

		return toInstance(PageResponseModel, { data: page });
	}

	@Post()
	@Header('Location', `:baseUrl/${DASHBOARD_MODULE_PREFIX}/pages/:id`)
	@ApiOperation({ summary: 'Create a new page' })
	@ApiBody({ type: ReqCreatePageDto })
	@ApiCreatedSuccessResponse(PageResponseModel)
	@ApiBadRequestResponse('Invalid request data or unsupported page type')
	@ApiUnprocessableEntityResponse('Page could not be created')
	@ApiInternalServerErrorResponse('Internal server error')
	async create(@Body() createDto: { data: object }): Promise<PageResponseModel> {
		this.logger.debug('[CREATE] Incoming request to create a new page');

		const type: string | undefined =
			'type' in createDto.data && typeof createDto.data.type === 'string' ? createDto.data.type : undefined;

		if (!type) {
			this.logger.error('[VALIDATION] Missing required field: type');

			throw new BadRequestException([JSON.stringify({ field: 'type', reason: 'Page property type is required.' })]);
		}

		const baseDtoInstance = toInstance(CreatePageDto, createDto.data, {
			excludeExtraneousValues: false,
		});

		const baseErrors = await validate(baseDtoInstance, {
			whitelist: true,
			stopAtFirstError: false,
		});

		if (baseErrors.length > 0) {
			this.logger.error(`[VALIDATION FAILED] Validation failed for tile creation error=${JSON.stringify(baseErrors)}`);

			throw ValidationExceptionFactory.createException(baseErrors);
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

		const dtoInstance = toInstance(mapping.createDto, createDto.data, {
			excludeExtraneousValues: false,
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
			const page = await this.pagesService.create(dtoInstance);

			this.logger.debug(`[CREATE] Successfully created page id=${page.id}`);

			return toInstance(PageResponseModel, { data: page });
		} catch (error) {
			if (error instanceof DashboardException) {
				throw new UnprocessableEntityException('Page could not be created. Please try again later');
			}

			throw error;
		}
	}

	@Patch(':id')
	@ApiOperation({ summary: 'Update an existing page' })
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Page ID' })
	@ApiBody({ type: ReqUpdatePageDto })
	@ApiSuccessResponse(PageResponseModel)
	@ApiBadRequestResponse('Invalid UUID format, request data, or unsupported page type')
	@ApiNotFoundResponse('Page not found')
	@ApiUnprocessableEntityResponse('Page could not be updated')
	@ApiInternalServerErrorResponse('Internal server error')
	async update(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() updateDto: { data: object },
	): Promise<PageResponseModel> {
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

		const dtoInstance = toInstance(mapping.updateDto, updateDto.data, {
			excludeExtraneousValues: false,
		});

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
			stopAtFirstError: false,
		});

		if (errors.length > 0) {
			this.logger.error(`[VALIDATION FAILED] Validation failed for page modification error=${JSON.stringify(errors)}`);

			throw ValidationExceptionFactory.createException(errors);
		}

		try {
			const updatedPage = await this.pagesService.update(page.id, dtoInstance);

			this.logger.debug(`[UPDATE] Successfully updated page id=${updatedPage.id}`);

			return toInstance(PageResponseModel, { data: updatedPage });
		} catch (error) {
			if (error instanceof DashboardException) {
				throw new UnprocessableEntityException('Page could not be updated. Please try again later');
			}

			throw error;
		}
	}

	@Delete(':id')
	@HttpCode(204)
	@ApiOperation({ summary: 'Delete a page' })
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Page ID' })
	@ApiNoContentResponse({ description: 'Page deleted successfully' })
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Page not found')
	@ApiInternalServerErrorResponse('Internal server error')
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
