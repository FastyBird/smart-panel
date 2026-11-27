import { randomUUID } from 'node:crypto';
import { IsNull, Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { DeviceCreationContext } from '../../../modules/devices/services/device-creation-context';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DEVICES_SHELLY_V1_TYPE } from '../devices-shelly-v1.constants';
import { DevicesShellyV1ValidationException } from '../devices-shelly-v1.exceptions';
import { CreateShellyV1DeviceDto } from '../dto/create-device.dto';
import { UpdateShellyV1DeviceDto } from '../dto/update-device.dto';
import { ShellyV1DeviceEntity } from '../entities/devices-shelly-v1.entity';
import { ShellyV1AdoptedIdentityEntity } from '../entities/shelly-v1-adopted-identity.entity';
import type { ShellyInfoResponse } from '../interfaces/shelly-http.interface';

export function shellyV1Address(identifier: string | null | undefined): string | null {
	const suffix = identifier?.split('-').at(-1)?.toUpperCase();
	return suffix && /^(?:[0-9A-F]{6}|[0-9A-F]{12})$/.test(suffix) ? suffix : null;
}

export function shellyV1PinMatches(identifier: string | null | undefined, mac: string): boolean {
	const address = shellyV1Address(identifier);
	return !!address && typeof mac === 'string' && /^[0-9A-F]{12}$/.test(mac) && mac.endsWith(address);
}

export function shellyV1AdoptionState(
	device: Pick<ShellyV1DeviceEntity, 'id' | 'identifier' | 'hostname'>,
	pin: Pick<ShellyV1AdoptedIdentityEntity, 'mac' | 'verifiedHost' | 'revision'> | null,
) {
	return {
		id: device.id,
		identifier: device.identifier,
		hostname: device.hostname,
		pin: pin && { mac: pin.mac, verifiedHost: pin.verifiedHost, revision: pin.revision },
	};
}

export type ShellyV1AdoptionState = ReturnType<typeof shellyV1AdoptionState>;

export function shellyV1ReportedMac(
	identifier: string,
	type: string,
	info: Pick<ShellyInfoResponse, 'mac' | 'type'> | null | undefined,
): string | null {
	const mac = typeof info?.mac === 'string' ? info.mac.toUpperCase() : null;
	return mac && info?.type === type && shellyV1PinMatches(identifier, mac) ? mac : null;
}

/** A short CoIoT address is unique only after adoption records the full hardware MAC. */
@Injectable()
export class ShellyV1AdoptedIdentityService {
	constructor(
		@InjectRepository(ShellyV1AdoptedIdentityEntity)
		private readonly identities: Repository<ShellyV1AdoptedIdentityEntity>,
		private readonly devices: DevicesService,
		private readonly structure: DeviceStructureLockService,
	) {}

	/** A verified short address is published only after the catalog row and its pin commit together. */
	async createDevice(
		dto: CreateShellyV1DeviceDto,
		mac?: string,
		assertEndpoint?: () => void,
	): Promise<ShellyV1DeviceEntity> {
		const address = shellyV1Address(dto.identifier);
		if (address?.length !== 6 || !mac) {
			assertEndpoint?.();
			return this.devices.create<ShellyV1DeviceEntity, CreateShellyV1DeviceDto>(dto);
		}
		if (!shellyV1PinMatches(dto.identifier, mac) || !dto.hostname)
			throw new Error('Shelly hardware identity does not match the selected device.');
		const host = dto.hostname;
		const createDto = { ...dto, id: dto.id ?? randomUUID() };
		return this.structure.runExclusive(() =>
			DeviceCreationContext.run(
				(work) => this.identities.manager.connection.transaction(work),
				DEVICES_SHELLY_V1_TYPE,
				async (context) => {
					assertEndpoint?.();
					const created = await this.devices.create<ShellyV1DeviceEntity, CreateShellyV1DeviceDto>(createDto, context);
					await context.manager.insert(ShellyV1AdoptedIdentityEntity, {
						deviceId: created.id,
						mac,
						verifiedHost: host,
					});
					assertEndpoint?.();
					return created;
				},
				() => undefined,
			),
		);
	}

	findPin(deviceId: string): Promise<ShellyV1AdoptedIdentityEntity | null> {
		return this.identities.findOneBy({ deviceId });
	}

	async captureDevice(identifier: string): Promise<ShellyV1AdoptionState | null> {
		const row = await this.identities.manager
			.createQueryBuilder(ShellyV1DeviceEntity, 'device')
			.leftJoin(ShellyV1AdoptedIdentityEntity, 'pin', 'pin.deviceId = device.id')
			.select('device.id', 'id')
			.addSelect('device.identifier', 'identifier')
			.addSelect('device.hostname', 'hostname')
			.addSelect('pin.mac', 'mac')
			.addSelect('pin.verifiedHost', 'verifiedHost')
			.addSelect('pin.revision', 'revision')
			.where('device.identifier = :identifier', { identifier })
			.getRawOne<{
				id: string;
				identifier: string;
				hostname: string | null;
				mac: string | null;
				verifiedHost: string | null;
				revision: number | null;
			}>();
		if (!row) return null;
		return shellyV1AdoptionState(
			row,
			row.mac === null ? null : { mac: row.mac, verifiedHost: row.verifiedHost, revision: row.revision },
		);
	}

	async validateIdentifier(
		device: ShellyV1DeviceEntity,
		previous: Readonly<Partial<ShellyV1DeviceEntity>>,
	): Promise<void> {
		if (device.identifier === previous.identifier) return;
		const pin = await this.findPin(device.id);
		if (pin && !shellyV1PinMatches(device.identifier, pin.mac))
			throw new DevicesShellyV1ValidationException('Shelly identifier does not match its adopted hardware identity.');
	}

	/** Only the pinned hardware can move, and a delayed observation cannot undo a newer confirmation. */
	async confirmHost(
		deviceId: string,
		mac: string,
		host: string,
		previousHost: string | null,
		previousRevision: number,
	): Promise<boolean> {
		if (!Number.isSafeInteger(previousRevision) || previousRevision < 1) return false;
		if (host === previousHost)
			return this.identities.existsBy({ deviceId, mac, verifiedHost: host, revision: previousRevision });
		const match = { deviceId, mac, verifiedHost: previousHost ?? IsNull(), revision: previousRevision };
		const update = await this.identities.update(match, { verifiedHost: host });
		return update.affected === 1;
	}

	async expected(deviceId: string, identifier: string): Promise<string | null> {
		const address = shellyV1Address(identifier);
		if (!address) return null;
		const pin = await this.findPin(deviceId);
		if (pin) return shellyV1PinMatches(identifier, pin.mac) ? pin.mac : null;
		return address.length === 12 ? address : null;
	}

	/** An endpoint observation belongs to the catalog and pin revision captured before the request. */
	async updateDevice(
		state: ShellyV1AdoptionState,
		dto: UpdateShellyV1DeviceDto & { hostname: string },
		mac?: string,
		assertEndpoint?: () => void,
	): Promise<ShellyV1DeviceEntity> {
		const short = shellyV1Address(state.identifier)?.length === 6;
		if (
			(mac !== undefined && !shellyV1PinMatches(state.identifier, mac)) ||
			(state.pin && (!shellyV1PinMatches(state.identifier, state.pin.mac) || (mac && state.pin.mac !== mac))) ||
			(!mac &&
				(short || state.pin) &&
				(state.hostname !== dto.hostname || (state.pin && state.pin.verifiedHost !== dto.hostname)))
		)
			throw new DevicesShellyV1ValidationException('Shelly endpoint does not match the adopted hardware identity.');

		const stale = () =>
			new DevicesShellyV1ValidationException(
				'Shelly adoption changed during verification. Retry with the current device.',
			);
		return this.devices.update<ShellyV1DeviceEntity, UpdateShellyV1DeviceDto>(state.id, dto, {
			assertCurrent: assertEndpoint,
			persist: async (manager) => {
				const sameDevice = await manager.existsBy(ShellyV1DeviceEntity, {
					id: state.id,
					identifier: state.identifier ?? IsNull(),
					hostname: state.hostname ?? IsNull(),
				});
				const pins = manager.getRepository(ShellyV1AdoptedIdentityEntity);
				const pin = await pins.findOneBy({ deviceId: state.id });
				if (
					!sameDevice ||
					pin?.mac !== state.pin?.mac ||
					pin?.verifiedHost !== state.pin?.verifiedHost ||
					pin?.revision !== state.pin?.revision
				)
					throw stale();
				if (!mac) return false;
				if (!pin && short) {
					await pins.insert({ deviceId: state.id, mac, verifiedHost: dto.hostname });
					return true;
				}
				if (!pin || pin.verifiedHost === dto.hostname) return false;
				const update = await pins.update(
					{ deviceId: state.id, mac, revision: pin.revision },
					{ verifiedHost: dto.hostname },
				);
				if (update.affected !== 1) throw stale();
				return true;
			},
		});
	}
}
