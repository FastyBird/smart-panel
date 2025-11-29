/**
 * OpenAPI transformations and extra models for System module
 */
import { Type } from '@nestjs/common';

import { openApiTransformRegistry } from '../api/decorators/openapi-transform.decorator';

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
import { SYSTEM_MODULE_PREFIX } from './system.constants';

// Register transformations when this module is loaded
openApiTransformRegistry.register((document) => {
	// Fix path parameter names to match original spec
	const assetPath = `/${SYSTEM_MODULE_PREFIX}/extensions/assets/{pkg}/{path}`;
	if (document.paths && typeof document.paths === 'object') {
		const paths = document.paths as Record<string, unknown>;
		if (paths[assetPath]) {
			const pathItem = paths[assetPath] as Record<string, unknown>;
			// Rename path to asset_path in all operations
			for (const method of ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const) {
				if ((pathItem[method] as { parameters?: Array<{ in?: string; name?: string }> })?.parameters) {
					for (const param of (pathItem[method] as { parameters?: Array<{ in?: string; name?: string }> }).parameters ||
						[]) {
						if (param.in === 'path' && param.name === 'path') {
							param.name = 'asset_path';
						}
					}
				}
			}
			// Also rename the path itself
			const assetPathWithAssetPath = `/${SYSTEM_MODULE_PREFIX}/extensions/assets/{pkg}/{asset_path}`;
			paths[assetPathWithAssetPath] = paths[assetPath];
			delete paths[assetPath];
		}
	}
});

/**
 * OpenAPI extra models for System module
 */
export const SYSTEM_SWAGGER_EXTRA_MODELS: Type<any>[] = [
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
