import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';

import { ConfigService } from '../../config/services/config.service';
import { CAMERAS_MODULE_NAME } from '../cameras.constants';
import { CamerasConfigModel } from '../models/config.model';

import { CamerasModuleEnabledGuard } from './cameras-module-enabled.guard';

describe('CamerasModuleEnabledGuard', () => {
	const guardFor = (getModuleConfig: jest.Mock) =>
		new CamerasModuleEnabledGuard({ getModuleConfig } as unknown as ConfigService);

	const config = (enabled: boolean): CamerasConfigModel => Object.assign(new CamerasConfigModel(), { enabled });

	it('lets requests through while the module is enabled', () => {
		const getModuleConfig = jest.fn().mockReturnValue(config(true));

		expect(guardFor(getModuleConfig).canActivate()).toBe(true);
		expect(getModuleConfig).toHaveBeenCalledWith(CAMERAS_MODULE_NAME);
	});

	it('answers 404 Cameras module is disabled when the module is switched off', () => {
		const guard = guardFor(jest.fn().mockReturnValue(config(false)));

		expect(() => guard.canActivate()).toThrow(NotFoundException);
		expect(() => guard.canActivate()).toThrow('Cameras module is disabled');
	});

	it('fails closed with 503 when the configuration cannot be read', () => {
		const guard = guardFor(
			jest.fn().mockImplementation(() => {
				throw new Error('no config');
			}),
		);

		expect(() => guard.canActivate()).toThrow(ServiceUnavailableException);
	});
});
