import { FastifyRequest as Request, FastifyReply as Response } from 'fastify';

import {
	Body,
	ConflictException,
	Controller,
	Delete,
	Get,
	HttpCode,
	NotFoundException,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	Req,
	Res,
	UnprocessableEntityException,
} from '@nestjs/common';
import { ApiBody, ApiNoContentResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { createExtensionLogger } from '../../../common/logger';
import { setLocationHeader } from '../../api/utils/location-header.utils';
import {
	ApiBadRequestResponse,
	ApiConflictResponse,
	ApiCreatedSuccessResponse,
	ApiForbiddenResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
	ApiUnprocessableEntityResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import { Roles } from '../../users/guards/roles.guard';
import { UserRole } from '../../users/users.constants';
import {
	AUTOMATIONS_MODULE_API_TAG_NAME,
	AUTOMATIONS_MODULE_NAME,
	AUTOMATIONS_MODULE_PREFIX,
	AUTOMATION_GRAPH_INVALID_ERROR_CODE,
} from '../automations.constants';
import {
	AutomationsException,
	AutomationsGraphValidationException,
	AutomationsNotFoundException,
	AutomationsRevisionConflictException,
} from '../automations.exceptions';
import { ReqCreateAutomationDto } from '../dto/create-automation.dto';
import { ReqUpdateAutomationDto } from '../dto/update-automation.dto';
import { ReqValidateAutomationGraphDto } from '../dto/validate-graph.dto';
import { AutomationEntity } from '../entities/automations.entity';
import {
	AutomationGraphValidationResponseModel,
	AutomationResponseModel,
	AutomationsResponseModel,
} from '../models/automations-response.model';
import { createAutomationGraphValidationModel } from '../models/graph-validation.model';
import { AutomationsService } from '../services/automations.service';

@ApiTags(AUTOMATIONS_MODULE_API_TAG_NAME)
@Controller('automations')
@Roles(UserRole.OWNER, UserRole.ADMIN)
export class AutomationsController {
	private readonly logger = createExtensionLogger(AUTOMATIONS_MODULE_NAME, 'AutomationsController');

	constructor(private readonly automationsService: AutomationsService) {}

	@ApiOperation({
		tags: [AUTOMATIONS_MODULE_API_TAG_NAME],
		summary: 'Retrieve a list of automations',
		description:
			'Fetches all automations. The list is lightweight: each automation carries its metadata (name, enabled state, mode, revision, status, last run) but not its graph. Read a single automation to get the graph. Requires the owner or admin role.',
		operationId: 'get-automations-module-automations',
	})
	@ApiSuccessResponse(
		AutomationsResponseModel,
		'A list of automations successfully retrieved. The graph of each automation is left out.',
	)
	@ApiForbiddenResponse('Only owners and admins can read automations')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get()
	async findAll(): Promise<AutomationsResponseModel> {
		this.logger.debug('[LOOKUP ALL] Fetching all automations');

		const automations = await this.automationsService.findAll();

		this.logger.debug(`[LOOKUP ALL] Retrieved ${automations.length} automations`);

		const response = new AutomationsResponseModel();
		response.data = automations;

		return response;
	}

	@ApiOperation({
		tags: [AUTOMATIONS_MODULE_API_TAG_NAME],
		summary: 'Validate an automation graph',
		description:
			'Validates a graph against the registered node types without saving anything and returns every issue found, each addressed to the node or edge it is about. `valid` tells whether the graph could be saved: an unknown node type or port, an edge into a trigger, a cycle or a duplicate edge always make it invalid; a node with an invalid configuration or a graph without a trigger make it invalid only when `enabled` is true. Warnings never make it invalid. The shape of the graph is checked first and answered with 400, as on create. Requires the owner or admin role.',
		operationId: 'validate-automations-module-automation-graph',
	})
	@ApiBody({ type: ReqValidateAutomationGraphDto, description: 'The graph to validate' })
	@ApiSuccessResponse(
		AutomationGraphValidationResponseModel,
		'The graph was validated. The response tells whether it could be saved and lists every issue found.',
	)
	@ApiBadRequestResponse('Invalid request data')
	@ApiForbiddenResponse('Only owners and admins can validate automation graphs')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post('validate')
	@HttpCode(200)
	async validate(@Body() validateDto: ReqValidateAutomationGraphDto): Promise<AutomationGraphValidationResponseModel> {
		const check = await this.automationsService.checkGraph(validateDto.data.graph, validateDto.data.enabled ?? false);

		this.logger.debug(`[VALIDATE] Validated a graph: valid=${check.valid} issues=${check.issues.length}`);

		const response = new AutomationGraphValidationResponseModel();
		response.data = createAutomationGraphValidationModel(check);

		return response;
	}

	@ApiOperation({
		tags: [AUTOMATIONS_MODULE_API_TAG_NAME],
		summary: 'Retrieve details of a specific automation',
		description: 'Fetches one automation by its unique ID, including its graph. Requires the owner or admin role.',
		operationId: 'get-automations-module-automation',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Automation ID' })
	@ApiSuccessResponse(
		AutomationResponseModel,
		'The automation was successfully retrieved. The response includes its metadata and its graph.',
	)
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiForbiddenResponse('Only owners and admins can read automations')
	@ApiNotFoundResponse('Automation not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get(':id')
	async findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<AutomationResponseModel> {
		this.logger.debug(`[LOOKUP] Fetching automation id=${id}`);

		const automation = await this.getOneOrThrow(id);

		this.logger.debug(`[LOOKUP] Found automation id=${automation.id}`);

		const response = new AutomationResponseModel();
		response.data = automation;

		return response;
	}

	@ApiOperation({
		tags: [AUTOMATIONS_MODULE_API_TAG_NAME],
		summary: 'Create a new automation',
		description:
			'Creates a new automation. Only the name is required; the automation is created disabled, in restart mode and with an empty graph unless stated otherwise. The shape of the graph is validated: node and edge identifiers must be unique and every edge must connect two existing nodes. The graph is also validated against the registered node types: a graph that could never run (an unknown node type or port, an edge into a trigger, a cycle, a duplicate edge) is always refused, and an automation created enabled also needs at least one trigger and a valid configuration on every node. A refused graph is answered with 422 and the list of issues in `error.details.issues`. The response includes the created automation with its graph, and a Location header with the URI of the new resource. Requires the owner or admin role.',
		operationId: 'create-automations-module-automation',
	})
	@ApiBody({ type: ReqCreateAutomationDto, description: 'The data required to create a new automation' })
	@ApiCreatedSuccessResponse(
		AutomationResponseModel,
		'The automation was successfully created. The response includes the complete automation at revision 1.',
		'/api/v1/automations/automations/123e4567-e89b-12d3-a456-426614174000',
	)
	@ApiBadRequestResponse('Invalid request data')
	@ApiForbiddenResponse('Only owners and admins can create automations')
	@ApiUnprocessableEntityResponse(
		'Automation could not be created. When the graph is the reason, `error.details.code` is `automation-graph-invalid` and `error.details.issues` lists the issues.',
	)
	@ApiInternalServerErrorResponse('Internal server error')
	@Post()
	async create(
		@Body() createDto: ReqCreateAutomationDto,
		@Res({ passthrough: true }) res: Response,
		@Req() req: Request,
	): Promise<AutomationResponseModel> {
		try {
			const automation = await this.automationsService.create(createDto.data);

			setLocationHeader(req, res, AUTOMATIONS_MODULE_PREFIX, 'automations', automation.id);

			const response = new AutomationResponseModel();
			response.data = automation;

			return response;
		} catch (error) {
			if (error instanceof AutomationsGraphValidationException) {
				throw this.createGraphRejection(error);
			}

			if (error instanceof AutomationsException) {
				throw new UnprocessableEntityException(error.message);
			}

			throw error;
		}
	}

	@ApiOperation({
		tags: [AUTOMATIONS_MODULE_API_TAG_NAME],
		summary: 'Update an existing automation',
		description:
			'Updates an automation. Only provided fields are changed; a provided graph replaces the stored graph as a whole. The request must carry the revision the edit was based on: when the stored automation is at a different revision the update is refused with 409 Conflict and nothing is changed. Every successful update increments the revision. A provided graph is validated as on create; enabling an automation validates the graph it will run, so an incomplete draft cannot be enabled. A refused graph is answered with 422 and the list of issues in `error.details.issues`. Requires the owner or admin role.',
		operationId: 'update-automations-module-automation',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Automation ID' })
	@ApiBody({ type: ReqUpdateAutomationDto, description: 'The data required to update the automation' })
	@ApiSuccessResponse(
		AutomationResponseModel,
		'The automation was successfully updated. The response includes the complete automation at its new revision.',
	)
	@ApiBadRequestResponse('Invalid request data or UUID format')
	@ApiForbiddenResponse('Only owners and admins can update automations')
	@ApiNotFoundResponse('Automation not found')
	@ApiConflictResponse('The automation was changed since the revision this update is based on')
	@ApiUnprocessableEntityResponse(
		'Automation could not be updated. When the graph is the reason, `error.details.code` is `automation-graph-invalid` and `error.details.issues` lists the issues.',
	)
	@ApiInternalServerErrorResponse('Internal server error')
	@Patch(':id')
	async update(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() updateDto: ReqUpdateAutomationDto,
	): Promise<AutomationResponseModel> {
		try {
			const automation = await this.automationsService.update(id, updateDto.data);

			const response = new AutomationResponseModel();
			response.data = automation;

			return response;
		} catch (error) {
			if (error instanceof AutomationsNotFoundException) {
				throw new NotFoundException('Requested automation does not exist');
			}

			if (error instanceof AutomationsRevisionConflictException) {
				throw new ConflictException(error.message);
			}

			if (error instanceof AutomationsGraphValidationException) {
				throw this.createGraphRejection(error);
			}

			if (error instanceof AutomationsException) {
				throw new UnprocessableEntityException(error.message);
			}

			throw error;
		}
	}

	@ApiOperation({
		tags: [AUTOMATIONS_MODULE_API_TAG_NAME],
		summary: 'Delete an automation',
		description: 'Deletes a specific automation from the system using its unique ID. Requires the owner or admin role.',
		operationId: 'delete-automations-module-automation',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Automation ID' })
	@ApiNoContentResponse({ description: 'The automation was successfully deleted.' })
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiForbiddenResponse('Only owners and admins can delete automations')
	@ApiNotFoundResponse('Automation not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Delete(':id')
	@HttpCode(204)
	async remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<void> {
		try {
			await this.automationsService.remove(id);
		} catch (error) {
			if (error instanceof AutomationsNotFoundException) {
				throw new NotFoundException('Requested automation does not exist');
			}

			throw error;
		}
	}

	/**
	 * The issues travel in the exception response next to the application code; the 422 filter puts both
	 * into `error.details` of the error envelope.
	 */
	private createGraphRejection(error: AutomationsGraphValidationException): UnprocessableEntityException {
		const rejection = new UnprocessableEntityException({
			code: AUTOMATION_GRAPH_INVALID_ERROR_CODE,
			message: error.message,
			issues: error.issues,
		});

		return rejection;
	}

	private async getOneOrThrow(id: string): Promise<AutomationEntity> {
		const automation = await this.automationsService.findOne(id);

		if (!automation) {
			this.logger.error(`[ERROR] Automation with id=${id} not found`);

			throw new NotFoundException('Requested automation does not exist');
		}

		return automation;
	}
}
