import * as Sentry from '@sentry/vue';

import type { IStoresManager } from '../../../../common';
import { sessionStoreKey } from '../../store';

const profileHook = (storesManager: IStoresManager): boolean | { name: string } | undefined => {
	const sessionStore = storesManager.getStore(sessionStoreKey);

	if (import.meta.env.PROD && sessionStore.profile !== null) {
		Sentry.setUser({
			id: sessionStore.profile.id,
			email: sessionStore.profile.email ?? 'unknown@user.com',
		});
	}

	return;
};

export default profileHook;
