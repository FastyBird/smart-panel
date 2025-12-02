/**
 * OpenAPI extra models for Tiles Time plugin
 */
import { CreateTimeTileDto, ReqCreateTimeTileDto } from './dto/create-tile.dto';
import { TimeUpdateConfigDto } from './dto/update-config.dto';
import { ReqUpdateTimeTileDto, UpdateTimeTileDto } from './dto/update-tile.dto';
import { TimeTileEntity } from './entities/tiles-time.entity';
import { TimeConfigModel } from './models/config.model';

export const TILES_TIME_PLUGIN_SWAGGER_EXTRA_MODELS = [
	// DTOs
	CreateTimeTileDto,
	ReqCreateTimeTileDto,
	UpdateTimeTileDto,
	ReqUpdateTimeTileDto,
	TimeUpdateConfigDto,
	// Data models
	TimeConfigModel,
	// Entities
	TimeTileEntity,
];
