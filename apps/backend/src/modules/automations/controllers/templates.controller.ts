import {
	Body,
	Controller,
	Get,
	HttpCode,
	NotFoundException,
	Param,
	Post,
	UnprocessableEntityException,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { createExtensionLogger } from '../../../common/logger';
import {
	ApiBadRequestResponse,
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
	AUTOMATION_GRAPH_INVALID_ERROR_CODE,
	AUTOMATION_TEMPLATE_PARAMETERS_INVALID_ERROR_CODE,
} from '../automations.constants';
import {
	AutomationsGraphValidationException,
	AutomationsTemplateNotFoundException,
	AutomationsTemplateParametersException,
} from '../automations.exceptions';
import { ReqGenerateAutomationFromTemplateDto } from '../dto/generate-from-template.dto';
import {
	createAutomationTemplateDraftModel,
	createAutomationTemplateModel,
} from '../models/automation-templates.model';
import {
	AutomationTemplateDraftResponseModel,
	AutomationTemplatesResponseModel,
} from '../models/automations-response.model';
import { AutomationTemplatesService } from '../templates/automation-templates.service';

@ApiTags(AUTOMATIONS_MODULE_API_TAG_NAME)
@Controller('templates')
@Roles(UserRole.OWNER, UserRole.ADMIN)
export class AutomationTemplatesController {
	private readonly logger = createExtensionLogger(AUTOMATIONS_MODULE_NAME, 'AutomationTemplatesController');

	constructor(private readonly templates: AutomationTemplatesService) {}

	@ApiOperation({
		tags: [AUTOMATIONS_MODULE_API_TAG_NAME],
		summary: 'Retrieve the catalogue of automation templates',
		description:
			'Fetches every automation template that was loaded: the built-in ones and those of the configuration directory. Each entry carries its identifier, its name and description in English, the run mode of the automation it creates, and the questions it asks. The list is ordered by identifier. Requires the owner or admin role.',
		operationId: 'get-automations-module-templates',
	})
	@ApiSuccessResponse(AutomationTemplatesResponseModel, 'The catalogue of templates was successfully retrieved.')
	@ApiForbiddenResponse('Only owners and admins can read automation templates')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get()
	findAll(): AutomationTemplatesResponseModel {
		const templates = this.templates.catalog().templates;

		this.logger.debug(`[LOOKUP ALL] Retrieved ${templates.length} automation templates`);

		const response = new AutomationTemplatesResponseModel();
		response.data = templates.map(createAutomationTemplateModel);

		return response;
	}

	@ApiOperation({
		tags: [AUTOMATIONS_MODULE_API_TAG_NAME],
		summary: 'Generate the draft of an automation from a template',
		description:
			'Answers the questions of a template and returns the draft of a new automation: a suggested name, the run mode and the generated graph. Nothing is stored: the draft is created as an automation the ordinary way, and nothing in it refers back to the template. Answers that are missing, of the wrong kind, out of bounds, or that point at a device property that does not exist or is not of the kind the question asks for are refused with 422, `error.details.code` `automation-template-parameters-invalid` and the problems in `error.details.issues`, each addressed to its question (`parameters.<id>`). A generated graph that could not be saved as an enabled automation is refused with 422 and `automation-graph-invalid`. Requires the owner or admin role.',
		operationId: 'generate-automations-module-template-draft',
	})
	@ApiParam({ name: 'id', type: 'string', description: 'Template identifier', example: 'motion-light' })
	@ApiBody({ type: ReqGenerateAutomationFromTemplateDto, description: 'The answers to the questions of the template' })
	@ApiSuccessResponse(
		AutomationTemplateDraftResponseModel,
		'The draft was generated. The response holds the suggested name, the run mode and the graph.',
	)
	@ApiBadRequestResponse('Invalid request data')
	@ApiForbiddenResponse('Only owners and admins can generate automations from templates')
	@ApiNotFoundResponse('Template not found')
	@ApiUnprocessableEntityResponse(
		'The answers were refused (`error.details.code` is `automation-template-parameters-invalid`), or the generated graph could not be saved (`automation-graph-invalid`); `error.details.issues` lists the problems.',
	)
	@ApiInternalServerErrorResponse('Internal server error')
	@Post(':id/generate')
	@HttpCode(200)
	async generate(
		@Param('id') id: string,
		@Body() generateDto: ReqGenerateAutomationFromTemplateDto,
	): Promise<AutomationTemplateDraftResponseModel> {
		try {
			const draft = await this.templates.generate(id, generateDto.data.parameters);

			this.logger.debug(`[GENERATE] Generated a draft from template id=${id}`);

			const response = new AutomationTemplateDraftResponseModel();
			response.data = createAutomationTemplateDraftModel(draft);

			return response;
		} catch (error) {
			if (error instanceof AutomationsTemplateNotFoundException) {
				throw new NotFoundException('Requested automation template does not exist');
			}

			if (error instanceof AutomationsTemplateParametersException) {
				throw new UnprocessableEntityException({
					code: AUTOMATION_TEMPLATE_PARAMETERS_INVALID_ERROR_CODE,
					message: error.message,
					issues: error.issues,
				});
			}

			if (error instanceof AutomationsGraphValidationException) {
				throw new UnprocessableEntityException({
					code: AUTOMATION_GRAPH_INVALID_ERROR_CODE,
					message: error.message,
					issues: error.issues,
				});
			}

			throw error;
		}
	}
}
