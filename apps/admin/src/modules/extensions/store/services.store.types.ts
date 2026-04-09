import type { Ref } from 'vue';

import type { ExtensionsModuleServiceState } from '../../../openapi.constants';

export interface IService {
	pluginName: string;
	serviceId: string;
	state: ExtensionsModuleServiceState;
	enabled: boolean;
	healthy?: boolean;
	lastStartedAt?: string;
	lastStoppedAt?: string;
	lastError?: string;
	startCount: number;
	uptimeMs?: number;
}

export interface IServiceRes {
	plugin_name: string;
	service_id: string;
	state: string;
	enabled: boolean;
	healthy?: boolean;
	last_started_at?: string;
	last_stopped_at?: string;
	last_error?: string;
	start_count: number;
	uptime_ms?: number;
}

export interface IServicesStateSemaphore {
	fetching: {
		items: boolean;
		item: string[];
	};
	acting: string[];
}

export interface IServicesStoreState {
	semaphore: Ref<IServicesStateSemaphore>;
	firstLoad: Ref<boolean>;
	data: Ref<{ [key: string]: IService }>;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface IServicesFetchActionPayload {
	// No payload needed for fetching all services
}

export interface IServicesGetActionPayload {
	pluginName: string;
	serviceId: string;
}

export interface IServicesSetActionPayload {
	pluginName: string;
	serviceId: string;
	data: IService;
}

export interface IServicesStartActionPayload {
	pluginName: string;
	serviceId: string;
}

export interface IServicesStopActionPayload {
	pluginName: string;
	serviceId: string;
}

export interface IServicesRestartActionPayload {
	pluginName: string;
	serviceId: string;
}

export interface IServicesStoreActions {
	firstLoadFinished: () => boolean;
	getting: (pluginName: string, serviceId: string) => boolean;
	fetching: () => boolean;
	acting: (pluginName: string, serviceId: string) => boolean;
	findAll: () => IService[];
	findByKey: (pluginName: string, serviceId: string) => IService | null;
	set: (payload: IServicesSetActionPayload) => IService;
	get: (payload: IServicesGetActionPayload) => Promise<IService>;
	fetch: (payload?: IServicesFetchActionPayload) => Promise<IService[]>;
	start: (payload: IServicesStartActionPayload) => Promise<IService>;
	stop: (payload: IServicesStopActionPayload) => Promise<IService>;
	restart: (payload: IServicesRestartActionPayload) => Promise<IService>;
}

export type ServicesStoreSetup = IServicesStoreState & IServicesStoreActions;

export const getServiceKey = (pluginName: string, serviceId: string): string => `${pluginName}:${serviceId}`;
