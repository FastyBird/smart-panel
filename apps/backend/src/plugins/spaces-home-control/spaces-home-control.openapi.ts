import { Type } from '@nestjs/common';

import { ClimateIntentDto, ReqClimateIntentDto } from './dto/climate-intent.dto';
import {
	BulkSetClimateRolesDto,
	ReqBulkSetClimateRolesDto,
	ReqSetClimateRoleDto,
	SetClimateRoleDto,
} from './dto/climate-role.dto';
import { CoversIntentDto, ReqCoversIntentDto } from './dto/covers-intent.dto';
import {
	BulkSetCoversRolesDto,
	ReqBulkSetCoversRolesDto,
	ReqSetCoversRoleDto,
	SetCoversRoleDto,
} from './dto/covers-role.dto';
import { CreateHomeControlSpaceDto } from './dto/create-home-control-space.dto';
import { LightingIntentDto, ReqLightingIntentDto } from './dto/lighting-intent.dto';
import {
	BulkSetLightingRolesDto,
	ReqBulkSetLightingRolesDto,
	ReqSetLightingRoleDto,
	SetLightingRoleDto,
} from './dto/lighting-role.dto';
import {
	CreateMediaActivityBindingDto,
	ReqCreateMediaActivityBindingDto,
	ReqUpdateMediaActivityBindingDto,
	UpdateMediaActivityBindingDto,
} from './dto/media-activity-binding.dto';
import {
	BulkSetSensorRolesDto,
	ReqBulkSetSensorRolesDto,
	ReqSetSensorRoleDto,
	SetSensorRoleDto,
} from './dto/sensor-role.dto';
import { ReqSuggestionFeedbackDto, SuggestionFeedbackDto } from './dto/suggestion.dto';
import { SpacesHomeControlUpdatePluginConfigDto } from './dto/update-config.dto';
import { UpdateHomeControlSpaceDto } from './dto/update-home-control-space.dto';
import { RoomSpaceEntity } from './entities/room-space.entity';
import { SpaceActiveMediaActivityEntity } from './entities/space-active-media-activity.entity';
import { SpaceClimateRoleEntity } from './entities/space-climate-role.entity';
import { SpaceCoversRoleEntity } from './entities/space-covers-role.entity';
import { SpaceLightingRoleEntity } from './entities/space-lighting-role.entity';
import { SpaceMediaActivityBindingEntity } from './entities/space-media-activity-binding.entity';
import { SpaceSensorRoleEntity } from './entities/space-sensor-role.entity';
import { ZoneSpaceEntity } from './entities/zone-space.entity';
import { SpacesHomeControlConfigModel } from './models/config.model';
import {
	DerivedMediaCapabilitiesModel,
	DerivedMediaEndpointModel,
	DerivedMediaEndpointsResponseModel,
	DerivedMediaEndpointsResultModel,
	DerivedMediaLinksModel,
	DerivedMediaPropertyLinkModel,
	DerivedRemoteLinksModel,
} from './models/derived-media-endpoint.model';
import {
	MediaActivityBindingResponseModel,
	MediaActivityBindingsResponseModel,
} from './models/media-activity-binding.model';
import {
	ActiveMediaActivityResponseModel,
	MediaActivityActivationResponseModel,
	MediaActivityActivationResultModel,
	MediaActivityExecutionPlanModel,
	MediaActivityExecutionStepModel,
	MediaActivityLastResultModel,
	MediaActivityResolvedModel,
	MediaActivityStepFailureModel,
} from './models/media-activity.model';
import {
	MediaCapabilitiesResponseModel,
	MediaCapabilityMappingModel,
	MediaCapabilitySummaryModel,
} from './models/media-routing.model';
import {
	BulkClimateRoleResultItemModel,
	BulkClimateRolesResponseModel,
	BulkClimateRolesResultDataModel,
	BulkCoversRoleResultItemModel,
	BulkCoversRolesResponseModel,
	BulkCoversRolesResultDataModel,
	BulkLightingRolesResponseModel,
	BulkLightingRolesResultDataModel,
	BulkSensorRoleResultItemModel,
	BulkSensorRolesResponseModel,
	BulkSensorRolesResultDataModel,
	ClimateIntentResponseModel,
	ClimateIntentResultDataModel,
	ClimateRoleResponseModel,
	ClimateStateDataModel,
	ClimateStateResponseModel,
	ClimateTargetDataModel,
	ClimateTargetsResponseModel,
	ContextSnapshotDataModel,
	ContextSnapshotResponseModel,
	CoversIntentResponseModel,
	CoversIntentResultDataModel,
	CoversRoleResponseModel,
	CoversStateDataModel,
	CoversStateResponseModel,
	CoversTargetDataModel,
	CoversTargetsResponseModel,
	EnvironmentSummaryDataModel,
	IntentCatalogDataModel,
	IntentCatalogResponseModel,
	IntentCategoryDataModel,
	IntentEnumValueDataModel,
	IntentParamDataModel,
	IntentTypeDataModel,
	LightStateSnapshotDataModel,
	LightTargetDataModel,
	LightTargetsResponseModel,
	LightingContextDataModel,
	LightingIntentResponseModel,
	LightingIntentResultDataModel,
	LightingRoleMetaDataModel,
	LightingRoleResponseModel,
	LightingRolesResponseModel,
	LightingSummaryDataModel,
	ProposedSpaceDataModel,
	ProposedSpacesResponseModel,
	QuickActionDataModel,
	SafetyAlertDataModel,
	SensorReadingDataModel,
	SensorRoleReadingsDataModel,
	SensorRoleResponseModel,
	SensorStateDataModel,
	SensorStateResponseModel,
	SensorTargetDataModel,
	SensorTargetsResponseModel,
	SuggestionDataModel,
	SuggestionFeedbackResponseModel,
	SuggestionFeedbackResultDataModel,
	SuggestionResponseModel,
	UndoResultDataModel,
	UndoResultResponseModel,
	UndoStateDataModel,
	UndoStateResponseModel,
} from './models/spaces-response.model';

/**
 * OpenAPI extra models for the Spaces Home Control plugin.
 *
 * Registers every DTO, entity, and response model that the plugin exposes
 * through its controller so Swagger can emit the full schema set. Models
 * that still live in core (e.g. `SpaceResponseModel`) are registered by
 * `SpacesModule` — keeping them there preserves existing schema names.
 */

export const SPACES_HOME_CONTROL_PLUGIN_SWAGGER_EXTRA_MODELS: (
	| Type<unknown>
	| (abstract new (...args: unknown[]) => unknown)
)[] = [
	// Plugin config
	SpacesHomeControlConfigModel,
	SpacesHomeControlUpdatePluginConfigDto,
	// Home-control space DTOs (add category / suggestions_enabled /
	// status_widgets on top of the generic CreateSpaceDto / UpdateSpaceDto)
	CreateHomeControlSpaceDto,
	UpdateHomeControlSpaceDto,
	// DTOs
	LightingIntentDto,
	ReqLightingIntentDto,
	ClimateIntentDto,
	ReqClimateIntentDto,
	SetLightingRoleDto,
	ReqSetLightingRoleDto,
	BulkSetLightingRolesDto,
	ReqBulkSetLightingRolesDto,
	SetClimateRoleDto,
	ReqSetClimateRoleDto,
	BulkSetClimateRolesDto,
	ReqBulkSetClimateRolesDto,
	CoversIntentDto,
	ReqCoversIntentDto,
	SetCoversRoleDto,
	ReqSetCoversRoleDto,
	BulkSetCoversRolesDto,
	ReqBulkSetCoversRolesDto,
	SuggestionFeedbackDto,
	ReqSuggestionFeedbackDto,
	// Media activity binding DTOs
	CreateMediaActivityBindingDto,
	ReqCreateMediaActivityBindingDto,
	UpdateMediaActivityBindingDto,
	ReqUpdateMediaActivityBindingDto,
	// Sensor DTOs
	SetSensorRoleDto,
	ReqSetSensorRoleDto,
	BulkSetSensorRolesDto,
	ReqBulkSetSensorRolesDto,
	// Entities
	RoomSpaceEntity,
	ZoneSpaceEntity,
	SpaceLightingRoleEntity,
	SpaceClimateRoleEntity,
	SpaceCoversRoleEntity,
	SpaceMediaActivityBindingEntity,
	SpaceSensorRoleEntity,
	SpaceActiveMediaActivityEntity,
	// Proposed space response models
	ProposedSpaceDataModel,
	ProposedSpacesResponseModel,
	// Lighting response models
	LightingIntentResultDataModel,
	LightingIntentResponseModel,
	LightTargetDataModel,
	LightTargetsResponseModel,
	LightingRoleResponseModel,
	LightingRolesResponseModel,
	BulkLightingRolesResultDataModel,
	BulkLightingRolesResponseModel,
	// Climate response models
	ClimateStateDataModel,
	ClimateStateResponseModel,
	ClimateIntentResultDataModel,
	ClimateIntentResponseModel,
	ClimateTargetDataModel,
	ClimateTargetsResponseModel,
	ClimateRoleResponseModel,
	BulkClimateRoleResultItemModel,
	BulkClimateRolesResultDataModel,
	BulkClimateRolesResponseModel,
	// Covers response models
	CoversStateDataModel,
	CoversStateResponseModel,
	CoversIntentResultDataModel,
	CoversIntentResponseModel,
	CoversTargetDataModel,
	CoversTargetsResponseModel,
	CoversRoleResponseModel,
	BulkCoversRoleResultItemModel,
	BulkCoversRolesResultDataModel,
	BulkCoversRolesResponseModel,
	// Media endpoint/routing response models
	MediaCapabilityMappingModel,
	MediaCapabilitySummaryModel,
	MediaCapabilitiesResponseModel,
	// Media activity binding response models
	MediaActivityBindingResponseModel,
	MediaActivityBindingsResponseModel,
	// Media activity activation models
	MediaActivityResolvedModel,
	MediaActivityStepFailureModel,
	MediaActivityLastResultModel,
	MediaActivityExecutionStepModel,
	MediaActivityExecutionPlanModel,
	MediaActivityActivationResultModel,
	MediaActivityActivationResponseModel,
	ActiveMediaActivityResponseModel,
	// Derived media endpoint models
	DerivedMediaPropertyLinkModel,
	DerivedRemoteLinksModel,
	DerivedMediaCapabilitiesModel,
	DerivedMediaLinksModel,
	DerivedMediaEndpointModel,
	DerivedMediaEndpointsResultModel,
	DerivedMediaEndpointsResponseModel,
	// Sensor response models
	SensorStateDataModel,
	SensorStateResponseModel,
	SensorTargetDataModel,
	SensorTargetsResponseModel,
	SensorRoleResponseModel,
	BulkSensorRoleResultItemModel,
	BulkSensorRolesResultDataModel,
	BulkSensorRolesResponseModel,
	SensorReadingDataModel,
	SensorRoleReadingsDataModel,
	EnvironmentSummaryDataModel,
	SafetyAlertDataModel,
	// Suggestion response models
	SuggestionDataModel,
	SuggestionResponseModel,
	SuggestionFeedbackResultDataModel,
	SuggestionFeedbackResponseModel,
	// Intent catalog response models
	IntentEnumValueDataModel,
	IntentParamDataModel,
	IntentTypeDataModel,
	IntentCategoryDataModel,
	QuickActionDataModel,
	LightingRoleMetaDataModel,
	IntentCatalogDataModel,
	IntentCatalogResponseModel,
	// Context snapshot response models
	LightStateSnapshotDataModel,
	LightingSummaryDataModel,
	LightingContextDataModel,
	ContextSnapshotDataModel,
	ContextSnapshotResponseModel,
	// Undo history response models
	UndoStateDataModel,
	UndoStateResponseModel,
	UndoResultDataModel,
	UndoResultResponseModel,
];
