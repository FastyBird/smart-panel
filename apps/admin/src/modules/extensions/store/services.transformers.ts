import {
	ExtensionsModuleServiceActivationPolicy,
	ExtensionsModuleServiceDesiredState,
	ExtensionsModuleServiceOwnerKind,
	ExtensionsModuleServiceState,
} from '../../../openapi.constants';

import type { IService, IServiceRes } from './services.store.types';

export const transformServiceResponse = (service: IServiceRes): IService => {
	return {
		extensionKind: service.extension_kind as ExtensionsModuleServiceOwnerKind,
		extensionType: service.extension_type,
		serviceId: service.service_id,
		activationPolicy: service.activation_policy as ExtensionsModuleServiceActivationPolicy,
		state: service.state as ExtensionsModuleServiceState,
		desiredState: service.desired_state as ExtensionsModuleServiceDesiredState,
		enabled: service.enabled,
		healthy: service.healthy,
		lastStartedAt: service.last_started_at,
		lastStoppedAt: service.last_stopped_at,
		lastError: service.last_error,
		startCount: service.start_count,
		uptimeMs: service.uptime_ms,
	};
};
