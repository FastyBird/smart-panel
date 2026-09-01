import type { Ref } from 'vue';

import type {
	ExtensionsModuleServiceActivationPolicy,
	ExtensionsModuleServiceDesiredState,
	ExtensionsModuleServiceOwnerKind,
	ExtensionsModuleServiceState,
} from '../../../openapi.constants';

export interface IService {
	extensionKind: ExtensionsModuleServiceOwnerKind;
	extensionType: string;
	serviceId: string;
	activationPolicy: ExtensionsModuleServiceActivationPolicy;
	state: ExtensionsModuleServiceState;
	desiredState: ExtensionsModuleServiceDesiredState;
	enabled: boolean;
	healthy?: boolean;
	lastStartedAt?: string;
	lastStoppedAt?: string;
	lastError?: string;
	startCount: number;
	uptimeMs?: number;
}

export type { ExtensionsModuleServiceStatusSchema as IServiceRes } from '../../../openapi.constants';

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
	extensionKind: ExtensionsModuleServiceOwnerKind;
	extensionType: string;
	serviceId: string;
}

export interface IServicesSetActionPayload {
	extensionKind: ExtensionsModuleServiceOwnerKind;
	extensionType: string;
	serviceId: string;
	data: IService;
}

export interface IServicesStartActionPayload {
	extensionKind: ExtensionsModuleServiceOwnerKind;
	extensionType: string;
	serviceId: string;
}

export interface IServicesStopActionPayload {
	extensionKind: ExtensionsModuleServiceOwnerKind;
	extensionType: string;
	serviceId: string;
}

export interface IServicesRestartActionPayload {
	extensionKind: ExtensionsModuleServiceOwnerKind;
	extensionType: string;
	serviceId: string;
}

export interface IServicesStoreActions {
	firstLoadFinished: () => boolean;
	getting: (extensionKind: ExtensionsModuleServiceOwnerKind, extensionType: string, serviceId: string) => boolean;
	fetching: () => boolean;
	acting: (extensionKind: ExtensionsModuleServiceOwnerKind, extensionType: string, serviceId: string) => boolean;
	findAll: () => IService[];
	findByKey: (extensionKind: ExtensionsModuleServiceOwnerKind, extensionType: string, serviceId: string) => IService | null;
	set: (payload: IServicesSetActionPayload) => IService;
	get: (payload: IServicesGetActionPayload) => Promise<IService>;
	fetch: (payload?: IServicesFetchActionPayload) => Promise<IService[]>;
	start: (payload: IServicesStartActionPayload) => Promise<IService>;
	stop: (payload: IServicesStopActionPayload) => Promise<IService>;
	restart: (payload: IServicesRestartActionPayload) => Promise<IService>;
}

export type ServicesStoreSetup = IServicesStoreState & IServicesStoreActions;

export const getServiceKey = (
	extensionKind: ExtensionsModuleServiceOwnerKind,
	extensionType: string,
	serviceId: string,
): string => `${extensionKind}:${extensionType}:${serviceId}`;
