import { ReqUpdateExtensionDto, UpdateExtensionDataDto } from './dto/update-extension.dto';
import { ExtensionLinksModel, ExtensionModel } from './models/extension.model';
import { ExtensionResponseModel, ExtensionsResponseModel } from './models/extensions-response.model';

export const EXTENSIONS_SWAGGER_EXTRA_MODELS = [
	ExtensionModel,
	ExtensionLinksModel,
	ExtensionResponseModel,
	ExtensionsResponseModel,
	ReqUpdateExtensionDto,
	UpdateExtensionDataDto,
];
