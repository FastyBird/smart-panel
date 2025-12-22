/**
 * OpenAPI extra models for InfluxDB module
 */
import { UpdateInfluxDbConfigDto } from './dto/update-config.dto';
import { InfluxDbConfigModel } from './models/config.model';

export const INFLUXDB_MODULE_SWAGGER_EXTRA_MODELS = [
	// DTOs
	UpdateInfluxDbConfigDto,
	// Data models
	InfluxDbConfigModel,
];
