<template>
	<el-card
		v-if="isMDDevice"
		shadow="never"
	>
		<settings-password-form
			v-if="profile"
			v-model:remote-form-submit="remoteFormSubmit"
			v-model:remote-form-result="remoteFormResult"
			v-model:remote-form-reset="remoteFormReset"
			:profile="profile"
		/>
	</el-card>

	<div v-else>
		<settings-password-form
			v-if="profile"
			v-model:remote-form-submit="remoteFormSubmit"
			v-model:remote-form-result="remoteFormResult"
			v-model:remote-form-reset="remoteFormReset"
			:profile="profile"
			:layout="Layout.PHONE"
		/>
	</div>

	<el-card
		v-if="isMDDevice"
		shadow="never"
		class="mt-4"
		body-class="p-0!"
	>
		<template #header>
			<div class="flex items-center justify-between">
				<span class="font-semibold">
					{{ t('authModule.tokens.title') }}
				</span>

				<el-button
					type="primary"
					size="small"
					@click="tokensList?.openCreateDialog()"
				>
					<template #icon>
						<icon icon="mdi:key-plus" />
					</template>
					{{ t('authModule.tokens.create') }}
				</el-button>
			</div>
		</template>

		<personal-tokens-list ref="tokensList" />
	</el-card>

	<div
		v-else
		class="mt-4"
	>
		<div class="flex items-center justify-between mb-3">
			<span class="font-semibold">
				{{ t('authModule.tokens.title') }}
			</span>

			<el-button
				type="primary"
				size="small"
				@click="tokensList?.openCreateDialog()"
			>
				<template #icon>
					<icon icon="mdi:key-plus" />
				</template>
				{{ t('authModule.tokens.create') }}
			</el-button>
		</div>

		<personal-tokens-list ref="tokensList" />
	</div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';

import { ElButton, ElCard } from 'element-plus';

import { Icon } from '@iconify/vue';

import { useBreakpoints } from '../../../common';
import { FormResult, type FormResultType, Layout } from '../auth.constants';
import { PersonalTokensList, SettingsPasswordForm } from '../components/components';
import { useSession } from '../composables/composables';

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

const { profile } = useSession();

const tokensList = ref<InstanceType<typeof PersonalTokensList> | null>(null);

const remoteFormSubmit = ref<boolean>(props.remoteFormSubmit);
const remoteFormResult = ref<FormResultType>(props.remoteFormResult);
const remoteFormReset = ref<boolean>(props.remoteFormReset);

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
