/**
 * OpenAPI extra models for Tiles Device Preview plugin
 */
import { CreateDevicePreviewTileDto, ReqCreateDevicePreviewTileDto } from './dto/create-tile.dto';
import { DevicePreviewUpdateConfigDto } from './dto/update-config.dto';
import { ReqUpdateDevicePreviewTileDto, UpdateDevicePreviewTileDto } from './dto/update-tile.dto';
import { DevicePreviewTileEntity } from './entities/tiles-device-preview.entity';
import { DevicePreviewConfigModel } from './models/config.model';

export const TILES_DEVICE_PREVIEW_PLUGIN_SWAGGER_EXTRA_MODELS = [
	// DTOs
	CreateDevicePreviewTileDto,
	ReqCreateDevicePreviewTileDto,
	UpdateDevicePreviewTileDto,
	ReqUpdateDevicePreviewTileDto,
	DevicePreviewUpdateConfigDto,
	// Data models
	DevicePreviewConfigModel,
	// Entities
	DevicePreviewTileEntity,
];
