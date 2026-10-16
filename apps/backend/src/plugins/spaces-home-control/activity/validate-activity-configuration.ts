import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { BadRequestException } from '@nestjs/common';

import { ActivityConfigurationModel } from '../models/activity-configuration.model';
import { ClimateMode, LightingMode } from '../spaces-home-control.constants';

export async function validateActivityConfiguration(
	value: ActivityConfigurationModel,
): Promise<ActivityConfigurationModel> {
	const config = plainToInstance(ActivityConfigurationModel, value);
	const errors = await validate(config, { whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: true });
	if (errors.length) throw new BadRequestException('Invalid activity configuration');
	const climate = config.climate;
	if (
		[
			climate.mode,
			climate.thermostat_preset,
			climate.setpoint,
			climate.setpoint_delta,
			config.lighting.brightness,
		].some((value) => value === null)
	)
		throw new BadRequestException('Optional activity values must be omitted, not null');
	const preset = climate.thermostat_preset;
	const absolute = climate.setpoint !== undefined;
	const delta = climate.setpoint_delta !== undefined;
	if (
		(preset !== undefined && (!preset.trim() || absolute || delta || climate.mode !== undefined)) ||
		(absolute && delta)
	)
		throw new BadRequestException('Select a preset or a numeric climate intent, never both');
	if (climate.enabled && preset === undefined && !absolute && !delta)
		throw new BadRequestException('Enabled climate requires an explicit preset, setpoint or delta');
	if ((absolute || delta) && (!climate.mode || climate.mode === ClimateMode.OFF || climate.mode === ClimateMode.AUTO))
		throw new BadRequestException('Numeric climate intent requires explicit heat or cool mode');
	if (config.lighting.mode === LightingMode.OFF && config.lighting.brightness !== undefined)
		throw new BadRequestException('OFF does not accept a brightness override');
	return config;
}
