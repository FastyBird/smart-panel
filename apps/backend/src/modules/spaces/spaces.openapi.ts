/**
 * OpenAPI extra models for Spaces module
 */
import { BulkAssignDto, ReqBulkAssignDto } from './dto/bulk-assign.dto';
import { ClimateIntentDto, ReqClimateIntentDto } from './dto/climate-intent.dto';
import { CreateSpaceDto, ReqCreateSpaceDto } from './dto/create-space.dto';
import { LightingIntentDto, ReqLightingIntentDto } from './dto/lighting-intent.dto';
import { ReqUpdateSpaceDto, UpdateSpaceDto } from './dto/update-space.dto';
import { SpaceEntity } from './entities/space.entity';
import {
	BulkAssignmentDataModel,
	BulkAssignmentResponseModel,
	BulkAssignmentResultDataModel,
	ClimateIntentResponseModel,
	ClimateIntentResultDataModel,
	ClimateStateDataModel,
	ClimateStateResponseModel,
	LightingIntentResponseModel,
	LightingIntentResultDataModel,
	ProposedSpaceDataModel,
	ProposedSpacesResponseModel,
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
	LightingIntentDto,
	ReqLightingIntentDto,
	ClimateIntentDto,
	ReqClimateIntentDto,
	// Response models
	SpaceResponseModel,
	SpacesResponseModel,
	BulkAssignmentDataModel,
	BulkAssignmentResultDataModel,
	BulkAssignmentResponseModel,
	ProposedSpaceDataModel,
	ProposedSpacesResponseModel,
	LightingIntentResultDataModel,
	LightingIntentResponseModel,
	ClimateStateDataModel,
	ClimateStateResponseModel,
	ClimateIntentResultDataModel,
	ClimateIntentResponseModel,
	// Entities
	SpaceEntity,
];
