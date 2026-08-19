import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DEVICES_SHELLY_V1_PLUGIN_NAME, DEVICES_SHELLY_V1_TYPE } from '../devices-shelly-v1.constants';
import { AdoptDeviceDto } from '../dto/adopt-devices.dto';
import { CreateShellyV1DeviceDto } from '../dto/create-device.dto';
import { UpdateShellyV1DeviceDto } from '../dto/update-device.dto';
import { ShellyV1DeviceEntity } from '../entities/devices-shelly-v1.entity';

export type ShellyV1AdoptionStatus = 'created' | 'updated' | 'failed';

export interface ShellyV1AdoptionOutcome {
	hostname: string;
	identifier: string;
	status: ShellyV1AdoptionStatus;
	deviceId: string | null;
	reason: string | null;
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

	constructor(private readonly devicesService: DevicesService) {}

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

		if (existing !== null) {
			return this.update(device, existing);
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

			return {
				hostname: device.hostname,
				identifier: device.identifier,
				status: 'created',
				deviceId: created.id,
				reason: null,
			};
		} catch (error) {
			// The connector may have adopted this device between the lookup above
			// and the create. It is the same race the connector itself handles, and
			// the answer is the same: look again, and treat a device that now exists
			// as an update rather than a failure.
			const raced = await this.findByIdentifier(device.identifier);

			if (raced !== null) {
				return this.update(device, raced);
			}

			const err = error as Error;

			this.logger.error(`Failed to adopt device identifier=${device.identifier}`, {
				message: err.message,
				stack: err.stack,
			});

			return {
				hostname: device.hostname,
				identifier: device.identifier,
				status: 'failed',
				deviceId: null,
				reason: err.message.length > 0 ? err.message : 'Device could not be adopted',
			};
		}
	}

	private async update(device: AdoptDeviceDto, existing: ShellyV1DeviceEntity): Promise<ShellyV1AdoptionOutcome> {
		try {
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
				identifier: device.identifier,
				status: 'updated',
				deviceId: existing.id,
				reason: null,
			};
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to update adopted device identifier=${device.identifier}`, {
				message: err.message,
				stack: err.stack,
			});

			return {
				hostname: device.hostname,
				identifier: device.identifier,
				status: 'failed',
				deviceId: existing.id,
				reason: err.message.length > 0 ? err.message : 'Device could not be updated',
			};
		}
	}

	private async findByIdentifier(identifier: string): Promise<ShellyV1DeviceEntity | null> {
		return await this.devicesService.findOneBy<ShellyV1DeviceEntity>('identifier', identifier, DEVICES_SHELLY_V1_TYPE);
	}
}
