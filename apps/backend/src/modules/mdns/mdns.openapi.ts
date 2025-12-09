/**
 * OpenAPI extra models for mDNS module
 */
import { UpdateMdnsConfigDto } from './dto/update-config.dto';
import { MdnsConfigModel } from './models/config.model';

export const MDNS_MODULE_SWAGGER_EXTRA_MODELS = [
	// DTOs
	UpdateMdnsConfigDto,
	// Data models
	MdnsConfigModel,
];
