import type { App } from 'vue';

import type { Pinia } from 'pinia';

import { injectStoresManager } from './services/store';
import { listQueryStoreKey } from './store/keys';
import { registerListQueryStore } from './store/list.query.store';

export default {
	install: (app: App, options: { store: Pinia }): void => {
		const storesManager = injectStoresManager(app);

		const listQueryStore = registerListQueryStore(options.store);

		app.provide(listQueryStoreKey, listQueryStore);
		storesManager.addStore(listQueryStoreKey, listQueryStore);
	},
};
