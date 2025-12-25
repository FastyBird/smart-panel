import type { operations } from '../../../openapi';
import { SpacesModuleCreateSpaceType } from '../../../openapi';

import { SpaceType } from '../spaces.constants';

import type { ISpace, ISpaceCreateData, ISpaceEditData } from './spaces.store.types';

export type ApiSpace = NonNullable<operations['get-spaces-module-spaces']['responses']['200']['content']['application/json']['data']>[number];
type ApiSpaceCreate = operations['create-spaces-module-space']['requestBody']['content']['application/json']['data'];
type ApiSpaceUpdate = NonNullable<operations['update-spaces-module-space']['requestBody']>['content']['application/json']['data'];

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

const spaceTypeToApiType = (spaceType: SpaceType | undefined): SpacesModuleCreateSpaceType | undefined => {
	if (!spaceType) return undefined;
	switch (spaceType) {
		case SpaceType.ROOM:
			return SpacesModuleCreateSpaceType.room;
		case SpaceType.ZONE:
			return SpacesModuleCreateSpaceType.zone;
		default:
			return SpacesModuleCreateSpaceType.room;
	}
};

export const transformSpaceResponse = (response: ApiSpace): ISpace => {
	return {
		id: response.id,
		name: response.name,
		description: response.description ?? null,
		type: apiTypeToSpaceType(response.type),
		icon: response.icon ?? null,
		displayOrder: response.display_order ?? 0,
		primaryThermostatId: response.primary_thermostat_id ?? null,
		primaryTemperatureSensorId: response.primary_temperature_sensor_id ?? null,
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
		icon: data.icon ?? undefined,
		display_order: data.displayOrder,
		primary_thermostat_id: data.primaryThermostatId ?? undefined,
		primary_temperature_sensor_id: data.primaryTemperatureSensorId ?? undefined,
	};
};

export const transformSpaceEditRequest = (data: ISpaceEditData): ApiSpaceUpdate => {
	return {
		name: data.name,
		description: data.description,
		type: spaceTypeToApiType(data.type),
		icon: data.icon,
		display_order: data.displayOrder,
		primary_thermostat_id: data.primaryThermostatId,
		primary_temperature_sensor_id: data.primaryTemperatureSensorId,
	};
};
