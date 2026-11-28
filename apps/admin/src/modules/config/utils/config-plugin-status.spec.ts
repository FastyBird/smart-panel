import { describe, expect, it } from 'vitest';

import { ExtensionsModuleServiceState } from '../../../openapi.constants';
import type { IService } from '../../extensions/store/services.store.types';

import { configPluginStatus } from './config-plugin-status';

const service = (state: ExtensionsModuleServiceState, healthy?: boolean): IService => ({ state, healthy }) as IService;

describe('configPluginStatus', () => {
	it('has nothing to say for a plugin without services', () => {
		expect(configPluginStatus([])).toBeNull();
	});

	it('is running when every service is up', () => {
		expect(configPluginStatus([service(ExtensionsModuleServiceState.started), service(ExtensionsModuleServiceState.started, true)])).toBe('running');
	});

	it('puts an error before anything else', () => {
		expect(configPluginStatus([service(ExtensionsModuleServiceState.started), service(ExtensionsModuleServiceState.error)])).toBe('error');
	});

	it('tells a running but unhealthy service', () => {
		expect(configPluginStatus([service(ExtensionsModuleServiceState.started, false)])).toBe('unhealthy');
	});

	it.each([
		[ExtensionsModuleServiceState.starting, 'starting'],
		[ExtensionsModuleServiceState.stopping, 'stopping'],
		[ExtensionsModuleServiceState.stopped, 'stopped'],
	])('tells a service that is %s', (state, status) => {
		expect(configPluginStatus([service(ExtensionsModuleServiceState.started), service(state)])).toBe(status);
	});
});
