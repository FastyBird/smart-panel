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
	AutomationsNotTriggerableException,
	AutomationsRevisionConflictException,
} from '../automations.exceptions';
import { ReqCreateAutomationDto } from '../dto/create-automation.dto';
import { ReqTriggerAutomationDto } from '../dto/trigger-automation.dto';
import { ReqUpdateAutomationDto } from '../dto/update-automation.dto';
import { ReqValidateAutomationGraphDto } from '../dto/validate-graph.dto';
import { AutomationEntity } from '../entities/automations.entity';
import { createAutomationRuntimeModel } from '../models/automation-runtime.model';
import { createAutomationTriggerResultModel } from '../models/automation-trigger-result.model';
import {
	AutomationGraphValidationResponseModel,
	AutomationResponseModel,
	AutomationRunsResponseModel,
	AutomationRuntimeResponseModel,
	AutomationTriggerResultResponseModel,
	AutomationsResponseModel,
} from '../models/automations-response.model';
import { createAutomationGraphValidationModel } from '../models/graph-validation.model';
import { AutomationEngineService } from '../services/automation-engine.service';
import { AutomationRunHistoryService } from '../services/automation-run-history.service';
import { AutomationsService } from '../services/automations.service';

@ApiTags(AUTOMATIONS_MODULE_API_TAG_NAME)
@Controller('automations')
@Roles(UserRole.OWNER, UserRole.ADMIN)
export class AutomationsController {
	private readonly logger = createExtensionLogger(AUTOMATIONS_MODULE_NAME, 'AutomationsController');

	constructor(
		private readonly automationsService: AutomationsService,
		private readonly engine: AutomationEngineService,
		private readonly runHistory: AutomationRunHistoryService,
	) {}

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
		summary: 'Run an automation by hand',
		description:
			'Starts a run of the automation without waiting for one of its triggers. The run starts at the given trigger node, or at the first trigger of the graph, and it may start only at a trigger node. The run mode and the overload guard apply as they do to a trigger that fired, so the answer may be that no run was started: `ignored` (a run is active and the mode is `single`), `dropped` (a limit of runs is reached) or `suspended`. The request is refused with 422 while the automation is disabled, `invalid` or `suspended`, and when the engine is not running; `error.details.code` says which. The response does not wait for the run to finish. Requires the owner or admin role.',
		operationId: 'trigger-automations-module-automation',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Automation ID' })
	@ApiBody({ type: ReqTriggerAutomationDto, description: 'Optional start node', required: false })
	@ApiSuccessResponse(
		AutomationTriggerResultResponseModel,
		'The request was handled. The response tells whether a run was started and, when it was not, why.',
	)
	@ApiBadRequestResponse('Invalid UUID format or request data')
	@ApiForbiddenResponse('Only owners and admins can run automations')
	@ApiNotFoundResponse('Automation not found')
	@ApiUnprocessableEntityResponse(
		'The automation cannot be run by hand. `error.details.code` says why: `disabled`, `invalid`, `suspended`, `not_a_trigger` (the node asked for is not a trigger), `no_trigger` (the graph has none), `not_running` (the engine is stopped) or `not_found` (the engine has not loaded the automation yet).',
	)
	@ApiInternalServerErrorResponse('Internal server error')
	@Post(':id/trigger')
	@HttpCode(200)
	async trigger(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() triggerDto: ReqTriggerAutomationDto,
	): Promise<AutomationTriggerResultResponseModel> {
		try {
			const outcome = await this.engine.triggerOrThrow(id, triggerDto?.data?.node_id);

			this.logger.debug(`[TRIGGER] Manual run of automation id=${id}: ${outcome.outcome}`);

			const response = new AutomationTriggerResultResponseModel();
			response.data = createAutomationTriggerResultModel(id, outcome);

			return response;
		} catch (error) {
			if (error instanceof AutomationsNotFoundException) {
				throw new NotFoundException('Requested automation does not exist');
			}

			if (error instanceof AutomationsNotTriggerableException) {
				// The 422 filter puts the refusal code into `error.details.code`, so a client need not read the text
				throw new UnprocessableEntityException({ code: error.code, message: error.message });
			}

			throw error;
		}
	}

	@ApiOperation({
		tags: [AUTOMATIONS_MODULE_API_TAG_NAME],
		summary: 'Retrieve what the engine holds for an automation',
		description:
			'Fetches the live state of one automation in the engine: whether its triggers are being watched, how many runs are active, how many triggers started a run, were ignored or were dropped since the backend started, the last trigger that did not start a run, and - for an invalid automation - which node or edge is the reason. Nothing of it is stored. Requires the owner or admin role.',
		operationId: 'get-automations-module-automation-runtime',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Automation ID' })
	@ApiSuccessResponse(AutomationRuntimeResponseModel, 'The live state of the automation was successfully retrieved.')
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiForbiddenResponse('Only owners and admins can read automations')
	@ApiNotFoundResponse('Automation not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get(':id/runtime')
	async runtime(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<AutomationRuntimeResponseModel> {
		const automation = await this.getOneOrThrow(id);

		const response = new AutomationRuntimeResponseModel();
		response.data = createAutomationRuntimeModel(automation, this.engine.runtime(id));

		return response;
	}

	@ApiOperation({
		tags: [AUTOMATIONS_MODULE_API_TAG_NAME],
		summary: 'Retrieve the run history of an automation',
		description:
			'Fetches the stored runs of one automation, newest first and without their traces. The last 50 runs of an automation are kept, and none for longer than 30 days. A run that never waited is stored when it ends; a run parked on a Delay is listed as `running`, and as `interrupted` when the backend restarted before it ended. Requires the owner or admin role.',
		operationId: 'get-automations-module-automation-runs',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Automation ID' })
	@ApiSuccessResponse(AutomationRunsResponseModel, 'The runs of the automation were successfully retrieved.')
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiForbiddenResponse('Only owners and admins can read automations')
	@ApiNotFoundResponse('Automation not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get(':id/runs')
	async runs(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<AutomationRunsResponseModel> {
		await this.getOneOrThrow(id);

		const response = new AutomationRunsResponseModel();
		response.data = await this.runHistory.findAllForAutomation(id);

		return response;
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
