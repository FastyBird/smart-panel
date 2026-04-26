import type { operations } from '../../../openapi';
import {
	SpacesModuleCreateSpaceCategory,
	SpacesModuleCreateSpaceType,
} from '../../../openapi.constants';

import { type IStatusWidget, type SpaceRoomCategory, SpaceType, type SpaceZoneCategory } from '../spaces.constants';

import type { ISpace, ISpaceCreateData, ISpaceEditData } from './spaces.store.types';

// The spaces endpoint returns the flat base `SpacesModuleDataSpace` shape.
// Home-control-specific fields (category / suggestions_enabled / status_widgets)
// now live on the `SpacesModuleDataRoomSpace` / `SpacesModuleDataZoneSpace`
// subtype schemas but OpenAPI doesn't emit a discriminated response union.
// Widen `ApiSpace` here so the transformer reads (and tests construct) those
// optional fields without casting at every call site.
type BaseApiSpace = NonNullable<operations['get-spaces-module-spaces']['responses']['200']['content']['application/json']['data']>[number];
export type ApiSpace = BaseApiSpace & {
	category?: SpacesModuleCreateSpaceCategory | null;
	suggestions_enabled?: boolean | null;
	status_widgets?: ApiStatusWidget[] | null;
};
// Create / Update payloads are also modeled after the base DTOs; widen them
// to optionally carry the home-control subtype fields so the transformer can
// emit a single payload type regardless of the target space type. The backend
// validates under forbidNonWhitelisted using the per-type DTO, so dead fields
// still get rejected there.
type BaseApiSpaceCreate = operations['create-spaces-module-space']['requestBody']['content']['application/json']['data'];
type ApiSpaceCreate = BaseApiSpaceCreate & {
	category?: SpacesModuleCreateSpaceCategory | null;
	suggestions_enabled?: boolean;
	status_widgets?: ApiStatusWidget[] | null;
};
type BaseApiSpaceUpdate = NonNullable<operations['update-spaces-module-space']['requestBody']>['content']['application/json']['data'];
type ApiSpaceUpdate = BaseApiSpaceUpdate & {
	category?: SpacesModuleCreateSpaceCategory | null;
	suggestions_enabled?: boolean;
	status_widgets?: ApiStatusWidget[] | null;
};

export const apiTypeToSpaceType = (apiType: SpacesModuleCreateSpaceType): SpaceType => {
	switch (apiType) {
		case SpacesModuleCreateSpaceType.room:
			return SpaceType.ROOM;
		case SpacesModuleCreateSpaceType.zone:
			return SpaceType.ZONE;
		case SpacesModuleCreateSpaceType.master:
			return SpaceType.MASTER;
		case SpacesModuleCreateSpaceType.entry:
			return SpaceType.ENTRY;
		case SpacesModuleCreateSpaceType.signage_info_panel:
			return SpaceType.SIGNAGE_INFO_PANEL;
		default:
			return SpaceType.ROOM;
	}
};

export const spaceTypeToApiType = (spaceType: SpaceType | undefined): SpacesModuleCreateSpaceType => {
	switch (spaceType) {
		case SpaceType.ROOM:
			return SpacesModuleCreateSpaceType.room;
		case SpaceType.ZONE:
			return SpacesModuleCreateSpaceType.zone;
		case SpaceType.MASTER:
			return SpacesModuleCreateSpaceType.master;
		case SpaceType.ENTRY:
			return SpacesModuleCreateSpaceType.entry;
		case SpaceType.SIGNAGE_INFO_PANEL:
			return SpacesModuleCreateSpaceType.signage_info_panel;
		default:
			return SpacesModuleCreateSpaceType.room;
	}
};

const apiCategoryToSpaceCategory = (apiCategory: SpacesModuleCreateSpaceCategory | null | undefined): SpaceRoomCategory | SpaceZoneCategory | null => {
	if (!apiCategory) return null;
	// API category values match SpaceRoomCategory/SpaceZoneCategory values (both are snake_case strings)
	return apiCategory as unknown as SpaceRoomCategory | SpaceZoneCategory;
};

const spaceCategoryToApiCategory = (
	category: SpaceRoomCategory | SpaceZoneCategory | null | undefined
): SpacesModuleCreateSpaceCategory | null | undefined => {
	if (category === undefined) return undefined;
	if (category === null) return null;
	// SpaceRoomCategory/SpaceZoneCategory values match API category values (both are snake_case strings)
	return category as unknown as SpacesModuleCreateSpaceCategory;
};

// `status_widgets` lives on home-control subtype schemas only. The base
// `ApiSpace` no longer types it, so accept an unknown-ish shape here and
// defensively pluck the fields we render.
type ApiStatusWidget = {
	type: string;
	order: number;
	settings: { range?: string; show_production?: boolean };
};

const transformApiStatusWidgets = (
	apiWidgets: ApiStatusWidget[] | null | undefined,
): IStatusWidget[] | null => {
	if (!apiWidgets || !Array.isArray(apiWidgets)) return null;

	return apiWidgets.map((widget) => ({
		type: widget.type,
		order: widget.order,
		settings: {
			...(widget.settings.range !== undefined ? { range: widget.settings.range } : {}),
			...(widget.settings.show_production !== undefined
				? { showProduction: widget.settings.show_production }
				: {}),
		},
	}));
};

const transformStatusWidgetsToApi = (
	widgets: IStatusWidget[] | null | undefined,
): Record<string, unknown>[] | null | undefined => {
	if (widgets === undefined) return undefined;
	if (widgets === null) return null;

	return widgets.map((widget) => ({
		type: widget.type,
		order: widget.order,
		settings: {
			...(widget.settings.range !== undefined ? { range: widget.settings.range } : {}),
			...(widget.settings.showProduction !== undefined
				? { show_production: widget.settings.showProduction }
				: {}),
		},
	}));
};

export const transformSpaceResponse = (response: ApiSpace): ISpace => {
	// `category`, `suggestions_enabled`, and `status_widgets` are home-control-
	// specific (rooms/zones only). They live on the `SpacesModuleDataRoomSpace`
	// / `...ZoneSpace` subtype schemas rather than the flat `ApiSpace` base;
	// `ApiSpace` is declared above with those fields as optional so the
	// transformer simply reads them and falls back when absent (master / entry
	// / signage responses).
	return {
		id: response.id,
		name: response.name,
		description: response.description ?? null,
		type: apiTypeToSpaceType(response.type),
		category: apiCategoryToSpaceCategory(response.category ?? undefined),
		icon: response.icon ?? null,
		displayOrder: response.display_order ?? 0,
		parentId: response.parent_id ?? null,
		suggestionsEnabled: response.suggestions_enabled ?? true,
		statusWidgets: transformApiStatusWidgets(response.status_widgets),
		createdAt: new Date(response.created_at),
		updatedAt: response.updated_at ? new Date(response.updated_at) : null,
		draft: false,
	};
};

// `category`, `suggestions_enabled`, and `status_widgets` are home-control-
// specific; the backend's `CreateHomeControlSpaceDto` / `UpdateHomeControlSpaceDto`
// whitelist them, while master / entry / signage DTOs reject them under
// `forbidNonWhitelisted`. The shared `useSpaceEditForm` /
// `useSpaceAddForm` composables ALWAYS populate these fields on the model
// (they're declared on `ISpaceEditData` / `ISpaceCreateData` as optional
// but the form always emits them), so a presence-only check (`'category' in
// data`) sends `category: null` plus `suggestions_enabled: true` plus
// `status_widgets: null` even for a master/entry/signage edit — and the
// per-type validator 422s the request before any update happens.
//
// Gate by target `SpaceType` instead. Only ROOM and ZONE accept these
// fields; everything else (MASTER, ENTRY, SIGNAGE_INFO_PANEL) drops them
// regardless of what the form populated.
const isHomeControlSpaceType = (type: SpaceType | undefined): boolean =>
	type === SpaceType.ROOM || type === SpaceType.ZONE;

export const transformSpaceCreateRequest = (data: ISpaceCreateData): ApiSpaceCreate => {
	const payload: Record<string, unknown> = {
		name: data.name,
		description: data.description ?? undefined,
		type: spaceTypeToApiType(data.type),
		icon: data.icon ?? undefined,
		display_order: data.displayOrder,
		parent_id: data.parentId ?? undefined,
	};

	if (isHomeControlSpaceType(data.type)) {
		if ('category' in data) {
			payload.category = spaceCategoryToApiCategory(data.category) ?? undefined;
		}
		if ('suggestionsEnabled' in data) {
			payload.suggestions_enabled = data.suggestionsEnabled;
		}
		if ('statusWidgets' in data) {
			payload.status_widgets = transformStatusWidgetsToApi(data.statusWidgets);
		}
	}

	return payload as ApiSpaceCreate;
};

export const transformSpaceEditRequest = (data: ISpaceEditData): ApiSpaceUpdate => {
	const baseData: Record<string, unknown> = {
		name: data.name,
		description: data.description,
		type: spaceTypeToApiType(data.type),
		icon: data.icon,
		display_order: data.displayOrder,
	};

	if (isHomeControlSpaceType(data.type)) {
		if ('category' in data) {
			// Category supports null to clear the value - cast needed as OpenAPI
			// types don't reflect this even on the home-control subtype schemas.
			baseData.category = spaceCategoryToApiCategory(data.category) as SpacesModuleCreateSpaceCategory | undefined;
		}
		if ('suggestionsEnabled' in data) {
			baseData.suggestions_enabled = data.suggestionsEnabled;
		}
		if ('statusWidgets' in data) {
			baseData.status_widgets = transformStatusWidgetsToApi(data.statusWidgets);
		}
	}

	// Parent zone assignment - explicitly include null to unassign.
	// (Not home-control-gated: every space type accepts a parent.)
	if ('parentId' in data) {
		baseData.parent_id = data.parentId ?? null;
	}

	return baseData as ApiSpaceUpdate;
};
