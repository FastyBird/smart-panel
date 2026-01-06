import type { App } from 'vue';

import type { IModuleOptions } from '../../app.types';
import { type IModule, type ModuleInjectionKey, injectModulesManager, injectSockets, injectStoresManager } from '../../common';

import { EventType, INTENTS_MODULE_EVENT_PREFIX, INTENTS_MODULE_NAME } from './intents.constants';
import { intentsStoreKey, registerIntentsStore } from './store/stores';

const intentsAdminModuleKey: ModuleInjectionKey<IModule> = Symbol('FB-Module-Intents');

export default {
	install: (app: App, options: IModuleOptions): void => {
		const storesManager = injectStoresManager(app);
		const sockets = injectSockets(app);
		const modulesManager = injectModulesManager(app);

		const intentsStore = registerIntentsStore(options.store);

		app.provide(intentsStoreKey, intentsStore);
		storesManager.addStore(intentsStoreKey, intentsStore);

		modulesManager.addModule(intentsAdminModuleKey, {
			type: INTENTS_MODULE_NAME,
			name: 'Intents',
			description: 'Intent orchestration for UI anti-jitter and optimistic updates',
			elements: [],
			isCore: true,
		});

		sockets.on('event', (data: { event: string; payload: object; metadata: object }): void => {
			if (!data?.event?.startsWith(INTENTS_MODULE_EVENT_PREFIX)) {
				return;
			}

			if (data.payload === null || typeof data.payload !== 'object') {
				return;
			}

			const payload = data.payload as Record<string, unknown>;

			if (!('intent_id' in payload) || typeof payload.intent_id !== 'string') {
				return;
			}

			switch (data.event) {
				case EventType.INTENT_CREATED:
					try {
						intentsStore.onEvent({
							id: payload.intent_id,
							data: payload,
						});
					} catch (error) {
						console.warn(`[INTENTS] Failed to process ${data.event} event:`, error);
					}
					break;

				case EventType.INTENT_COMPLETED:
				case EventType.INTENT_EXPIRED:
					intentsStore.unset({
						id: payload.intent_id,
					});
					break;

				default:
					// Ignore other events
					break;
			}
		});

		// Clear all intents on socket disconnect
		sockets.on('disconnect', (): void => {
			intentsStore.clear();
		});
	},
};
