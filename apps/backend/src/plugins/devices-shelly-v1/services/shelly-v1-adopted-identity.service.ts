import { Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { ShellyV1AdoptedIdentityEntity } from '../entities/shelly-v1-adopted-identity.entity';

export function shellyV1Address(identifier: string | null | undefined): string | null {
	const suffix = identifier?.split('-').at(-1)?.toUpperCase();
	return suffix && /^(?:[0-9A-F]{6}|[0-9A-F]{12})$/.test(suffix) ? suffix : null;
}

/** A short CoIoT address is unique only after adoption records the full hardware MAC. */
@Injectable()
export class ShellyV1AdoptedIdentityService {
	constructor(
		@InjectRepository(ShellyV1AdoptedIdentityEntity)
		private readonly identities: Repository<ShellyV1AdoptedIdentityEntity>,
	) {}

	async expected(deviceId: string, identifier: string): Promise<string | null> {
		const address = shellyV1Address(identifier);
		if (!address) return null;
		const pin = await this.identities.findOneBy({ deviceId });
		if (pin) return /^[0-9A-F]{12}$/.test(pin.mac) && pin.mac.endsWith(address) ? pin.mac : null;
		return address.length === 12 ? address : null;
	}

	/** Concurrent adoptions retain the first full MAC and cannot transfer a pin to a different device row. */
	async adopt(deviceId: string, identifier: string, observedMac: string | undefined): Promise<string | null> {
		const address = shellyV1Address(identifier);
		const mac = typeof observedMac === 'string' ? observedMac.toUpperCase() : undefined;
		if (address?.length === 6 && mac && /^[0-9A-F]{12}$/.test(mac) && mac.endsWith(address))
			await this.identities.createQueryBuilder().insert().values({ deviceId, mac }).orIgnore().execute();
		return this.expected(deviceId, identifier);
	}
}
