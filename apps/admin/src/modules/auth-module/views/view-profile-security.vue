<template>
	<el-card v-if="isMDDevice">
		<settings-password-form
			v-if="profile"
			v-model:remote-form-submit="remoteFormSubmit"
			v-model:remote-form-result="remoteFormResult"
			v-model:remote-form-reset="remoteFormReset"
			:profile="profile"
		/>
	</el-card>

	<template v-else>
		<settings-password-form
			v-if="profile"
			v-model:remote-form-submit="remoteFormSubmit"
			v-model:remote-form-result="remoteFormResult"
			v-model:remote-form-reset="remoteFormReset"
			:profile="profile"
			:layout="Layout.PHONE"
		/>

		<el-button
			:loading="remoteFormResult === FormResult.WORKING"
			:disabled="remoteFormResult === FormResult.WORKING"
			type="primary"
			class="w-full mt-5"
			@click="onSave"
		>
			{{ t('authModule.buttons.save.title') }}
		</el-button>
	</template>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';

import { ElButton, ElCard } from 'element-plus';

import { injectStoresManager, useBreakpoints } from '../../../common';
import type { IUser } from '../../users-module';
import { FormResult, type FormResultType, Layout } from '../auth.constants';
import { SettingsPasswordForm } from '../components';
import { sessionStoreKey } from '../store';

import type { ViewProfileSecurityProps } from './view-profile-security.types';

defineOptions({
	name: 'ViewProfileSecurity',
});

const props = withDefaults(defineProps<ViewProfileSecurityProps>(), {
	remoteFormSubmit: false,
	remoteFormResult: FormResult.NONE,
	remoteFormReset: false,
});

const emit = defineEmits<{
	(e: 'update:remoteFormSubmit', remoteFormSubmit: boolean): void;
	(e: 'update:remoteFormResult', remoteFormResult: FormResultType): void;
	(e: 'update:remoteFormReset', remoteFormReset: boolean): void;
}>();

const { t } = useI18n();

const { isMDDevice } = useBreakpoints();

const storesManager = injectStoresManager();

const sessionStore = storesManager.getStore(sessionStoreKey);

const remoteFormSubmit = ref<boolean>(props.remoteFormSubmit);
const remoteFormResult = ref<FormResultType>(props.remoteFormResult);
const remoteFormReset = ref<boolean>(props.remoteFormReset);

const profile = computed<IUser | null>((): IUser | null => {
	return sessionStore.profile;
});

const onSave = (): void => {
	remoteFormSubmit.value = true;
};

watch(
	(): boolean => props.remoteFormSubmit,
	async (val: boolean): Promise<void> => {
		remoteFormSubmit.value = val;
	}
);

watch(
	(): boolean => props.remoteFormReset,
	async (val: boolean): Promise<void> => {
		remoteFormReset.value = val;
	}
);

watch(
	(): boolean => remoteFormSubmit.value,
	async (val: boolean): Promise<void> => {
		emit('update:remoteFormSubmit', val);
	}
);

watch(
	(): FormResultType => remoteFormResult.value,
	async (val: FormResultType): Promise<void> => {
		emit('update:remoteFormResult', val);
	}
);

watch(
	(): boolean => remoteFormReset.value,
	async (val: boolean): Promise<void> => {
		emit('update:remoteFormReset', val);
	}
);

useMeta({
	title: t('authModule.meta.profile.security.title'),
});
</script>
