/**
 * OpenAPI extra models for System module
 */
import { ReqInstallUpdateDto } from './dto/install-update.dto';
import { UpdateSystemConfigDto } from './dto/update-config.dto';
import { SystemConfigModel } from './models/config.model';
import { OnboardingStatusModel } from './models/onboarding.model';
import {
	LogEntriesResponseModel,
	LogEntryAcceptedResponseModel,
	OnboardingStatusResponseModel,
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
import { UpdateInfoResponseModel, UpdateStatusResponseModel } from './models/update-response.model';
import { UpdateInfoModel, UpdateStatusModel } from './models/update.model';

/**
 * OpenAPI extra models for System module
 */
export const SYSTEM_SWAGGER_EXTRA_MODELS = [
	// Config models
	SystemConfigModel,
	UpdateSystemConfigDto,
	ReqInstallUpdateDto,
	// Response models
	LogEntriesResponseModel,
	LogEntryAcceptedResponseModel,
	OnboardingStatusResponseModel,
	SystemHealthResponseModel,
	SystemInfoResponseModel,
	ThrottleStatusResponseModel,
	SystemModuleLogIngestResult,
	// Onboarding models
	OnboardingStatusModel,
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
	// Update models
	UpdateInfoModel,
	UpdateStatusModel,
	UpdateInfoResponseModel,
	UpdateStatusResponseModel,
];
