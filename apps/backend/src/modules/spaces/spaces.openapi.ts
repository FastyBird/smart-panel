/**
 * OpenAPI extra models for Spaces module
 */
import { BulkAssignDto, ReqBulkAssignDto } from './dto/bulk-assign.dto';
import { ClimateIntentDto, ReqClimateIntentDto } from './dto/climate-intent.dto';
import { CreateSpaceDto, ReqCreateSpaceDto } from './dto/create-space.dto';
import { LightingIntentDto, ReqLightingIntentDto } from './dto/lighting-intent.dto';
import {
	BulkSetLightingRolesDto,
	ReqBulkSetLightingRolesDto,
	ReqSetLightingRoleDto,
	SetLightingRoleDto,
} from './dto/lighting-role.dto';
import { ReqSuggestionFeedbackDto, SuggestionFeedbackDto } from './dto/suggestion.dto';
import { ReqUpdateSpaceDto, UpdateSpaceDto } from './dto/update-space.dto';
import { SpaceLightingRoleEntity } from './entities/space-lighting-role.entity';
import { SpaceEntity } from './entities/space.entity';
import {
	BulkAssignmentDataModel,
	BulkAssignmentResponseModel,
	BulkAssignmentResultDataModel,
	BulkLightingRolesResponseModel,
	BulkLightingRolesResultDataModel,
	ClimateIntentResponseModel,
	ClimateIntentResultDataModel,
	ClimateStateDataModel,
	ClimateStateResponseModel,
	LightTargetDataModel,
	LightTargetsResponseModel,
	LightingIntentResponseModel,
	LightingIntentResultDataModel,
	LightingRoleResponseModel,
	LightingRolesResponseModel,
	ProposedSpaceDataModel,
	ProposedSpacesResponseModel,
	SpaceResponseModel,
	SpacesResponseModel,
	SuggestionDataModel,
	SuggestionFeedbackResponseModel,
	SuggestionFeedbackResultDataModel,
	SuggestionResponseModel,
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
	SetLightingRoleDto,
	ReqSetLightingRoleDto,
	BulkSetLightingRolesDto,
	ReqBulkSetLightingRolesDto,
	SuggestionFeedbackDto,
	ReqSuggestionFeedbackDto,
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
	LightTargetDataModel,
	LightTargetsResponseModel,
	LightingRoleResponseModel,
	LightingRolesResponseModel,
	BulkLightingRolesResultDataModel,
	BulkLightingRolesResponseModel,
	SuggestionDataModel,
	SuggestionResponseModel,
	SuggestionFeedbackResultDataModel,
	SuggestionFeedbackResponseModel,
	// Entities
	SpaceEntity,
	SpaceLightingRoleEntity,
];
