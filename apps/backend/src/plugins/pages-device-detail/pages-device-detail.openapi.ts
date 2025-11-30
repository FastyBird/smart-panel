/**
 * OpenAPI extra models for Pages Device Detail plugin
 */
import { CreateDeviceDetailPageDto } from './dto/create-page.dto';
import { DeviceDetailUpdatePluginConfigDto } from './dto/update-config.dto';
import { UpdateDeviceDetailPageDto } from './dto/update-page.dto';
import { DeviceDetailPageEntity } from './entities/pages-device-detail.entity';
import { DeviceDetailConfigModel } from './models/config.model';

export const PAGES_DEVICE_DETAIL_PLUGIN_SWAGGER_EXTRA_MODELS = [
	// DTOs
	CreateDeviceDetailPageDto,
	UpdateDeviceDetailPageDto,
	DeviceDetailUpdatePluginConfigDto,
	// Data models
	DeviceDetailConfigModel,
	// Entities
	DeviceDetailPageEntity,
];
