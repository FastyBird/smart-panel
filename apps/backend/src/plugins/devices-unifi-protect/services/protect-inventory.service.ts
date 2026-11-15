import { Injectable } from '@nestjs/common';

import { DevicesService } from '../../../modules/devices/services/devices.service';
import { ProtectApiClient } from '../client/protect-api.client';
import { DEVICES_UNIFI_PROTECT_TYPE } from '../devices-unifi-protect.constants';
import { ProtectDeviceEntity } from '../entities/devices-unifi-protect.entity';
import { ProtectConsoleUnavailableError, ProtectDeviceNotFoundError } from '../errors/protect-adoption.error';
import { ProtectErrorCategory, toProtectApiError } from '../errors/protect-api.error';
import { evaluateProtectMapping } from '../mappings/mapping-evaluator';
import { ProtectMappingLoaderService } from '../mappings/mapping-loader.service';
import { ProtectModelKey } from '../mappings/mapping.types';
import { ProtectInventoryDeviceModel } from '../models/protect-inventory.model';

import { ProtectConnectorService, ProtectConsoleIdentity } from './protect-connector.service';

export interface ProtectInventoryEntry {
	modelKey: ProtectModelKey;
	id: string;
	raw: Readonly<Record<string, unknown>>;
}

export interface ProtectFreshDevice {
	client: ProtectApiClient;
	identity: ProtectConsoleIdentity;
	entry: ProtectInventoryEntry;
}

interface InventorySnapshot {
	identity: ProtectConsoleIdentity;
	entries: ProtectInventoryEntry[];
}

const compareText = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);

const entryName = (entry: ProtectInventoryEntry): string =>
	typeof entry.raw.name === 'string' && entry.raw.name.trim() !== '' ? entry.raw.name : entry.id;

const optionalText = (value: unknown): string | null => (typeof value === 'string' ? value : null);

@Injectable()
export class ProtectInventoryService {
	private inflight: Promise<InventorySnapshot> | null = null;

	constructor(
		private readonly connector: ProtectConnectorService,
		private readonly devicesService: DevicesService,
		private readonly mappingLoader: ProtectMappingLoaderService,
	) {}

	async findAll(): Promise<ProtectInventoryDeviceModel[]> {
		const { identity, entries } = await this.readSnapshot();
		const adopted = await this.getAdoptedByIdentifier();

		return entries.map((entry) => this.toInventoryDevice(identity, entry, adopted));
	}

	async findOne(deviceId: string): Promise<ProtectInventoryDeviceModel> {
		const { identity, entries } = await this.readSnapshot();
		const entry = entries.find((candidate) => candidate.id === deviceId);

		if (entry === undefined) {
			throw new ProtectDeviceNotFoundError();
		}

		return this.toInventoryDevice(identity, entry, await this.getAdoptedByIdentifier());
	}

	/** One by-id read on the live console; the caller decides what to do with the fresh object. */
	async fetchDevice(deviceId: string, modelKey: ProtectModelKey): Promise<ProtectFreshDevice> {
		const { client, identity } = this.requireConsole();

		try {
			const device =
				modelKey === 'camera'
					? await client.getCamera(deviceId)
					: modelKey === 'sensor'
						? await client.getSensor(deviceId)
						: await client.getLight(deviceId);

			return { client, identity, entry: { modelKey, id: device.id, raw: device.raw } };
		} catch (error) {
			throw this.translate(error);
		}
	}

	async getAdoptedByIdentifier(): Promise<Map<string, ProtectDeviceEntity>> {
		const adopted = await this.devicesService.findAll<ProtectDeviceEntity>(DEVICES_UNIFI_PROTECT_TYPE);
		const byIdentifier = new Map<string, ProtectDeviceEntity>();

		for (const device of [...adopted].sort((left, right) => compareText(left.id, right.id))) {
			if (device.identifier !== null && !byIdentifier.has(device.identifier)) {
				byIdentifier.set(device.identifier, device);
			}
		}

		return byIdentifier;
	}

	private requireConsole(): { client: ProtectApiClient; identity: ProtectConsoleIdentity } {
		const client = this.connector.getClient();
		const identity = this.connector.getConsoleIdentity();

		if (client === null || identity === null) {
			throw new ProtectConsoleUnavailableError(null);
		}

		return { client, identity };
	}

	private translate(error: unknown): Error {
		const category = toProtectApiError(error, 'system').category;

		return category === ProtectErrorCategory.NOT_FOUND
			? new ProtectDeviceNotFoundError()
			: new ProtectConsoleUnavailableError(category);
	}

	/** Concurrent callers share one set of console reads; nothing is kept once it settles. */
	private readSnapshot(): Promise<InventorySnapshot> {
		if (this.inflight !== null) {
			return this.inflight;
		}

		const { client, identity } = this.requireConsole();
		const pending: Promise<InventorySnapshot> = this.readLists(client, identity).finally(() => {
			if (this.inflight === pending) {
				this.inflight = null;
			}
		});

		this.inflight = pending;

		return pending;
	}

	private async readLists(client: ProtectApiClient, identity: ProtectConsoleIdentity): Promise<InventorySnapshot> {
		try {
			const [cameras, sensors, lights] = await Promise.all([
				client.listCameras(),
				client.listSensors(),
				client.listLights(),
			]);
			const lists: [ProtectModelKey, { id: string; raw: Record<string, unknown> }[]][] = [
				['camera', cameras],
				['sensor', sensors],
				['light', lights],
			];
			const entries: ProtectInventoryEntry[] = [];

			for (const [modelKey, items] of lists) {
				const seen = new Set<string>();
				const list: ProtectInventoryEntry[] = [];

				for (const item of items) {
					if (!seen.has(item.id)) {
						seen.add(item.id);
						list.push({ modelKey, id: item.id, raw: item.raw });
					}
				}

				list.sort((left, right) => compareText(entryName(left), entryName(right)) || compareText(left.id, right.id));
				entries.push(...list);
			}

			return { identity, entries };
		} catch (error) {
			throw new ProtectConsoleUnavailableError(toProtectApiError(error, 'system').category);
		}
	}

	private toInventoryDevice(
		identity: ProtectConsoleIdentity,
		entry: ProtectInventoryEntry,
		adopted: Map<string, ProtectDeviceEntity>,
	): ProtectInventoryDeviceModel {
		const result = evaluateProtectMapping(this.mappingLoader.getMappings(), {
			nvr: { id: identity.nvrId, macKey: identity.nvrMacKey },
			modelKey: entry.modelKey,
			device: entry.raw,
			streams: null,
		});
		const mapped = 'device' in result ? result.device : null;
		const identifier = mapped?.identifier ?? `${identity.nvrMacKey}:${entry.id}`;
		const state = optionalText(entry.raw.state) ?? 'UNKNOWN';
		const model = new ProtectInventoryDeviceModel();

		model.id = entry.id;
		model.modelKey = entry.modelKey;
		model.name = mapped?.name ?? entryName(entry);
		model.model = optionalText(entry.raw.type);
		model.mac = optionalText(entry.raw.mac);
		model.state = state;
		model.connected = state === 'CONNECTED';
		model.supported = mapped !== null;
		model.mappingName = mapped?.mappingName ?? null;
		model.suggestedCategory = mapped?.category ?? null;
		model.identifier = identifier;
		model.adopted = adopted.has(identifier);
		model.adoptedDeviceId = adopted.get(identifier)?.id ?? null;

		return model;
	}
}
