import { randomUUID } from 'node:crypto';
import { IsNull, Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { DeviceCreationContext } from '../../../modules/devices/services/device-creation-context';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DEVICES_SHELLY_V1_TYPE } from '../devices-shelly-v1.constants';
import { CreateShellyV1DeviceDto } from '../dto/create-device.dto';
import { ShellyV1DeviceEntity } from '../entities/devices-shelly-v1.entity';
import { ShellyV1AdoptedIdentityEntity } from '../entities/shelly-v1-adopted-identity.entity';
import type { ShellyInfoResponse } from '../interfaces/shelly-http.interface';

export function shellyV1Address(identifier: string | null | undefined): string | null {
	const suffix = identifier?.split('-').at(-1)?.toUpperCase();
	return suffix && /^(?:[0-9A-F]{6}|[0-9A-F]{12})$/.test(suffix) ? suffix : null;
}

export function shellyV1ReportedMac(
	identifier: string,
	type: string,
	info: Pick<ShellyInfoResponse, 'mac' | 'type'> | null | undefined,
): string | null {
	const address = shellyV1Address(identifier);
	const mac = typeof info?.mac === 'string' ? info.mac.toUpperCase() : null;
	return address && mac && info?.type === type && /^[0-9A-F]{12}$/.test(mac) && mac.endsWith(address) ? mac : null;
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
		if (!/^[0-9A-F]{12}$/.test(mac) || !mac.endsWith(address) || !dto.hostname)
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

	/** Only the pinned hardware can move, and a delayed observation cannot undo a newer confirmation. */
	async confirmHost(deviceId: string, mac: string, host: string, previousHost?: string | null): Promise<boolean> {
		const match = { deviceId, mac, ...(previousHost !== undefined && { verifiedHost: previousHost ?? IsNull() }) };
		const update = await this.identities.update(match, { verifiedHost: host });
		return update.affected === 1 || this.identities.existsBy({ deviceId, mac, verifiedHost: host });
	}

	async expected(deviceId: string, identifier: string): Promise<string | null> {
		const address = shellyV1Address(identifier);
		if (!address) return null;
		const pin = await this.findPin(deviceId);
		if (pin) return /^[0-9A-F]{12}$/.test(pin.mac) && pin.mac.endsWith(address) ? pin.mac : null;
		return address.length === 12 ? address : null;
	}

	/** Concurrent adoptions retain the first full MAC and cannot transfer a pin to a different device row. */
	async adopt(
		deviceId: string,
		identifier: string,
		observedMac: string | undefined,
		verifiedHost?: string,
	): Promise<string | null> {
		const address = shellyV1Address(identifier);
		const mac = typeof observedMac === 'string' ? observedMac.toUpperCase() : undefined;
		if (address?.length === 6 && mac && /^[0-9A-F]{12}$/.test(mac) && mac.endsWith(address)) {
			await this.identities
				.createQueryBuilder()
				.insert()
				.values({ deviceId, mac, verifiedHost: verifiedHost ?? null })
				.orIgnore()
				.execute();
			if (verifiedHost) await this.confirmHost(deviceId, mac, verifiedHost);
		}
		return this.expected(deviceId, identifier);
	}
}
