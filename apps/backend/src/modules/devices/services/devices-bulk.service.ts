import { validate } from 'class-validator';

import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { toInstance } from '../../../common/utils/transform.utils';
import { BulkResultModel } from '../../api/models/bulk.model';
import { runBulkOperation } from '../../api/utils/bulk.utils';
import { DEVICES_MODULE_NAME } from '../devices.constants';
import { CreateDeviceDto } from '../dto/create-device.dto';
import { UpdateDeviceDto } from '../dto/update-device.dto';
import { DeviceEntity } from '../entities/devices.entity';

import { DeviceTypeMapping, DevicesTypeMapperService } from './devices-type-mapper.service';
import { DevicesService } from './devices.service';

/**
 * Runs a device operation across a selection in a single request.
 *
 * The per-device semantics, including each refusal, are meant to be identical
 * to the single-device endpoints - see runBulkOperation for why the work is
 * still performed one device at a time.
 */
@Injectable()
export class DevicesBulkService {
	private readonly logger = createExtensionLogger(DEVICES_MODULE_NAME, 'DevicesBulkService');

	constructor(
		private readonly devicesService: DevicesService,
		private readonly devicesMapperService: DevicesTypeMapperService,
	) {}

	async remove(ids: string[]): Promise<BulkResultModel> {
		const result = await runBulkOperation(
			ids,
			async (id) => {
				const device = await this.getOrThrow(id);

				await this.devicesService.remove(device.id);
			},
			'Device could not be removed',
		);

		this.logger.debug(`Bulk removal finished succeeded=${result.succeeded.length} failed=${result.failed.length}`);

		return result;
	}

	async setEnabled(ids: string[], enabled: boolean): Promise<BulkResultModel> {
		const result = await runBulkOperation(
			ids,
			async (id) => {
				const device = await this.getOrThrow(id);

				let mapping: DeviceTypeMapping<DeviceEntity, CreateDeviceDto, UpdateDeviceDto>;

				try {
					mapping = this.devicesMapperService.getMapping<DeviceEntity, CreateDeviceDto, UpdateDeviceDto>(device.type);
				} catch {
					throw new Error(`Unsupported device type: ${device.type}`);
				}

				// The single update endpoint routes the body through the type owner's
				// own update DTO, so a plugin that constrains its devices keeps that
				// say here too. The type comes from the stored device rather than the
				// request, for the same reason it does there.
				const dtoInstance = toInstance(
					mapping.updateDto,
					{ type: device.type, enabled },
					{ excludeExtraneousValues: false },
				);

				const errors = await validate(dtoInstance, {
					whitelist: true,
					forbidNonWhitelisted: true,
					stopAtFirstError: false,
				});

				if (errors.length > 0) {
					throw new Error('Device could not be updated');
				}

				await this.devicesService.update(device.id, dtoInstance);
			},
			'Device could not be updated',
		);

		this.logger.debug(
			`Bulk enabled=${String(enabled)} finished succeeded=${result.succeeded.length} failed=${result.failed.length}`,
		);

		return result;
	}

	private async getOrThrow(id: string): Promise<DeviceEntity> {
		const device = await this.devicesService.findOne(id);

		if (!device) {
			throw new Error('Requested device does not exist');
		}

		return device;
	}
}
