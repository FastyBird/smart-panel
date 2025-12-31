import { computed, type ComputedRef } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import type { IUser } from '../../users';
import { sessionStoreKey } from '../store/keys';

export interface IUseSession {
	profile: ComputedRef<IUser | null>;
	isSignedIn: ComputedRef<boolean>;
}

export const useSession = (): IUseSession => {
	const storesManager = injectStoresManager();
	const sessionStore = storesManager.getStore(sessionStoreKey);

	const { profile: profileRef } = storeToRefs(sessionStore);

	const profile = computed<IUser | null>((): IUser | null => {
		return profileRef.value;
	});

	const isSignedIn = computed<boolean>((): boolean => {
		return sessionStore.isSignedIn();
	});

	return {
		profile,
		isSignedIn,
	};
};
