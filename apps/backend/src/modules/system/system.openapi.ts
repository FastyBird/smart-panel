/**
 * OpenAPI extra models for System module
 */
import {
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
	LogEntryAcceptedModel,
	LogEntryContextModel,
	LogEntryErrorModel,
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
	LogEntriesResponseModel,
	LogEntryAcceptedResponseModel,
	SystemHealthResponseModel,
	SystemInfoResponseModel,
	ThrottleStatusResponseModel,
	SystemModuleLogIngestResult,
	// Data models
	SystemHealthModel,
	SystemInfoModel,
	ThrottleStatusModel,
	LogEntryAcceptedModel,
	LogEntryUserModel,
	LogEntryContextModel,
	LogEntryErrorModel,
	LogEntryModel,
	CpuLoad1mModel,
	MemUsedPctModel,
	DiskUsedPctModel,
	SystemUptimeSecModel,
	ProcessUptimeSecModel,
	TemperatureCpuModel,
	TemperatureGpuModel,
	ModuleStatsModel,
];
