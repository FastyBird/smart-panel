import type { Ref } from 'vue';

import type { ExtensionKind } from '../extensions.constants';

export interface IExtensionLinks {
	documentation?: string;
	devDocumentation?: string;
	bugsTracking?: string;
	repository?: string;
	homepage?: string;
}

export interface IExtension {
	type: string;
	kind: ExtensionKind;
	name: string;
	description?: string;
	version?: string;
	author?: string;
	readme?: string;
	docs?: string;
	enabled: boolean;
	isCore: boolean;
	canToggleEnabled: boolean;
	links?: IExtensionLinks;
}

export type { ExtensionsModuleExtensionSchema as IExtensionRes } from '../../../openapi.constants';

export interface IExtensionsStateSemaphore {
	fetching: {
		items: boolean;
		item: string[];
	};
	updating: string[];
}

export interface IExtensionsStoreState {
	semaphore: Ref<IExtensionsStateSemaphore>;
	firstLoad: Ref<boolean>;
	data: Ref<{ [key: IExtension['type']]: IExtension }>;
}

export interface IExtensionsFetchActionPayload {
	kind?: ExtensionKind;
}

export interface IExtensionsGetActionPayload {
	type: IExtension['type'];
}

export interface IExtensionsSetActionPayload {
	type: IExtension['type'];
	data: IExtension;
}

export interface IExtensionsUpdateActionPayload {
	type: IExtension['type'];
	data: {
		enabled: boolean;
	};
}

export interface IExtensionsBulkSetEnabledActionPayload {
	types: IExtension['type'][];
	enabled: boolean;
}

export interface IExtensionsBulkResult {
	// Extensions are keyed by type rather than by a generated id, so the shared
	// bulk result reports those types in its identifier field.
	succeeded: IExtension['type'][];
	failed: { id: IExtension['type']; reason: string }[];
}

export interface IExtensionsStoreActions {
	firstLoadFinished: () => boolean;
	getting: (type: IExtension['type']) => boolean;
	fetching: () => boolean;
	findAll: () => IExtension[];
	findByKind: (kind: ExtensionKind) => IExtension[];
	findByType: (type: IExtension['type']) => IExtension | null;
	set: (payload: IExtensionsSetActionPayload) => IExtension;
	get: (payload: IExtensionsGetActionPayload) => Promise<IExtension>;
	fetch: (payload?: IExtensionsFetchActionPayload) => Promise<IExtension[]>;
	update: (payload: IExtensionsUpdateActionPayload) => Promise<IExtension>;
	bulkSetEnabled: (payload: IExtensionsBulkSetEnabledActionPayload) => Promise<IExtensionsBulkResult>;
}

export type ExtensionsStoreSetup = IExtensionsStoreState & IExtensionsStoreActions;
