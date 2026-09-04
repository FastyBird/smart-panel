import { describe, expect, it } from 'vitest';

import { SystemModuleUpdateChannel } from '../../../openapi.constants';
import {
	transformConfigModuleResponse,
	transformConfigModuleUpdateRequest,
} from '../../config/store/config-modules.store.transformers';
import { SYSTEM_MODULE_NAME } from '../system.constants';

import { SystemConfigSchema, SystemConfigUpdateReqSchema } from './config.store.schemas';

const response = {
	type: SYSTEM_MODULE_NAME,
	enabled: true,
	language: 'en_US',
	timezone: 'Europe/Prague',
	time_format: '24h',
	number_format: 'comma_dot',
	temperature_unit: 'celsius',
	wind_speed_unit: 'ms',
	pressure_unit: 'hpa',
	precipitation_unit: 'mm',
	distance_unit: 'km',
	log_levels: ['info'],
	house_mode: 'home',
	onboarding_completed: true,
	update_channel: 'alpha',
};

describe('system config schemas', () => {
	it('should carry the update channel through the response transform', () => {
		const parsed = transformConfigModuleResponse(response as never, SystemConfigSchema);

		expect(parsed.updateChannel).toBe(SystemModuleUpdateChannel.alpha);
	});

	it('should default the update channel to auto for a backend that predates the setting', () => {
		const withoutChannel = { ...response };

		delete (withoutChannel as Partial<typeof response>).update_channel;

		const parsed = transformConfigModuleResponse(withoutChannel as never, SystemConfigSchema);

		expect(parsed.updateChannel).toBe(SystemModuleUpdateChannel.auto);
	});

	it('should carry the update channel through the update request transform', () => {
		const request = transformConfigModuleUpdateRequest(
			{ type: SYSTEM_MODULE_NAME, updateChannel: SystemModuleUpdateChannel.beta } as never,
			SystemConfigUpdateReqSchema
		);

		// The value has to survive both the camel→snake rename and the schema's own stripping,
		// otherwise switching the channel in the UI would silently post nothing.
		expect(request).toMatchObject({ update_channel: SystemModuleUpdateChannel.beta });
	});
});
