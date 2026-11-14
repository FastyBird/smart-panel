import {
	Body,
	Controller,
	Get,
	HttpCode,
	NotFoundException,
	Param,
	ParseUUIDPipe,
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
	AUTOMATION_IMPORT_INVALID_ERROR_CODE,
	AUTOMATION_IMPORT_MAX_LENGTH,
} from '../automations.constants';
import {
	AutomationsGraphValidationException,
	AutomationsImportException,
	AutomationsNotFoundException,
} from '../automations.exceptions';
import { ReqPrepareAutomationImportDto } from '../dto/prepare-import.dto';
import {
	createAutomationExportModel,
	createAutomationImportPreparationModel,
} from '../models/automation-transfer.model';
import {
	AutomationExportResponseModel,
	AutomationImportPreparationResponseModel,
} from '../models/automations-response.model';
import { AutomationTransferService } from '../services/automation-transfer.service';

@ApiTags(AUTOMATIONS_MODULE_API_TAG_NAME)
@Controller('automations')
@Roles(UserRole.OWNER, UserRole.ADMIN)
export class AutomationTransferController {
	private readonly logger = createExtensionLogger(AUTOMATIONS_MODULE_NAME, 'AutomationTransferController');

	constructor(private readonly transfer: AutomationTransferService) {}

	@ApiOperation({
		tags: [AUTOMATIONS_MODULE_API_TAG_NAME],
		summary: 'Prepare the import of an automation from a YAML file',
		description: `Reads an automation exported as YAML and returns the automation it would create; nothing is stored. The file must be a \`version: 1\`, \`kind: automation\` document of at most ${AUTOMATION_IMPORT_MAX_LENGTH / 1024} KB, read with the core YAML schema: tags, aliases and several documents are refused. Its fields are checked as those of a create request, and its graph as a save of a disabled automation, the safety policy included. The devices, properties, scenes, spaces and automations it refers to that do not exist here are listed in \`missing_references\` with every node and field using them; \`mappings\` points such references at entities of the same kind, and a property takes its channel and device with it. Create the automation from \`draft\` through the ordinary create request, disabled. A file that cannot be read as an automation, or a mapping to an entity that does not exist, is refused with 422, \`error.details.code\` \`automation-import-invalid\` and the problems in \`error.details.issues\`, each addressed to a part of the document (\`graph.nodes.0.type\`) or of the request (\`mappings.0.to\`). A graph that could not be saved even disabled - an unknown node type or port, an action that would reduce safety - is refused with 422 and \`automation-graph-invalid\`. Requires the owner or admin role.`,
		operationId: 'prepare-automations-module-automation-import',
	})
	@ApiBody({ type: ReqPrepareAutomationImportDto, description: 'The YAML file and the references to map' })
	@ApiSuccessResponse(
		AutomationImportPreparationResponseModel,
		'The file was read. The response holds the automation to create, the references that do not exist here and what a save would report.',
	)
	@ApiBadRequestResponse('Invalid request data')
	@ApiForbiddenResponse('Only owners and admins can import automations')
	@ApiUnprocessableEntityResponse(
		'The file was refused (`error.details.code` is `automation-import-invalid`), or its graph could not be saved (`automation-graph-invalid`); `error.details.issues` lists the problems.',
	)
	@ApiInternalServerErrorResponse('Internal server error')
	@Post('import/prepare')
	@HttpCode(200)
	async prepareImport(
		@Body() importDto: ReqPrepareAutomationImportDto,
	): Promise<AutomationImportPreparationResponseModel> {
		try {
			const preparation = await this.transfer.prepareImport(importDto.data.yaml, importDto.data.mappings ?? []);

			const response = new AutomationImportPreparationResponseModel();
			response.data = createAutomationImportPreparationModel(preparation);

			return response;
		} catch (error) {
			if (error instanceof AutomationsImportException) {
				throw new UnprocessableEntityException({
					code: AUTOMATION_IMPORT_INVALID_ERROR_CODE,
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

	@ApiOperation({
		tags: [AUTOMATIONS_MODULE_API_TAG_NAME],
		summary: 'Export an automation as a YAML file',
		description:
			'Returns the automation as a YAML document to save as a file, for sharing or backup, with the file name to save it under. The document holds the name, description, icon, run mode, space and graph - node and edge ids, types, positions and configurations - and nothing that belongs to this installation alone: no automation id, revision, enabled state, status or timestamps. The devices, properties, scenes, spaces and automations it refers to stay as their ids. Importing the file again reproduces the graph. Requires the owner or admin role.',
		operationId: 'export-automations-module-automation',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Automation ID' })
	@ApiSuccessResponse(
		AutomationExportResponseModel,
		'The automation was exported. The response holds the YAML document.',
	)
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiForbiddenResponse('Only owners and admins can export automations')
	@ApiNotFoundResponse('Automation not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get(':id/export')
	async exportAutomation(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<AutomationExportResponseModel> {
		try {
			const exported = await this.transfer.exportAutomation(id);

			this.logger.debug(`[EXPORT] Exported automation id=${id}`);

			const response = new AutomationExportResponseModel();
			response.data = createAutomationExportModel(exported.fileName, exported.content);

			return response;
		} catch (error) {
			if (error instanceof AutomationsNotFoundException) {
				throw new NotFoundException('Requested automation does not exist');
			}

			throw error;
		}
	}
}
