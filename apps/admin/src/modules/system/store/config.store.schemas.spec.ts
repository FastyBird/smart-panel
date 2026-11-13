import { describe, expect, it } from 'vitest';

import { SystemModuleUpdateChannel } from '../../../openapi.constants';
import { transformConfigModuleResponse, transformConfigModuleUpdateRequest } from '../../config/store/config-modules.store.transformers';
import { SystemConfigEditFormSchema } from '../schemas/config.schemas';
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

	it('should carry the house location through the response transform', () => {
		const parsed = transformConfigModuleResponse({ ...response, latitude: -33.87, longitude: 151.21 } as never, SystemConfigSchema);

		expect(parsed.latitude).toBe(-33.87);
		expect(parsed.longitude).toBe(151.21);
	});

	it('should read a house location that is not set, or that a backend predating it does not send, as null', () => {
		const notSet = transformConfigModuleResponse({ ...response, latitude: null, longitude: null } as never, SystemConfigSchema);
		const predating = transformConfigModuleResponse(response as never, SystemConfigSchema);

		expect([notSet.latitude, notSet.longitude, predating.latitude, predating.longitude]).toEqual([null, null, null, null]);
	});

	it('should post a cleared house location as null, so the backend clears it', () => {
		const request = transformConfigModuleUpdateRequest(
			{ type: SYSTEM_MODULE_NAME, latitude: null, longitude: null } as never,
			SystemConfigUpdateReqSchema
		);

		expect(request).toMatchObject({ latitude: null, longitude: null });
	});

	it('should post a house location the form edited', () => {
		const form = SystemConfigEditFormSchema.pick({ latitude: true, longitude: true }).parse({ latitude: '50.0755', longitude: '' });

		expect(form).toEqual({ latitude: 50.0755, longitude: null });
		expect(SystemConfigEditFormSchema.pick({ latitude: true }).safeParse({ latitude: '91' }).success).toBe(false);
	});
});
