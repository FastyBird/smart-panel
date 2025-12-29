import type { operations } from '../../../openapi';
import {
	SpacesModuleCreateSpaceCategory,
	SpacesModuleCreateSpaceType,
	SpacesModuleDataSpaceCategory,
} from '../../../openapi';

import { SpaceCategory, SpaceType } from '../spaces.constants';

import type { ISpace, ISpaceCreateData, ISpaceEditData } from './spaces.store.types';

export type ApiSpace = NonNullable<operations['get-spaces-module-spaces']['responses']['200']['content']['application/json']['data']>[number];
type ApiSpaceCreate = operations['create-spaces-module-space']['requestBody']['content']['application/json']['data'];
type ApiSpaceUpdate = NonNullable<operations['update-spaces-module-space']['requestBody']>['content']['application/json']['data'];

// Union type for API category (covers both response and request types)
type ApiSpaceCategory = SpacesModuleCreateSpaceCategory | SpacesModuleDataSpaceCategory;

const apiTypeToSpaceType = (apiType: SpacesModuleCreateSpaceType): SpaceType => {
	switch (apiType) {
		case SpacesModuleCreateSpaceType.room:
			return SpaceType.ROOM;
		case SpacesModuleCreateSpaceType.zone:
			return SpaceType.ZONE;
		default:
			return SpaceType.ROOM;
	}
};

const spaceTypeToApiType = (spaceType: SpaceType | undefined): SpacesModuleCreateSpaceType => {
	switch (spaceType) {
		case SpaceType.ROOM:
			return SpacesModuleCreateSpaceType.room;
		case SpaceType.ZONE:
			return SpacesModuleCreateSpaceType.zone;
		default:
			return SpacesModuleCreateSpaceType.room;
	}
};

const apiCategoryToSpaceCategory = (apiCategory: ApiSpaceCategory | null | undefined): SpaceCategory | null => {
	if (!apiCategory) return null;
	// API category values match SpaceCategory values (both are snake_case strings)
	return apiCategory as unknown as SpaceCategory;
};

const spaceCategoryToApiCategory = (
	category: SpaceCategory | null | undefined
): SpacesModuleCreateSpaceCategory | null | undefined => {
	if (category === undefined) return undefined;
	if (category === null) return null;
	// SpaceCategory values match API category values (both are snake_case strings)
	return category as unknown as SpacesModuleCreateSpaceCategory;
};

export const transformSpaceResponse = (response: ApiSpace): ISpace => {
	return {
		id: response.id,
		name: response.name,
		description: response.description ?? null,
		type: apiTypeToSpaceType(response.type),
		category: apiCategoryToSpaceCategory(response.category),
		icon: response.icon ?? null,
		displayOrder: response.display_order ?? 0,
		parentId: response.parent_id ?? null,
		primaryThermostatId: response.primary_thermostat_id ?? null,
		primaryTemperatureSensorId: response.primary_temperature_sensor_id ?? null,
		suggestionsEnabled: response.suggestions_enabled ?? true,
		createdAt: new Date(response.created_at),
		updatedAt: response.updated_at ? new Date(response.updated_at) : null,
		draft: false,
	};
};

export const transformSpaceCreateRequest = (data: ISpaceCreateData): ApiSpaceCreate => {
	return {
		name: data.name,
		description: data.description ?? undefined,
		type: spaceTypeToApiType(data.type),
		category: spaceCategoryToApiCategory(data.category) ?? undefined,
		icon: data.icon ?? undefined,
		display_order: data.displayOrder,
		parent_id: data.parentId ?? undefined,
		primary_thermostat_id: data.primaryThermostatId ?? undefined,
		primary_temperature_sensor_id: data.primaryTemperatureSensorId ?? undefined,
		suggestions_enabled: data.suggestionsEnabled,
	};
};

export const transformSpaceEditRequest = (data: ISpaceEditData): ApiSpaceUpdate => {
	return {
		name: data.name,
		description: data.description,
		type: spaceTypeToApiType(data.type),
		// Category supports null to clear the value - cast needed as OpenAPI types don't reflect this
		category: spaceCategoryToApiCategory(data.category) as SpacesModuleCreateSpaceCategory | undefined,
		icon: data.icon,
		display_order: data.displayOrder,
		parent_id: data.parentId,
		primary_thermostat_id: data.primaryThermostatId,
		primary_temperature_sensor_id: data.primaryTemperatureSensorId,
		suggestions_enabled: data.suggestionsEnabled,
	};
};
