import { UpdateInfluxConfigDto, UpdateStorageConfigDto } from './dto/update-config.dto';
import { InfluxConfigModel, StorageConfigModel } from './models/config.model';

export const STORAGE_MODULE_SWAGGER_EXTRA_MODELS = [
	UpdateInfluxConfigDto,
	UpdateStorageConfigDto,
	InfluxConfigModel,
	StorageConfigModel,
];
