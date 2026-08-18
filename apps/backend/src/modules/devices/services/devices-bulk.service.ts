import { validate } from 'class-validator';

import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { toInstance } from '../../../common/utils/transform.utils';
import { DEVICES_MODULE_NAME } from '../devices.constants';
import { CreateDeviceDto } from '../dto/create-device.dto';
import { UpdateDeviceDto } from '../dto/update-device.dto';
import { DeviceEntity } from '../entities/devices.entity';
import { BulkFailureModel, BulkResultModel } from '../models/devices.model';

import { DeviceTypeMapping, DevicesTypeMapperService } from './devices-type-mapper.service';
import { DevicesService } from './devices.service';

/**
 * Runs a device operation across a selection in a single request.
 *
 * These endpoints exist because the per-item alternative was a request per
 * device, which the shared 30-per-minute throttle rejects once a selection goes
 * past thirty. Collapsing the round trips is the whole point, so the work is
 * still performed one device at a time here - the semantics of each operation,
 * including its per-device refusals, are meant to be identical to the single
 * endpoints. What changes is the transport, not the behaviour.
 *
 * Failures are collected rather than thrown: a selection is a set of
 * independent intents, and one hidden device refusing to move must not discard
 * the other forty-nine.
 */
@Injectable()
export class DevicesBulkService {
	private readonly logger = createExtensionLogger(DEVICES_MODULE_NAME, 'DevicesBulkService');

	constructor(
		private readonly devicesService: DevicesService,
		private readonly devicesMapperService: DevicesTypeMapperService,
	) {}

	async remove(ids: string[]): Promise<BulkResultModel> {
		const result = this.emptyResult();

		for (const id of this.unique(ids)) {
			const device = await this.devicesService.findOne(id);

			if (!device) {
				this.fail(result, id, 'Requested device does not exist');

				continue;
			}

			try {
				await this.devicesService.remove(device.id);

				result.succeeded.push(device.id);
			} catch (error) {
				this.fail(result, id, this.reasonFor(error, 'Device could not be removed'));
			}
		}

		this.logger.debug(`Bulk removal finished succeeded=${result.succeeded.length} failed=${result.failed.length}`);

		return result;
	}

	async setEnabled(ids: string[], enabled: boolean): Promise<BulkResultModel> {
		const result = this.emptyResult();

		for (const id of this.unique(ids)) {
			const device = await this.devicesService.findOne(id);

			if (!device) {
				this.fail(result, id, 'Requested device does not exist');

				continue;
			}

			let mapping: DeviceTypeMapping<DeviceEntity, CreateDeviceDto, UpdateDeviceDto>;

			try {
				mapping = this.devicesMapperService.getMapping<DeviceEntity, CreateDeviceDto, UpdateDeviceDto>(device.type);
			} catch {
				this.fail(result, id, `Unsupported device type: ${device.type}`);

				continue;
			}

			// The single update endpoint routes the body through the type owner's own
			// update DTO, so a plugin that constrains its devices keeps that say here
			// too. The type comes from the stored device rather than the request, for
			// the same reason it does there.
			const dtoInstance = toInstance(
				mapping.updateDto,
				{ type: device.type, enabled },
				{
					excludeExtraneousValues: false,
				},
			);

			const errors = await validate(dtoInstance, {
				whitelist: true,
				forbidNonWhitelisted: true,
				stopAtFirstError: false,
			});

			if (errors.length > 0) {
				this.fail(result, id, 'Device could not be updated');

				continue;
			}

			try {
				await this.devicesService.update(device.id, dtoInstance);

				result.succeeded.push(device.id);
			} catch (error) {
				this.fail(result, id, this.reasonFor(error, 'Device could not be updated'));
			}
		}

		this.logger.debug(
			`Bulk enabled=${String(enabled)} finished succeeded=${result.succeeded.length} failed=${result.failed.length}`,
		);

		return result;
	}

	/**
	 * A selection can carry the same device twice - two rows of the same device
	 * in different groupings, for instance. Acting once and reporting once keeps
	 * the counts the caller shows honest.
	 */
	private unique(ids: string[]): string[] {
		return [...new Set(ids)];
	}

	private emptyResult(): BulkResultModel {
		const result = new BulkResultModel();

		result.succeeded = [];
		result.failed = [];

		return result;
	}

	private fail(result: BulkResultModel, id: string, reason: string): void {
		const failure = new BulkFailureModel();

		failure.id = id;
		failure.reason = reason;

		result.failed.push(failure);
	}

	/**
	 * Refusals that carry an explanation - a hidden device's placement, a type
	 * owner rejecting a state - are worth passing back, the same way the single
	 * endpoints translate them instead of answering "try again later".
	 */
	private reasonFor(error: unknown, fallback: string): string {
		return error instanceof Error && error.message.length > 0 ? error.message : fallback;
	}
}
