import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { DEVICES_MODULE_NAME } from '../devices.constants';
import { DevicesException } from '../devices.exceptions';
import { CreateDeviceDto } from '../dto/create-device.dto';
import { UpdateDeviceDto } from '../dto/update-device.dto';
import { DeviceEntity } from '../entities/devices.entity';

export interface DeviceTypeMapping<
	TDevice extends DeviceEntity,
	TCreateDTO extends CreateDeviceDto,
	TUpdateDTO extends UpdateDeviceDto,
> {
	type: string; // e.g., 'third-party', 'shelly'
	class: new (...args: any[]) => TDevice; // Constructor for the device class
	createDto: new (...args: any[]) => TCreateDTO; // Constructor for the Create DTO
	updateDto: new (...args: any[]) => TUpdateDTO; // Constructor for the Update DTO
	/**
	 * Last look at the row a PATCH is about to write, before it is written.
	 *
	 * Receives the loaded entity with the update's fields already merged in — the state the database
	 * will actually hold — plus `previous`, a shallow snapshot of the row as it was loaded. The merged
	 * view is what makes an invariant spanning a sent field and an unsent one decidable at all; the
	 * snapshot is what tells a hook whether the field it cares about actually *changed*, so a device
	 * that was already in a state this hook would refuse can still be renamed. (`previous` is a spread
	 * of own enumerable properties: columns and loaded relations, not prototype getters such as
	 * `zoneIds`.)
	 *
	 * Throwing aborts the update before `repository.save`, leaving the row untouched and DEVICE_UPDATED
	 * unemitted. Throw `DevicesValidationException` (or another `DevicesException`) to have the HTTP
	 * layer report it as an unprocessable entity; anything else surfaces as a 500. Returns void because
	 * the service saves the very instance it passed in — mutate it in place to normalise rather than
	 * reject.
	 */
	beforeUpdate?: (device: TDevice, previous: Readonly<Partial<TDevice>>) => Promise<void>;
	afterCreate?: (device: TDevice, createDto?: TCreateDTO) => Promise<TDevice>;
	afterUpdate?: (device: TDevice) => Promise<TDevice>;
}

@Injectable()
export class DevicesTypeMapperService {
	private readonly logger = createExtensionLogger(DEVICES_MODULE_NAME, 'DevicesTypeMapperService');

	private readonly mappings = new Map<string, DeviceTypeMapping<any, any, any>>();

	private registrationSequence = 0n;
	private readonly creationRegistrations = new Map<string, {
		readonly mapping: object;
		readonly revision: bigint;
		readonly close: () => void;
		readonly isCurrent: () => boolean;
	}>();

	registerMapping<TDevice extends DeviceEntity, TCreateDTO extends CreateDeviceDto, TUpdateDTO extends UpdateDeviceDto>(
		mapping: DeviceTypeMapping<TDevice, TCreateDTO, TUpdateDTO>,
	): void {
		const type = mapping.type;
		let active = true;
		const fields = ['type', 'class', 'createDto', 'updateDto', 'beforeCreate', 'afterCreate', 'beforeUpdate', 'afterUpdate', 'withStructuralWrite'];
		const descriptors = (() => {
			try {
				return fields.map((field) => {
					const descriptor: Readonly<{ value?: unknown; get?: unknown; set?: unknown }> | undefined = Object.getOwnPropertyDescriptor(mapping, field);
					return { field, descriptor };
				});
			} catch {
				// Ordinary registration remains usable; opaque mappings cannot qualify an owned capture.
				return undefined;
			}
		})();
		const revision = ++this.registrationSequence;
		const registration: { readonly mapping: object; readonly revision: bigint; readonly close: () => void; readonly isCurrent: () => boolean } = {
			mapping,
			revision,
			close: (): void => { active = false; },
			isCurrent: (): boolean => active && descriptors !== undefined && this.creationRegistrations.get(type) === registration &&
				descriptors.every(({ field, descriptor }) => {
					const current: Readonly<{ value?: unknown; get?: unknown; set?: unknown }> | undefined = Object.getOwnPropertyDescriptor(mapping, field);
					return descriptor === undefined ? current === undefined :
						descriptor.get === undefined && descriptor.set === undefined && current?.get === undefined &&
						current?.set === undefined && current?.value === descriptor.value;
				}),
		};
		this.creationRegistrations.get(type)?.close();
		this.creationRegistrations.set(type, registration);
		this.mappings.set(type, mapping);

		this.logger.log(`[REGISTERED] Device type '${mapping.type}' added. Total mappings: ${this.mappings.size}`);
	}

	getMapping<TDevice extends DeviceEntity, TCreateDTO extends CreateDeviceDto, TUpdateDTO extends UpdateDeviceDto>(
		type: string,
	): DeviceTypeMapping<TDevice, TCreateDTO, TUpdateDTO> {
		this.logger.debug(`Attempting to find mapping for device type: '${type}'`);

		const mapping = this.mappings.get(type);

		if (!mapping) {
			this.logger.error(
				`[LOOKUP FAILED] Device mapping for '${type}' is not registered. Available types: ${Array.from(this.mappings.keys()).join(', ') || 'None'}`,
			);

			throw new DevicesException(`Unsupported device type: ${type}`);
		}

		this.logger.debug(`[LOOKUP SUCCESS] Found mapping for device type: '${type}'`);

		return mapping as DeviceTypeMapping<TDevice, TCreateDTO, TUpdateDTO>;
	}

	/** Read-only continuity of the ORIGINAL registration; ordinary lookup never mints an epoch. */
	captureMapping<TDevice extends DeviceEntity, TCreateDTO extends CreateDeviceDto, TUpdateDTO extends UpdateDeviceDto>(type: string): Readonly<{ mapping: DeviceTypeMapping<TDevice, TCreateDTO, TUpdateDTO>; isCurrent: () => boolean }> | null {
		const registration = this.creationRegistrations.get(type);
		if (!registration?.isCurrent()) return null;
		const mapping = this.getMapping<TDevice, TCreateDTO, TUpdateDTO>(type);
		if (mapping !== registration.mapping || !registration.isCurrent()) return null;
		return Object.freeze({ mapping, isCurrent: registration.isCurrent });
	}
}
