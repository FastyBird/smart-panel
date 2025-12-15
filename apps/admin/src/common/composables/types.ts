import type { ComputedRef, Ref } from 'vue';

import type { LogObject } from 'consola';
import type { Emitter, Handler } from 'mitt';
import type { Client } from 'openapi-fetch';
import type { Socket } from 'socket.io-client';

import type { OpenApiPaths } from '../../openapi.constants';
import type { Events } from '../services/event-bus';
import type { ISortEntry } from '../store/list.query.store.types';

export interface IUseBackend<Paths extends object = OpenApiPaths> {
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

export interface IFlashMessageOptions {
	duration?: number; // Duration in milliseconds. 0 means it won't close automatically
}

export interface IUseFlashMessage {
	success: (message: string, options?: IFlashMessageOptions) => void;
	info: (message: string, options?: IFlashMessageOptions) => void;
	error: (message: string, options?: IFlashMessageOptions) => void;
	warning: (message: string, options?: IFlashMessageOptions) => void;
	exception: (errorMessage: string, options?: IFlashMessageOptions) => void;
}

export interface IUseListQuery<F> {
	filters: Ref<F>;
	sort: Ref<ISortEntry[]>;
	pagination: Ref<{ page?: number; size?: number }>;
	reset: () => void;
}

export interface IUseLogger {
	log(message: string, ...meta: ReadonlyArray<unknown>): void;
	info(message: string, ...meta: ReadonlyArray<unknown>): void;
	warn(message: string, ...meta: ReadonlyArray<unknown>): void;
	error(error: Error, ...meta: ReadonlyArray<unknown>): void;
	error(message: string, ...meta: ReadonlyArray<unknown>): void;
	error(object: LogObject): void;
	fatal(error: Error, ...meta: ReadonlyArray<unknown>): void;
	fatal(message: string, ...meta: ReadonlyArray<unknown>): void;
	fatal(object: LogObject): void;
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
