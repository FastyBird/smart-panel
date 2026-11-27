import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { DeviceProvisionQueueService } from '../../../modules/devices/services/device-provision-queue.service';
import { DEVICES_SHELLY_V1_PLUGIN_NAME, DEVICES_SHELLY_V1_TYPE } from '../devices-shelly-v1.constants';
import { AdoptDeviceDto } from '../dto/adopt-devices.dto';
import { UpdateShellyV1DeviceDto } from '../dto/update-device.dto';

import {
	ShellyV1AdoptedIdentityService,
	ShellyV1AdoptionState,
	shellyV1Address,
	shellyV1DiscoveryOwner,
	shellyV1PinMatches,
} from './shelly-v1-adopted-identity.service';
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
		private readonly identities: ShellyV1AdoptedIdentityService,
		private readonly http: ShellyV1HttpClientService,
		private readonly provisionQueue: DeviceProvisionQueueService,
	) {}

	async adopt(devices: AdoptDeviceDto[]): Promise<ShellyV1AdoptionOutcome[]> {
		const outcomes: ShellyV1AdoptionOutcome[] = [];

		for (const device of devices) {
			outcomes.push(await this.provisionQueue.enqueue(device.identifier, () => this.adoptOne(device)));
		}

		this.logger.debug(
			`Adoption finished created=${outcomes.filter((outcome) => outcome.status === 'created').length} ` +
				`updated=${outcomes.filter((outcome) => outcome.status === 'updated').length} ` +
				`failed=${outcomes.filter((outcome) => outcome.status === 'failed').length}`,
		);

		return outcomes;
	}

	private async adoptOne({
		identifier,
		hostname,
		name,
		category,
		password,
	}: AdoptDeviceDto): Promise<ShellyV1AdoptionOutcome> {
		let existing: ShellyV1AdoptionState | null = null;
		const selection = { hostname, name };
		try {
			const candidates = await this.identities.captureDiscovery(identifier);
			existing = candidates.exact;
			const short = shellyV1Address(identifier)?.length === 6;
			let mac: string | undefined;
			if (short || existing?.pin || candidates.aliases.length) {
				const info = await this.http.getDeviceInfo(hostname).catch((): null => null);
				if (info) {
					mac = typeof info.mac === 'string' ? info.mac.toUpperCase() : undefined;
					if (!mac || !shellyV1PinMatches(identifier, mac))
						throw new Error('Shelly hardware identity does not match the selected device.');
				}
			}
			existing = shellyV1DiscoveryOwner(candidates, mac);

			if (!existing) {
				try {
					const created = await this.identities.createDevice(
						{
							type: DEVICES_SHELLY_V1_TYPE,
							identifier,
							category,
							password: password ?? null,
							...selection,
						},
						mac,
					);
					return { ...selection, status: 'created', error: null, deviceId: created.id };
				} catch (error) {
					existing = await this.identities.captureDevice(identifier);
					if (!existing) throw error;
					// The observation started without this row or its pin. A fresh adoption can verify the winner.
					if (short || existing.pin)
						throw new Error('Shelly was adopted during verification. Retry with the current device.', { cause: error });
				}
			}

			const update: UpdateShellyV1DeviceDto & { hostname: string } = {
				type: DEVICES_SHELLY_V1_TYPE,
				category,
				// The wizard only knows a password the operator typed during this session.
				...(password == null ? {} : { password }),
				...selection,
			};
			await this.identities.updateDevice(existing, update, mac);
			return { ...selection, status: 'updated', error: null, deviceId: existing.id };
		} catch (error) {
			const err = error instanceof Error ? error : new Error('Device could not be adopted');
			this.logger.error(`Failed to adopt device identifier=${identifier}`, {
				message: err.message,
				stack: err.stack,
			});
			return {
				...selection,
				status: 'failed',
				error: err.message || 'Device could not be adopted',
				deviceId: existing?.id ?? null,
			};
		}
	}
}
