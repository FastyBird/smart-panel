import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DEVICES_SHELLY_V1_PLUGIN_NAME, DEVICES_SHELLY_V1_TYPE } from '../devices-shelly-v1.constants';
import { AdoptDeviceDto } from '../dto/adopt-devices.dto';
import { CreateShellyV1DeviceDto } from '../dto/create-device.dto';
import { UpdateShellyV1DeviceDto } from '../dto/update-device.dto';
import { ShellyV1DeviceEntity } from '../entities/devices-shelly-v1.entity';

import { ShellyV1AdoptedIdentityService, shellyV1Address } from './shelly-v1-adopted-identity.service';
import { ShellyV1HttpClientService } from './shelly-v1-http-client.service';

export type ShellyV1AdoptionStatus = 'created' | 'updated' | 'failed';

export interface ShellyV1AdoptionOutcome {
	hostname: string;
	name: string;
	status: ShellyV1AdoptionStatus;
	error: string | null;
	deviceId: string | null;
}

/**
 * Adopts discovered devices.
 *
 * This used to run in the browser, one request per device, which the shared
 * request limit rejected once a selection went past thirty. It also had to cope
 * with the connector adopting a device on its own between the discovery scan
 * and the adoption - the browser could only notice that by failing a create,
 * re-polling discovery and retrying as an update.
 *
 * Running here removes that: the connector's auto-adoption and this adoption
 * are the same process writing to the same table, so a device that already
 * exists is simply found, and the create/update decision is made against
 * current state rather than against a snapshot the browser took earlier.
 */
@Injectable()
export class ShellyV1AdoptionService {
	private readonly logger = createExtensionLogger(DEVICES_SHELLY_V1_PLUGIN_NAME, 'ShellyV1AdoptionService');

	constructor(
		private readonly devicesService: DevicesService,
		private readonly identities: ShellyV1AdoptedIdentityService,
		private readonly http: ShellyV1HttpClientService,
	) {}

	async adopt(devices: AdoptDeviceDto[]): Promise<ShellyV1AdoptionOutcome[]> {
		const outcomes: ShellyV1AdoptionOutcome[] = [];

		for (const device of devices) {
			outcomes.push(await this.adoptOne(device));
		}

		this.logger.debug(
			`Adoption finished created=${outcomes.filter((outcome) => outcome.status === 'created').length} ` +
				`updated=${outcomes.filter((outcome) => outcome.status === 'updated').length} ` +
				`failed=${outcomes.filter((outcome) => outcome.status === 'failed').length}`,
		);

		return outcomes;
	}

	private async adoptOne(device: AdoptDeviceDto): Promise<ShellyV1AdoptionOutcome> {
		const existing = await this.findByIdentifier(device.identifier);
		const short = shellyV1Address(device.identifier);
		let mac: string | undefined;
		if (short?.length === 6) {
			const info = await this.http.getDeviceInfo(device.hostname).catch((): null => null);
			if (info) {
				mac = typeof info.mac === 'string' ? info.mac.toUpperCase() : undefined;
				if (!mac || !/^[0-9A-F]{12}$/.test(mac) || !mac.endsWith(short))
					return {
						hostname: device.hostname,
						name: device.name,
						status: 'failed',
						deviceId: existing?.id ?? null,
						error: 'Shelly hardware identity does not match the selected device.',
					};
			}
		}

		if (existing !== null) {
			return this.update(device, existing, mac);
		}

		try {
			const created = await this.devicesService.create<ShellyV1DeviceEntity, CreateShellyV1DeviceDto>({
				type: DEVICES_SHELLY_V1_TYPE,
				category: device.category,
				identifier: device.identifier,
				name: device.name,
				password: device.password ?? null,
				hostname: device.hostname,
			});
			if (mac && (await this.identities.adopt(created.id, device.identifier, mac)) !== mac)
				throw new Error('Conflicting adopted Shelly identity.');

			return {
				hostname: device.hostname,
				name: device.name,
				status: 'created',
				error: null,
				deviceId: created.id,
			};
		} catch (error) {
			// The connector may have adopted this device between the lookup above
			// and the create. It is the same race the connector itself handles, and
			// the answer is the same: look again, and treat a device that now exists
			// as an update rather than a failure.
			const raced = await this.findByIdentifier(device.identifier);

			if (raced !== null) {
				return this.update(device, raced, mac);
			}

			const err = error as Error;

			this.logger.error(`Failed to adopt device identifier=${device.identifier}`, {
				message: err.message,
				stack: err.stack,
			});

			return {
				hostname: device.hostname,
				name: device.name,
				status: 'failed',
				error: err.message.length > 0 ? err.message : 'Device could not be adopted',
				deviceId: null,
			};
		}
	}

	private async update(
		device: AdoptDeviceDto,
		existing: ShellyV1DeviceEntity,
		mac?: string,
	): Promise<ShellyV1AdoptionOutcome> {
		try {
			if (shellyV1Address(device.identifier)?.length === 6) {
				const expected = await this.identities.adopt(existing.id, device.identifier, mac);
				if ((mac && expected !== mac) || (expected && !mac && existing.hostname !== device.hostname))
					throw new Error('Shelly endpoint does not match the adopted hardware identity.');
			}
			await this.devicesService.update<ShellyV1DeviceEntity, UpdateShellyV1DeviceDto>(existing.id, {
				type: DEVICES_SHELLY_V1_TYPE,
				name: device.name,
				category: device.category,
				// A blank password field means "leave what is stored" rather than
				// "clear it" - the wizard only knows a password the operator typed
				// during this session.
				...(device.password === null || typeof device.password === 'undefined' ? {} : { password: device.password }),
				hostname: device.hostname,
			} as UpdateShellyV1DeviceDto);

			return {
				hostname: device.hostname,
				name: device.name,
				status: 'updated',
				error: null,
				deviceId: existing.id,
			};
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to update adopted device identifier=${device.identifier}`, {
				message: err.message,
				stack: err.stack,
			});

			return {
				hostname: device.hostname,
				name: device.name,
				status: 'failed',
				error: err.message.length > 0 ? err.message : 'Device could not be updated',
				deviceId: existing.id,
			};
		}
	}

	private async findByIdentifier(identifier: string): Promise<ShellyV1DeviceEntity | null> {
		return await this.devicesService.findOneBy<ShellyV1DeviceEntity>('identifier', identifier, DEVICES_SHELLY_V1_TYPE);
	}
}
