import { HomeyAPI } from 'homey-api';

import { Injectable } from '@nestjs/common';

export type HomeySdkEventListener = (...arguments_: unknown[]) => Promise<void> | void;

export interface HomeySdkEventSource {
	on(event: string, listener: HomeySdkEventListener): unknown;
	off?(event: string, listener: HomeySdkEventListener): unknown;
}

export interface HomeySdkOperationOptions {
	readonly $cache?: boolean;
	readonly $timeout?: number;
	readonly $updateCache?: boolean;
}

export interface HomeySdkDevice extends HomeySdkEventSource {
	readonly id: string;
	readonly available?: unknown;
	connect(): Promise<void>;
	disconnect(): Promise<void>;
}

export interface HomeySdkDevicesManager extends HomeySdkEventSource {
	connect(): Promise<void>;
	disconnect(): Promise<void>;
	getDevices(options?: HomeySdkOperationOptions): Promise<Record<string, HomeySdkDevice>>;
	getDevice(options: HomeySdkOperationOptions & { id: string }): Promise<HomeySdkDevice>;
	setCapabilityValue(
		options: HomeySdkOperationOptions & {
			capabilityId: string;
			deviceId: string;
			value: unknown;
		},
	): Promise<unknown>;
}

export interface HomeySdkZonesManager extends HomeySdkEventSource {
	connect(): Promise<void>;
	disconnect(): Promise<void>;
	getZones(options?: HomeySdkOperationOptions): Promise<Record<string, unknown>>;
}

export interface HomeySdkSystemManager {
	getInfo(options?: HomeySdkOperationOptions): Promise<unknown>;
}

export interface HomeySdkClient {
	readonly id: string | null;
	readonly name: string | null;
	readonly version: string | null;
	readonly devices: HomeySdkDevicesManager;
	readonly system: HomeySdkSystemManager;
	readonly zones: HomeySdkZonesManager;
	disconnect(): Promise<void>;
	destroy(): void;
}

export interface HomeySdkClientFactory {
	createLocalApi(options: { address: string; token: string }): Promise<HomeySdkClient>;
}

@Injectable()
export class HomeySdkClientFactoryService implements HomeySdkClientFactory {
	async createLocalApi(options: { address: string; token: string }): Promise<HomeySdkClient> {
		return (await HomeyAPI.createLocalAPI({
			address: options.address,
			token: options.token,
			debug: null,
		})) as HomeySdkClient;
	}
}
