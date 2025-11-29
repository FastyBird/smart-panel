/**
 * OpenAPI extra models for System module
 */
import { DisplayProfileEntity } from './entities/system.entity';
import {
	DisplayProfileByUidResponseModel,
	DisplayProfileResponseModel,
	DisplayProfilesResponseModel,
	ExtensionsResponseModel,
	LogEntriesResponseModel,
	LogEntryAcceptedResponseModel,
	SystemHealthResponseModel,
	SystemInfoResponseModel,
	SystemModuleLogIngestResult,
	ThrottleStatusResponseModel,
} from './models/system-response.model';
import {
	CpuLoad1mModel,
	DiskUsedPctModel,
	ExtensionAdminModel,
	ExtensionBackendModel,
	ExtensionBaseModel,
	LogEntryAcceptedModel,
	LogEntryContextModel,
	LogEntryModel,
	LogEntryUserModel,
	MemUsedPctModel,
	ModuleStatsModel,
	ProcessUptimeSecModel,
	SystemHealthModel,
	SystemInfoModel,
	SystemUptimeSecModel,
	TemperatureCpuModel,
	TemperatureGpuModel,
	ThrottleStatusModel,
} from './models/system.model';

/**
 * OpenAPI extra models for System module
 */
export const SYSTEM_SWAGGER_EXTRA_MODELS = [
	// Response models
	DisplayProfileResponseModel,
	DisplayProfilesResponseModel,
	DisplayProfileByUidResponseModel,
	ExtensionsResponseModel,
	LogEntriesResponseModel,
	LogEntryAcceptedResponseModel,
	SystemHealthResponseModel,
	SystemInfoResponseModel,
	ThrottleStatusResponseModel,
	SystemModuleLogIngestResult,
	// Data models
	ExtensionBaseModel,
	ExtensionAdminModel,
	ExtensionBackendModel,
	SystemHealthModel,
	SystemInfoModel,
	ThrottleStatusModel,
	LogEntryAcceptedModel,
	LogEntryUserModel,
	LogEntryContextModel,
	LogEntryModel,
	CpuLoad1mModel,
	MemUsedPctModel,
	DiskUsedPctModel,
	SystemUptimeSecModel,
	ProcessUptimeSecModel,
	TemperatureCpuModel,
	TemperatureGpuModel,
	ModuleStatsModel,
	// Entities
	DisplayProfileEntity,
];
