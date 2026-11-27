<template>
	<!-- The host's identity row of a settings form (spec section 7): what is being set, how it runs, and whether it is on.
	     The plugin's own form follows, and the host's footer saves it -->
	<div
		class="flex flex-wrap items-center gap-3 px-4 tp:px-5 py-3 border-b border-b-solid border-light"
		data-test-id="config-identity"
	>
		<div
			class="flex items-center justify-center shrink-0 w-10 h-10 rounded-lg bg-fill-light text-secondary"
			aria-hidden="true"
		>
			<icon
				:icon="props.icon"
				width="22"
				height="22"
			/>
		</div>

		<div class="flex flex-col flex-1 min-w-[160px]">
			<span
				class="text-card-title"
				data-test-id="config-identity-name"
			>
				{{ props.name }}
			</span>
			<span
				v-if="props.meta"
				class="text-help"
				data-test-id="config-identity-meta"
			>
				{{ props.meta }}
			</span>
		</div>

		<status-tag
			v-if="props.status"
			:status="props.status.status"
			:label="props.status.label"
			data-test-id="config-identity-status"
		/>

		<label
			v-if="props.toggleable"
			class="flex items-center gap-2 text-label cursor-pointer"
		>
			{{ t('configModule.identity.enabled') }}
			<el-switch
				v-model="enabled"
				name="enabled"
				data-test-id="config-identity-enabled"
			/>
		</label>
	</div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElSwitch } from 'element-plus';

import { Icon } from '@iconify/vue';

import { StatusTag } from '../../../common';

import type { ConfigIdentityProps } from './config-identity.types';

defineOptions({
	name: 'ConfigIdentity',
});

const props = withDefaults(defineProps<ConfigIdentityProps>(), {
	meta: undefined,
	status: null,
	toggleable: false,
});

const enabled = defineModel<boolean>('enabled', { default: false });

const { t } = useI18n();
</script>
