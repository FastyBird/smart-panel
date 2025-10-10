import type { ComputedRef, Ref } from 'vue';

import type { Emitter, Handler } from 'mitt';
import type { Client } from 'openapi-fetch';
import type { Socket } from 'socket.io-client';

import type { paths } from '../../openapi';
import type { Events } from '../services/event-bus';
import type { ISortEntry } from '../store/list.query.store.types';

export interface IUseBackend<Paths extends object = paths> {
	pendingRequests: Ref<number>;
	client: Client<Paths>;
}

export interface IUseBreakpoints {
	isXSDevice: ComputedRef<boolean>;
	isSMDevice: ComputedRef<boolean>;
	isMDDevice: ComputedRef<boolean>;
	isLGDevice: ComputedRef<boolean>;
	isXLDevice: ComputedRef<boolean>;
	isXXLDevice: ComputedRef<boolean>;
}

export interface IUseDarkMode {
	isDark: ComputedRef<boolean>;
	toggleDark: (mode?: boolean) => boolean;
}

export interface IUseEventBus {
	eventBus: Emitter<Events>;
	register: <Key extends keyof Events>(event: Key, listener: Handler<Events[Key]>) => void;
	unregister: <Key extends keyof Events>(event: Key, listener: Handler<Events[Key]>) => void;
	emit: <Key extends keyof Events>(event: Key, payload: Events[Key]) => void;
}

export interface IUseFlashMessage {
	success: (message: string) => void;
	info: (message: string) => void;
	error: (message: string) => void;
	exception: (errorMessage: string) => void;
}

export interface IUseListQuery<F> {
	filters: Ref<F>;
	sort: Ref<ISortEntry[]>;
	pagination: Ref<{ page?: number; size?: number }>;
	reset: () => void;
}

export interface IUseSockets {
	sockets: Socket;
	connected: ComputedRef<boolean>;
	active: ComputedRef<boolean>;
	sendCommand: <Payload extends object>(event: string, payload: Payload | null, handler: string) => Promise<true | string>;
}

export interface IUseUuid {
	generate: () => string;
	validate: (uuid: string) => boolean;
}
