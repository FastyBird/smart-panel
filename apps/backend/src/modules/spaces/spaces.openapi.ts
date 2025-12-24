/**
 * OpenAPI extra models for Spaces module
 */
import { BulkAssignDto, ReqBulkAssignDto } from './dto/bulk-assign.dto';
import { CreateSpaceDto, ReqCreateSpaceDto } from './dto/create-space.dto';
import { ReqUpdateSpaceDto, UpdateSpaceDto } from './dto/update-space.dto';
import { SpaceEntity } from './entities/space.entity';
import {
	BulkAssignmentDataModel,
	BulkAssignmentResponseModel,
	BulkAssignmentResultDataModel,
	SpaceResponseModel,
	SpacesResponseModel,
} from './models/spaces-response.model';

export const SPACES_SWAGGER_EXTRA_MODELS = [
	// DTOs
	CreateSpaceDto,
	ReqCreateSpaceDto,
	UpdateSpaceDto,
	ReqUpdateSpaceDto,
	BulkAssignDto,
	ReqBulkAssignDto,
	// Response models
	SpaceResponseModel,
	SpacesResponseModel,
	BulkAssignmentDataModel,
	BulkAssignmentResultDataModel,
	BulkAssignmentResponseModel,
	// Entities
	SpaceEntity,
];
