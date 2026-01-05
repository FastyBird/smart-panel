import type { Ref } from 'vue';

import type { IntentOrigin, IntentStatus, IntentTargetStatus, IntentType } from '../intents.constants';

export interface IIntentTarget {
	deviceId: string | null;
	channelId: string | null;
	propertyId: string | null;
	sceneId: string | null;
}

export interface IIntentTargetResult {
	deviceId: string | null;
	channelId: string | null;
	propertyId: string | null;
	sceneId: string | null;
	status: IntentTargetStatus;
	error: string | null;
}

export interface IIntentScope {
	spaceId: string | null;
}

export interface IIntentContext {
	origin: IntentOrigin | null;
	displayId: string | null;
	spaceId: string | null;
	roleKey: string | null;
}

export interface IIntent {
	id: string;
	requestId: string | null;
	type: IntentType;
	scope: IIntentScope;
	context: IIntentContext;
	targets: IIntentTarget[];
	value: unknown;
	status: IntentStatus;
	ttlMs: number;
	createdAt: Date;
	expiresAt: Date;
	completedAt: Date | null;
	results: IIntentTargetResult[] | null;
}

export interface IIntentsStateSemaphore {
	fetching: boolean;
}

export interface IIntentsStoreState {
	data: Ref<Map<IIntent['id'], IIntent>>;
	semaphore: Ref<IIntentsStateSemaphore>;
}

export interface IIntentsSetActionPayload {
	id: IIntent['id'];
	data: Partial<IIntent>;
}

export interface IIntentsUnsetActionPayload {
	id: IIntent['id'];
}

export interface IIntentsOnEventActionPayload {
	id: IIntent['id'];
	data: Record<string, unknown>;
}

export interface IIntentsStoreActions {
	findAll: () => IIntent[];
	findById: (id: IIntent['id']) => IIntent | null;
	findPending: () => IIntent[];
	onEvent: (payload: IIntentsOnEventActionPayload) => IIntent;
	set: (payload: IIntentsSetActionPayload) => IIntent;
	unset: (payload: IIntentsUnsetActionPayload) => void;
	clear: () => void;
}
