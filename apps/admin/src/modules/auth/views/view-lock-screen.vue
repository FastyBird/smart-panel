<template>
	<unlock-form
		v-model:remote-form-result="remoteFormResult"
		@sign-out="onSignOut"
		@sign-in-as-other="onSignInAsOther"
	/>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { useRouter } from 'vue-router';

import { RouteNames as AppRouteNames } from '../../../app.constants';
import { useEventBus } from '../../../common';
import { injectAccountManager } from '../../../common/services/account-manager';
import { FormResult, type FormResultType } from '../auth.constants';
import { UnlockForm } from '../components/components';

defineOptions({
	name: 'ViewLockScreen',
});

const { t } = useI18n();
const router = useRouter();

const eventBus = useEventBus();
const accountManager = injectAccountManager();

const remoteFormResult = ref<FormResultType>(FormResult.NONE);

watch(
	(): FormResult => remoteFormResult.value,
	(state: FormResultType): void => {
		if (state === FormResult.WORKING) {
			eventBus.emit('loadingOverlay', 10);
		} else {
			eventBus.emit('loadingOverlay', false);

			if (state === FormResult.OK) {
				if (accountManager?.unlock) {
					accountManager.unlock();
				}

				router.push({ name: AppRouteNames.ROOT });
			}
		}
	}
);

const onSignOut = (): void => {
	if (accountManager) {
		accountManager.signOut();

		router.push({ name: accountManager.routes.signIn });
	}
};

const onSignInAsOther = (): void => {
	if (accountManager) {
		accountManager.signOut();

		router.push({ name: accountManager.routes.signUp });
	}
};

useMeta({
	title: t('authModule.meta.lock.screen.title'),
});
</script>
