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
	Query,
	UnprocessableEntityException,
} from '@nestjs/common';
import { ApiBody, ApiNoContentResponse, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';

import { toInstance } from '../../../common/utils/transform.utils';
import { ValidationExceptionFactory } from '../../../common/validation/validation-exception-factory';
import {
	ApiBadRequestResponse,
	ApiCreatedSuccessResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
	ApiUnprocessableEntityResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import { DASHBOARD_MODULE_API_TAG_NAME, DASHBOARD_MODULE_PREFIX } from '../dashboard.constants';
import { DashboardException } from '../dashboard.exceptions';
import { CreateDataSourceDto, CreateSingleDataSourceDto, ReqCreateDataSourceDto } from '../dto/create-data-source.dto';
import {
	ReqUpdateDataSourceWithParentDto,
	UpdateDataSourceDto,
	UpdateSingleDataSourceDto,
} from '../dto/update-data-source.dto';
import { DataSourceEntity } from '../entities/dashboard.entity';
import { DataSourceResponseModel, DataSourcesResponseModel } from '../models/dashboard-response.model';
import { DataSourceTypeMapping, DataSourcesTypeMapperService } from '../services/data-source-type-mapper.service';
import { DataSourcesService } from '../services/data-sources.service';

@ApiTags(DASHBOARD_MODULE_API_TAG_NAME)
@Controller('data-source')
export class DataSourceController {
	private readonly logger = new Logger(DataSourceController.name);

	constructor(
		private readonly dataSourceService: DataSourcesService,
		private readonly dataSourcesMapperService: DataSourcesTypeMapperService,
	) {}

	@ApiOperation({
		tags: [DASHBOARD_MODULE_API_TAG_NAME],
		summary: 'Retrieve all data sources',
		description: 'Retrieves all dashboard data sources with optional filtering by parent entity.',
		operationId: 'get-dashboard-module-data-sources',
	})
	@ApiQuery({ name: 'parent_type', type: 'string', required: false, description: 'Filter by parent entity type' })
	@ApiQuery({
		name: 'parent_id',
		type: 'string',
		format: 'uuid',
		required: false,
		description: 'Filter by parent entity ID',
	})
	@ApiSuccessResponse(DataSourcesResponseModel, 'All configured data sources were retrieved successfully.')
	@ApiBadRequestResponse('Invalid request')
	@ApiNotFoundResponse('Data sources not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get()
	async findAll(
		@Query('parent_type') parentType?: string,
		@Query('parent_id') parentId?: string,
	): Promise<DataSourcesResponseModel> {
		this.logger.debug(`[LOOKUP ALL] Fetching all data sources`);

		const dataSources = await this.dataSourceService.findAll(
			parentType && parentId
				? {
						parentType,
						parentId,
					}
				: undefined,
		);

		this.logger.debug(`[LOOKUP ALL] Retrieved ${dataSources.length} data sources`);

		const response = new DataSourcesResponseModel();
		response.data = dataSources;

		return response;
	}

	@ApiOperation({
		tags: [DASHBOARD_MODULE_API_TAG_NAME],
		summary: 'Retrieve a specific data source by ID',
		description: 'Fetches the dashboard data source identified by the provided UUID.',
		operationId: 'get-dashboard-module-data-source',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Data source ID' })
	@ApiSuccessResponse(DataSourceResponseModel, 'The requested data source was retrieved successfully.')
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Data source not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get(':id')
	async findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<DataSourceResponseModel> {
		this.logger.debug(`[LOOKUP] Fetching data source id=${id}`);

		const dataSource = await this.getOneOrThrow(id);

		this.logger.debug(`[LOOKUP] Found data source id=${dataSource.id}`);

		const response = new DataSourceResponseModel();
		response.data = dataSource;

		return response;
	}

	@ApiOperation({
		tags: [DASHBOARD_MODULE_API_TAG_NAME],
		summary: 'Create a new data source',
		description: 'Creates a dashboard data source with the provided configuration.',
		operationId: 'create-dashboard-module-data-source',
	})
	@ApiBody({
		type: ReqCreateDataSourceDto,
		description: 'Payload containing the attributes for the new data source.',
	})
	@ApiCreatedSuccessResponse(DataSourceResponseModel, 'The newly created data source was returned successfully.')
	@ApiBadRequestResponse('Invalid request data or unsupported data source type')
	@ApiNotFoundResponse('Parent entity not found')
	@ApiUnprocessableEntityResponse('Data source could not be created')
	@ApiInternalServerErrorResponse('Internal server error')
	@Header('Location', `:baseUrl/${DASHBOARD_MODULE_PREFIX}/data-source/:id`)
	@Post()
	async create(@Body() createDto: { data: object }): Promise<DataSourceResponseModel> {
		this.logger.debug(`[CREATE] Incoming request to create a new data source`);

		const type: string | undefined =
			'type' in createDto.data && typeof createDto.data.type === 'string' ? createDto.data.type : undefined;

		if (!type) {
			this.logger.error('[VALIDATION] Missing required field: type');

			throw new BadRequestException([
				JSON.stringify({ field: 'type', reason: 'Data source property type is required.' }),
			]);
		}

		const baseDtoInstance = toInstance(CreateSingleDataSourceDto, createDto.data, {
			excludeExtraneousValues: false,
		});

		const baseErrors = await validate(baseDtoInstance, {
			whitelist: true,
			stopAtFirstError: false,
		});

		if (baseErrors.length > 0) {
			this.logger.error(
				`[VALIDATION FAILED] Validation failed for data source creation error=${JSON.stringify(baseErrors)}`,
			);

			throw ValidationExceptionFactory.createException(baseErrors);
		}

		let mapping: DataSourceTypeMapping<DataSourceEntity, CreateDataSourceDto, UpdateDataSourceDto>;

		try {
			mapping = this.dataSourcesMapperService.getMapping<DataSourceEntity, CreateDataSourceDto, UpdateDataSourceDto>(
				type,
			);
		} catch (error) {
			const err = error as Error;

			this.logger.error(`[ERROR] Unsupported data source type: ${type}`, {
				message: err.message,
				stack: err.stack,
			});

			if (error instanceof DashboardException) {
				throw new BadRequestException([
					JSON.stringify({ field: 'type', reason: `Unsupported data source type: ${type}` }),
				]);
			}

			throw error;
		}

		const { parent } = baseDtoInstance;

		const dtoInstance = toInstance(mapping.createDto, createDto.data, {
			excludeExtraneousValues: false,
		});

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
			stopAtFirstError: false,
		});

		if (errors.length > 0) {
			this.logger.error(
				`[VALIDATION FAILED] Validation failed for data source creation error=${JSON.stringify(errors)}`,
			);

			throw ValidationExceptionFactory.createException(errors);
		}

		try {
			const dataSource = await this.dataSourceService.create(dtoInstance, {
				parentType: parent.type,
				parentId: parent.id,
			});

			this.logger.debug(`[CREATE] Successfully created data source id=${dataSource.id}`);

			const response = new DataSourceResponseModel();
			response.data = dataSource;

			return response;
		} catch (error) {
			if (error instanceof DashboardException) {
				throw new UnprocessableEntityException('Data source could not be created. Please try again later');
			}

			throw error;
		}
	}

	@ApiOperation({
		tags: [DASHBOARD_MODULE_API_TAG_NAME],
		summary: 'Update an existing data source',
		description: 'Partially updates attributes of a dashboard data source by UUID.',
		operationId: 'update-dashboard-module-data-source',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Data source ID' })
	@ApiBody({
		type: ReqUpdateDataSourceWithParentDto,
		description: 'Payload containing updated data source attributes.',
	})
	@ApiSuccessResponse(DataSourceResponseModel, 'The updated data source was returned successfully.')
	@ApiBadRequestResponse('Invalid UUID format, request data, or unsupported data source type')
	@ApiNotFoundResponse('Data source not found')
	@ApiUnprocessableEntityResponse('Data source could not be updated')
	@ApiInternalServerErrorResponse('Internal server error')
	@Patch(':id')
	async update(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() updateDto: { data: object },
	): Promise<DataSourceResponseModel> {
		this.logger.debug(`[UPDATE] Incoming update request for data source id=${id}`);

		const dataSource = await this.getOneOrThrow(id);

		const baseDtoInstance = toInstance(UpdateSingleDataSourceDto, updateDto.data, {
			excludeExtraneousValues: false,
		});

		const baseErrors = await validate(baseDtoInstance, {
			whitelist: true,
			stopAtFirstError: false,
		});

		if (baseErrors.length > 0) {
			this.logger.error(
				`[VALIDATION FAILED] Validation failed for data source modification error=${JSON.stringify(baseErrors)}`,
			);

			throw ValidationExceptionFactory.createException(baseErrors);
		}

		let mapping: DataSourceTypeMapping<DataSourceEntity, CreateDataSourceDto, UpdateDataSourceDto>;

		try {
			mapping = this.dataSourcesMapperService.getMapping<DataSourceEntity, CreateDataSourceDto, UpdateDataSourceDto>(
				dataSource.type,
			);
		} catch (error) {
			const err = error as Error;

			this.logger.error(
				`[ERROR] Unsupported data source type for update: ${dataSource.type} error=${err.message}`,
				err.stack,
			);

			if (error instanceof DashboardException) {
				throw new BadRequestException([
					JSON.stringify({ field: 'type', reason: `Unsupported data source type: ${dataSource.type}` }),
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
			this.logger.error(
				`[VALIDATION FAILED] Validation failed for data source modification error=${JSON.stringify(errors)}`,
			);

			throw ValidationExceptionFactory.createException(errors);
		}

		try {
			const updatedDataSource = await this.dataSourceService.update(dataSource.id, dtoInstance);

			this.logger.debug(`[UPDATE] Successfully updated data source id=${updatedDataSource.id}`);

			const response = new DataSourceResponseModel();
			response.data = updatedDataSource;

			return response;
		} catch (error) {
			if (error instanceof DashboardException) {
				throw new UnprocessableEntityException('Data source could not be updated. Please try again later');
			}

			throw error;
		}
	}

	@ApiOperation({
		tags: [DASHBOARD_MODULE_API_TAG_NAME],
		summary: 'Delete a data source',
		description: 'Deletes the dashboard data source identified by the provided UUID.',
		operationId: 'delete-dashboard-module-data-source',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Data source ID' })
	@ApiNoContentResponse({ description: 'Data source deleted successfully' })
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Data source not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@HttpCode(204)
	@Delete(':id')
	async remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<void> {
		this.logger.debug(`[DELETE] Incoming request to delete data source id=${id}`);

		const dataSource = await this.getOneOrThrow(id);

		await this.dataSourceService.remove(dataSource.id);

		this.logger.debug(`[DELETE] Successfully deleted data source id=${id}`);
	}

	private async getOneOrThrow(id: string): Promise<DataSourceEntity> {
		this.logger.debug(`[LOOKUP] Checking existence of data source id=${id}`);

		const dataSource = await this.dataSourceService.findOne(id);

		if (!dataSource) {
			this.logger.error(`[ERROR] Data source with id=${id} not found`);

			throw new NotFoundException('Requested data source does not exist');
		}

		return dataSource;
	}
}
