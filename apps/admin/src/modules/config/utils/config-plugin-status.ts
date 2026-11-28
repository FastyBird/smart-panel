import type { StatusTagStatus } from '../../../common';
import { ExtensionsModuleServiceState } from '../../../openapi.constants';
import type { IService } from '../../extensions/store/services.store.types';

export type ConfigPluginStatus = 'running' | 'unhealthy' | 'starting' | 'stopping' | 'stopped' | 'error';

export const CONFIG_PLUGIN_STATUS_TAG: Record<ConfigPluginStatus, StatusTagStatus> = {
	running: 'ok',
	unhealthy: 'warn',
	starting: 'info',
	stopping: 'info',
	stopped: 'info',
	error: 'danger',
};

/**
 * One state for all the services a plugin runs, the worst first: an error, then a running service that reports itself
 * unhealthy, then one on its way up or down, then one stopped. A plugin without services has no state to show
 */
export const configPluginStatus = (services: IService[]): ConfigPluginStatus | null => {
	if (services.length === 0) {
		return null;
	}

	const states = services.map((service) => service.state);

	if (states.includes(ExtensionsModuleServiceState.error)) {
		return 'error';
	}

	if (services.some((service) => service.state === ExtensionsModuleServiceState.started && service.healthy === false)) {
		return 'unhealthy';
	}

	if (states.includes(ExtensionsModuleServiceState.starting)) {
		return 'starting';
	}

	if (states.includes(ExtensionsModuleServiceState.stopping)) {
		return 'stopping';
	}

	if (states.includes(ExtensionsModuleServiceState.stopped)) {
		return 'stopped';
	}

	return 'running';
};
