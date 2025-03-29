<template>
	<sign-in-form v-model:remote-form-result="remoteFormResult" />
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { useRouter } from 'vue-router';

import { RouteNames as AppRouteNames } from '../../../app.constants';
import { useEventBus } from '../../../common';
import { FormResult, type FormResultType } from '../auth.constants';
import { SignInForm } from '../components';

defineOptions({
	name: 'ViewSignIn',
});

const { t } = useI18n();
const router = useRouter();

const eventBus = useEventBus();

const remoteFormResult = ref<FormResultType>(FormResult.NONE);

watch(
	(): FormResult => remoteFormResult.value,
	(state: FormResultType): void => {
		if (state === FormResult.WORKING) {
			eventBus.emit('loadingOverlay', 10);
		} else {
			eventBus.emit('loadingOverlay', false);

			if (state === FormResult.OK) {
				router.push({ name: AppRouteNames.ROOT });
			}
		}
	}
);

useMeta({
	title: t('authModule.meta.sign.in.title'),
});
</script>
