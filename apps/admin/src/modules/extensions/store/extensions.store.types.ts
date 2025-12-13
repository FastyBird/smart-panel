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
	enabled: boolean;
	isCore: boolean;
	links?: IExtensionLinks;
}

export interface IExtensionRes {
	type: string;
	kind: string;
	name: string;
	description?: string;
	version?: string;
	author?: string;
	enabled: boolean;
	is_core: boolean;
	links?: {
		documentation?: string;
		dev_documentation?: string;
		bugs_tracking?: string;
		repository?: string;
		homepage?: string;
	};
}

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
}

export type ExtensionsStoreSetup = IExtensionsStoreState & IExtensionsStoreActions;
