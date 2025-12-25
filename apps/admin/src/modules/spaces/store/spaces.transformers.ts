import type { operations } from '../../../openapi';

import { SpaceType } from '../spaces.constants';

import type { ISpace, ISpaceCreateData, ISpaceEditData } from './spaces.store.types';

export type ApiSpace = NonNullable<operations['get-spaces-module-spaces']['responses']['200']['content']['application/json']['data']>[number];
type ApiSpaceCreate = operations['create-spaces-module-space']['requestBody']['content']['application/json']['data'];
type ApiSpaceUpdate = NonNullable<operations['update-spaces-module-space']['requestBody']>['content']['application/json']['data'];

export const transformSpaceResponse = (response: ApiSpace): ISpace => {
	return {
		id: response.id,
		name: response.name,
		description: response.description ?? null,
		type: (response.type as SpaceType) ?? SpaceType.ROOM,
		icon: response.icon ?? null,
		displayOrder: response.display_order ?? 0,
		createdAt: new Date(response.created_at),
		updatedAt: response.updated_at ? new Date(response.updated_at) : null,
		draft: false,
	};
};

export const transformSpaceCreateRequest = (data: ISpaceCreateData): ApiSpaceCreate => {
	return {
		name: data.name,
		description: data.description ?? undefined,
		type: data.type,
		icon: data.icon ?? undefined,
		display_order: data.displayOrder,
	};
};

export const transformSpaceEditRequest = (data: ISpaceEditData): ApiSpaceUpdate => {
	return {
		name: data.name,
		description: data.description,
		type: data.type,
		icon: data.icon,
		display_order: data.displayOrder,
	};
};
