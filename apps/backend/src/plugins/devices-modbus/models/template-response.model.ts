import { Expose } from 'class-transformer';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';

import { ModbusTemplateCatalogModel, ModbusTemplatePreviewModel, ModbusTemplateSummaryModel } from './template.model';

@ApiSchema({ name: 'DevicesModbusPluginResTemplates' })
export class ModbusTemplatesResponseModel extends BaseSuccessResponseModel<ModbusTemplateCatalogModel> {
	@ApiProperty({ description: 'The actual data payload returned by the API', type: () => ModbusTemplateCatalogModel })
	@Expose()
	declare data: ModbusTemplateCatalogModel;
}

@ApiSchema({ name: 'DevicesModbusPluginResTemplate' })
export class ModbusTemplateResponseModel extends BaseSuccessResponseModel<ModbusTemplateSummaryModel> {
	@ApiProperty({ description: 'The actual data payload returned by the API', type: () => ModbusTemplateSummaryModel })
	@Expose()
	declare data: ModbusTemplateSummaryModel;
}

@ApiSchema({ name: 'DevicesModbusPluginResTemplatePreview' })
export class ModbusTemplatePreviewResponseModel extends BaseSuccessResponseModel<ModbusTemplatePreviewModel> {
	@ApiProperty({ description: 'The actual data payload returned by the API', type: () => ModbusTemplatePreviewModel })
	@Expose()
	declare data: ModbusTemplatePreviewModel;
}
