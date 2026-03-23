import { UpdateStorageConfigDto } from './dto/update-config.dto';
import { StorageConfigModel } from './models/config.model';
import { InfluxV1ConfigModel } from './plugins/influx-v1/influx-v1.config.model';
import { UpdateInfluxV1ConfigDto } from './plugins/influx-v1/influx-v1.update-config.dto';
import { MemoryConfigModel } from './plugins/memory/memory.config.model';
import { UpdateMemoryConfigDto } from './plugins/memory/memory.update-config.dto';

export const STORAGE_MODULE_SWAGGER_EXTRA_MODELS = [
	UpdateStorageConfigDto,
	StorageConfigModel,
	UpdateInfluxV1ConfigDto,
	InfluxV1ConfigModel,
	UpdateMemoryConfigDto,
	MemoryConfigModel,
];
