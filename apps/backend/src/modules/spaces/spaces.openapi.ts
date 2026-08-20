/**
 * OpenAPI extra models for Spaces module
 */
import { BulkAssignDto, ReqBulkAssignDto } from './dto/bulk-assign.dto';
import { CreateSpaceDto, ReqCreateSpaceDto } from './dto/create-space.dto';
import { UpdateSpacesConfigDto } from './dto/update-config.dto';
import { ReqUpdateSpaceDto, UpdateSpaceDto } from './dto/update-space.dto';
import { SpaceEntity } from './entities/space.entity';
import { SpacesConfigModel } from './models/config.model';
import {
	BulkAssignmentDataModel,
	BulkAssignmentResponseModel,
	BulkAssignmentResultDataModel,
	BulkResultResponseModel,
	CategoryTemplateDataModel,
	CategoryTemplatesResponseModel,
	SpaceResponseModel,
	SpacesResponseModel,
} from './models/spaces-response.model';

export const SPACES_SWAGGER_EXTRA_MODELS = [
	// Module configuration
	SpacesConfigModel,
	// DTOs
	CreateSpaceDto,
	ReqCreateSpaceDto,
	UpdateSpaceDto,
	ReqUpdateSpaceDto,
	BulkAssignDto,
	ReqBulkAssignDto,
	UpdateSpacesConfigDto,
	// Response models
	SpaceResponseModel,
	SpacesResponseModel,
	BulkAssignmentDataModel,
	BulkAssignmentResultDataModel,
	BulkAssignmentResponseModel,
	BulkResultResponseModel,
	CategoryTemplateDataModel,
	CategoryTemplatesResponseModel,
	// Entities
	SpaceEntity,
];
