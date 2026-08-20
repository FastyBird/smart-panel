import { CONFIG_MODULE_EVENT_PREFIX, EventType } from '../config.constants';

interface IConfigChangeEvent {
	event: string;
	payload: Record<string, unknown>;
}

interface IConfigChangeTargets {
	configModulesStore: { get: (payload: { type: string; force?: boolean }) => Promise<unknown> };
	configPluginsStore: { get: (payload: { type: string; force?: boolean }) => Promise<unknown> };
	logger: { warn: (message: string, ...args: unknown[]) => void; error: (message: string, ...args: unknown[]) => void };
}

/**
 * Reacts to the backend announcing that a module or plugin configuration
 * changed.
 *
 * The announcement carries only *which* configuration changed - `{ source,
 * type }` - not the configuration itself. That is deliberate: the event is
 * broadcast to every connected client, panel displays included, and plugin
 * configurations hold API keys, tokens and passwords. So the changed entry is
 * refetched over the authenticated endpoint, which applies the redaction the
 * socket cannot.
 *
 * Lives here rather than inline in the module installer so it can be tested:
 * the previous version read `payload.modules` / `payload.plugins`, arrays the
 * backend has never sent, so every configuration change was silently dropped
 * and the admin only noticed one after a reload.
 */
export const handleConfigChangeEvent = (data: IConfigChangeEvent, targets: IConfigChangeTargets): void => {
	const { configModulesStore, configPluginsStore, logger } = targets;

	if (!data?.event?.startsWith(CONFIG_MODULE_EVENT_PREFIX)) {
		return;
	}

	if (data.payload === null || typeof data.payload !== 'object') {
		return;
	}

	switch (data.event) {
		case EventType.CONFIG_UPDATED: {
			const { source, type } = data.payload;

			if (typeof source !== 'string' || source === '') {
				logger.warn('Config change event carried no source:', data.payload);

				break;
			}

			if (type === 'module') {
				// `force: true` because this call is racing an already-in-flight `get()` for the same
				// type just as often as it is racing `fetch()`: reusing that in-flight request's result
				// would silently hand back a read taken before this change happened. See config-modules.store.ts.
				configModulesStore.get({ type: source, force: true }).catch((error: unknown): void => {
					logger.error('Failed to refresh a module config after a change event', error);
				});
			} else if (type === 'plugin') {
				configPluginsStore.get({ type: source, force: true }).catch((error: unknown): void => {
					logger.error('Failed to refresh a plugin config after a change event', error);
				});
			} else {
				logger.warn('Config change event carried an unknown target type:', String(type));
			}

			break;
		}

		default:
			logger.warn('Unhandled config module event:', data.event);
	}
};
