import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import {
	ApiBadRequestResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
} from '../../../modules/swagger/decorators/api-documentation.decorator';
import { Roles } from '../../../modules/users/guards/roles.guard';
import { UserRole } from '../../../modules/users/users.constants';
import { DEVICES_MODBUS_API_TAG_NAME } from '../devices-modbus.constants';
import { ReqPreviewModbusTemplateDto } from '../dto/preview-template.dto';
import {
	ModbusTemplatePreviewResponseModel,
	ModbusTemplateResponseModel,
	ModbusTemplatesResponseModel,
} from '../models/template-response.model';
import {
	ModbusTemplateCatalogModel,
	ModbusTemplatePreviewModel,
	ModbusTemplateSummaryModel,
} from '../models/template.model';
import { ModbusTemplatesService } from '../services/modbus-templates.service';

@ApiTags(DEVICES_MODBUS_API_TAG_NAME)
@Controller('templates')
export class ModbusTemplatesController {
	constructor(private readonly templates: ModbusTemplatesService) {}

	@ApiOperation({
		tags: [DEVICES_MODBUS_API_TAG_NAME],
		summary: 'Retrieve the Modbus device templates',
		description:
			'Fetches the loaded Modbus device templates together with the load result of every template file, including the files that failed to load.',
		operationId: 'get-devices-modbus-plugin-templates',
	})
	@ApiSuccessResponse(ModbusTemplatesResponseModel, 'The Modbus device templates were successfully retrieved.')
	@ApiInternalServerErrorResponse('Internal server error')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@Get()
	findAll(): ModbusTemplatesResponseModel {
		const response = new ModbusTemplatesResponseModel();

		response.data = ModbusTemplateCatalogModel.from(this.templates.catalog());

		return response;
	}

	@ApiOperation({
		tags: [DEVICES_MODBUS_API_TAG_NAME],
		summary: 'Retrieve a Modbus device template',
		description: 'Fetches the summary of a single loaded Modbus device template identified by its ID.',
		operationId: 'get-devices-modbus-plugin-template',
	})
	@ApiParam({ name: 'id', type: 'string', description: 'Template ID', example: 'qingjun-32di' })
	@ApiSuccessResponse(ModbusTemplateResponseModel, 'The Modbus device template was successfully retrieved.')
	@ApiNotFoundResponse('Template not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@Get(':id')
	findOne(@Param('id') id: string): ModbusTemplateResponseModel {
		const response = new ModbusTemplateResponseModel();

		response.data = ModbusTemplateSummaryModel.from(this.templates.get(id));

		return response;
	}

	@ApiOperation({
		tags: [DEVICES_MODBUS_API_TAG_NAME],
		summary: 'Preview a Modbus device template',
		description:
			'Expands a template into the device structure it would create, with an optional unit ID and poll interval. Nothing is stored; without endpoint_defaults, the result can be sent to the device creation route together with an endpoint ID and a name.',
		operationId: 'create-devices-modbus-plugin-template-preview',
	})
	@ApiParam({ name: 'id', type: 'string', description: 'Template ID', example: 'qingjun-32di' })
	@ApiBody({
		type: ReqPreviewModbusTemplateDto,
		description: 'The unit ID and poll interval to expand the template with',
	})
	@ApiSuccessResponse(ModbusTemplatePreviewResponseModel, 'The template preview was successfully generated.')
	@ApiBadRequestResponse('Invalid request data or a value outside the range the template allows')
	@ApiNotFoundResponse('Template not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@Post(':id/preview')
	@HttpCode(200)
	preview(@Param('id') id: string, @Body() body: ReqPreviewModbusTemplateDto): ModbusTemplatePreviewResponseModel {
		const expansion = this.templates.preview(id, body.data);
		const response = new ModbusTemplatePreviewResponseModel();

		response.data = ModbusTemplatePreviewModel.from(expansion, this.templates.get(id));

		return response;
	}

	@ApiOperation({
		tags: [DEVICES_MODBUS_API_TAG_NAME],
		summary: 'Reload the Modbus device templates',
		description:
			'Reads the built-in and user template locations again and returns the new catalog. Existing devices are not changed.',
		operationId: 'create-devices-modbus-plugin-templates-reload',
	})
	@ApiSuccessResponse(ModbusTemplatesResponseModel, 'The Modbus device templates were successfully reloaded.')
	@ApiInternalServerErrorResponse('Internal server error')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@Post('reload')
	@HttpCode(200)
	reload(): ModbusTemplatesResponseModel {
		const response = new ModbusTemplatesResponseModel();

		response.data = ModbusTemplateCatalogModel.from(this.templates.reload());

		return response;
	}
}
