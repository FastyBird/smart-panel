import { ExtensionsModuleServiceState } from '../../../openapi.constants';

import type { IService, IServiceRes } from './services.store.types';

export const transformServiceResponse = (service: IServiceRes): IService => {
	return {
		pluginName: service.plugin_name,
		serviceId: service.service_id,
		state: service.state as ExtensionsModuleServiceState,
		enabled: service.enabled,
		healthy: service.healthy,
		lastStartedAt: service.last_started_at,
		lastStoppedAt: service.last_stopped_at,
		lastError: service.last_error,
		startCount: service.start_count,
		uptimeMs: service.uptime_ms,
	};
};
