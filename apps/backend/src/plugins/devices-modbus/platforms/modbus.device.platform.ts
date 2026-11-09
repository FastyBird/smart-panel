import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { IDevicePlatform, IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import {
	DEVICES_MODBUS_PLUGIN_NAME,
	DEVICES_MODBUS_TYPE,
	MODBUS_DEFAULTS,
	ModbusRegisterType,
	ModbusWriteFunction,
} from '../devices-modbus.constants';
import { ModbusDeviceEntity } from '../entities/devices-modbus.entity';
import { ModbusBindingEntity } from '../entities/modbus-binding.entity';
import { ModbusValueOptions, ModbusValueRangeError, encodeValue } from '../lib/codec';
import { ModbusBindingsService } from '../services/modbus-bindings.service';
import { ModbusConnectionsService } from '../services/modbus-connections.service';
import { ModbusRuntimeService } from '../services/modbus-runtime.service';
import { ModbusWriteRequest } from '../transport/modbus-transport';

type WriteRegisterType = ModbusWriteRequest['registerType'];

interface PlannedWrite {
	propertyId: string;
	hasReadBinding: boolean;
	registerType: WriteRegisterType;
	address: number;
	values: boolean[] | number[];
	multiple: boolean;
}

interface WriteRun {
	propertyIds: string[];
	readBackIds: string[];
	registerType: WriteRegisterType;
	address: number;
	values: Array<boolean | number>;
	multiple: boolean;
}

const WRITABLE: ReadonlySet<ModbusRegisterType> = new Set([
	ModbusRegisterType.COIL,
	ModbusRegisterType.HOLDING_REGISTER,
]);

/**
 * Turns Smart Panel property commands into Modbus writes. A write never reports a sample: the read-back poll that
 * follows a successful write is what updates the property.
 */
@Injectable()
export class ModbusDevicePlatform implements IDevicePlatform {
	private readonly logger = createExtensionLogger(DEVICES_MODBUS_PLUGIN_NAME, 'ModbusDevicePlatform');

	constructor(
		private readonly bindings: ModbusBindingsService,
		private readonly runtime: ModbusRuntimeService,
		private readonly connections: ModbusConnectionsService,
	) {}

	getType(): string {
		return DEVICES_MODBUS_TYPE;
	}

	process(update: IDevicePropertyData): Promise<boolean> {
		return this.processBatch([update]);
	}

	async processBatch(updates: IDevicePropertyData[]): Promise<boolean> {
		const byDevice = new Map<string, IDevicePropertyData[]>();

		for (const update of updates) {
			const group = byDevice.get(update.device.id) ?? [];

			group.push(update);
			byDevice.set(update.device.id, group);
		}

		let ok = true;

		for (const [deviceId, group] of byDevice) {
			if (!(await this.processDevice(deviceId, group))) {
				ok = false;
			}
		}

		return ok;
	}

	getCommandTimeoutMs(commandCount: number): number {
		const envelope = this.connections.getTimingEnvelope();
		const requestTimeoutMs = envelope?.requestTimeoutMs ?? MODBUS_DEFAULTS.REQUEST_TIMEOUT_MS;
		const interRequestDelayMs = envelope?.interRequestDelayMs ?? MODBUS_DEFAULTS.INTER_REQUEST_DELAY_MS_TCP;

		return commandCount * (requestTimeoutMs + interRequestDelayMs) + 1000;
	}

	private async processDevice(deviceId: string, updates: IDevicePropertyData[]): Promise<boolean> {
		const planned: PlannedWrite[] = [];

		for (const update of updates) {
			const plan = await this.plan(update);

			if (plan === null) {
				return false;
			}

			planned.push(plan);
		}

		const connection = this.runtime.getConnection(deviceId);

		if (connection === null) {
			this.logger.warn(`Modbus device id=${deviceId} is not commandable: its endpoint is not running`);

			return false;
		}

		const unitId = (updates[0].device as ModbusDeviceEntity).modbusUnitId ?? MODBUS_DEFAULTS.UNIT_ID;
		const written: string[] = [];
		let ok = true;

		for (const run of this.buildRuns(planned)) {
			try {
				await connection.write({
					unitId,
					registerType: run.registerType,
					address: run.address,
					values: run.values as boolean[] | number[],
					writeFunction: run.multiple ? ModbusWriteFunction.MULTIPLE : ModbusWriteFunction.SINGLE,
				});

				written.push(...run.readBackIds);
			} catch (error) {
				this.logger.warn(
					`Modbus write failed device=${deviceId} ${run.registerType}@${run.address}: ${(error as Error).message}`,
				);

				ok = false;

				break;
			}
		}

		if (written.length > 0) {
			this.readBack(deviceId, written);
		}

		return ok;
	}

	private async plan(update: IDevicePropertyData): Promise<PlannedWrite | null> {
		const propertyId = update.property.id;
		const { read, write } = await this.bindings.findByProperty(propertyId);

		if (write === null) {
			this.logger.warn(`Modbus property id=${propertyId} has no write binding`);

			return null;
		}

		if (!WRITABLE.has(write.registerType)) {
			this.logger.warn(`Modbus property id=${propertyId} write binding targets read-only ${write.registerType}`);

			return null;
		}

		const registerType = write.registerType as WriteRegisterType;

		try {
			const encoded = encodeValue(
				update.value,
				this.valueOptions(update.device as ModbusDeviceEntity, write),
				registerType === ModbusRegisterType.COIL ? 'bit' : 'registers',
			);

			return {
				propertyId,
				hasReadBinding: read !== null,
				registerType,
				address: write.address,
				values: encoded.kind === 'bit' ? [encoded.value] : encoded.words,
				multiple: write.writeFunction === ModbusWriteFunction.MULTIPLE,
			};
		} catch (error) {
			if (error instanceof ModbusValueRangeError) {
				this.logger.warn(`Modbus property id=${propertyId} refused value: ${error.message}`);

				return null;
			}

			throw error;
		}
	}

	private valueOptions(device: ModbusDeviceEntity, binding: ModbusBindingEntity): ModbusValueOptions {
		return {
			dataType: binding.dataType,
			byteOrder: binding.byteOrder ?? device.modbusByteOrder ?? MODBUS_DEFAULTS.BYTE_ORDER,
			wordOrder: binding.wordOrder ?? device.modbusWordOrder ?? MODBUS_DEFAULTS.WORD_ORDER,
			bit: binding.bit,
			invert: binding.invert,
			scale: binding.scale,
			offset: binding.offset,
			valueMap: binding.valueMap,
		};
	}

	/** Merges only neighbours (in the caller's order) of one register type whose bindings all say `multiple`. */
	private buildRuns(planned: PlannedWrite[]): WriteRun[] {
		const runs: WriteRun[] = [];
		let mergeable = false;

		for (const item of planned) {
			const last = runs[runs.length - 1];

			if (
				last !== undefined &&
				mergeable &&
				item.multiple &&
				last.registerType === item.registerType &&
				last.address + last.values.length === item.address
			) {
				last.values.push(...item.values);
				last.propertyIds.push(item.propertyId);

				if (item.hasReadBinding) {
					last.readBackIds.push(item.propertyId);
				}

				continue;
			}

			runs.push({
				propertyIds: [item.propertyId],
				readBackIds: item.hasReadBinding ? [item.propertyId] : [],
				registerType: item.registerType,
				address: item.address,
				values: [...item.values],
				multiple: item.multiple,
			});

			mergeable = item.multiple;
		}

		// A single-function write can only carry one value; a multi-word value or merged run needs FC15/FC16.
		for (const run of runs) {
			if (run.values.length > 1) {
				run.multiple = true;
			}
		}

		return runs;
	}

	/** Fire and forget: the next regular poll settles the value when the read-back fails. */
	private readBack(deviceId: string, propertyIds: string[]): void {
		try {
			this.runtime.readBack(deviceId, propertyIds).catch((error: Error) => {
				this.logger.warn(`Modbus read-back failed device=${deviceId}: ${error.message}`);
			});
		} catch (error) {
			this.logger.warn(`Modbus read-back failed device=${deviceId}: ${(error as Error).message}`);
		}
	}
}
