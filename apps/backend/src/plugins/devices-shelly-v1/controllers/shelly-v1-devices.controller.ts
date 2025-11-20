import { validate } from 'class-validator';

import { Body, Controller, Get, Logger, Post, UnprocessableEntityException } from '@nestjs/common';

import { toInstance } from '../../../common/utils/transform.utils';
import { DESCRIPTORS } from '../devices-shelly-v1.constants';
import { DevicesShellyV1Exception } from '../devices-shelly-v1.exceptions';
import { ShellyV1ProbeDto } from '../dto/shelly-v1-probe.dto';
import { ShellyV1DeviceInfoModel, ShellyV1SupportedDeviceModel } from '../models/shelly-v1.model';
import { ShellyV1ProbeService } from '../services/shelly-v1-probe.service';

@Controller('devices')
export class ShellyV1DevicesController {
	private readonly logger = new Logger(ShellyV1DevicesController.name);

	constructor(private readonly probeService: ShellyV1ProbeService) {}

	@Post('info')
	async probe(@Body() body: { data: ShellyV1ProbeDto }): Promise<ShellyV1DeviceInfoModel> {
		this.logger.debug(`[SHELLY V1][DEVICES CONTROLLER] Incoming request to probe device at ${body.data.host}`);

		let probeResult: ShellyV1DeviceInfoModel;

		try {
			probeResult = await this.probeService.probeDevice(body.data);
		} catch (error) {
			this.logger.error(
				`[SHELLY V1][DEVICES CONTROLLER] Probe failed: ${error instanceof Error ? error.message : String(error)}`,
			);

			if (error instanceof DevicesShellyV1Exception) {
				// Return a failed probe result instead of throwing
				probeResult = {
					reachable: false,
					authRequired: false,
					host: body.data.host,
				};
			} else {
				throw error;
			}
		}

		const shellyProbeResult = toInstance(ShellyV1DeviceInfoModel, probeResult);

		const errors = await validate(shellyProbeResult, {
			whitelist: true,
			forbidNonWhitelisted: true,
			stopAtFirstError: false,
		});

		if (errors.length > 0) {
			this.logger.error(`[SHELLY V1][DEVICES CONTROLLER] Validation failed: ${JSON.stringify(errors)}`);

			throw new UnprocessableEntityException('Probe result model could not be created');
		}

		this.logger.debug(
			`[SHELLY V1][DEVICES CONTROLLER] Probe completed for ${body.data.host}. Reachable: ${shellyProbeResult.reachable}`,
		);

		return shellyProbeResult;
	}

	@Get('supported')
	async getSupported(): Promise<ShellyV1SupportedDeviceModel[]> {
		this.logger.debug('[SHELLY V1][DEVICES CONTROLLER] Incoming request to get Shelly V1 supported devices list');

		const devices: ShellyV1SupportedDeviceModel[] = [];

		for (const [group, spec] of Object.entries(DESCRIPTORS)) {
			const deviceSpec = toInstance(ShellyV1SupportedDeviceModel, {
				...spec,
				group,
			});

			const errors = await validate(deviceSpec, {
				whitelist: true,
				forbidNonWhitelisted: true,
				stopAtFirstError: false,
			});

			if (errors.length > 0) {
				this.logger.error(`[SHELLY V1][DEVICES CONTROLLER] Validation failed: ${JSON.stringify(errors)}`);

				continue;
			}

			devices.push(deviceSpec);
		}

		return devices;
	}
}
