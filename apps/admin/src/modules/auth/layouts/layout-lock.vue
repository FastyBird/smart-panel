<template>
	<!-- Template 10, standalone: the locked session, with whose it is above the unlock form -->
	<standalone-layout
		:title="t('authModule.headings.lockScreen')"
		:subtitle="t('authModule.subHeadings.lockScreen')"
	>
		<div
			class="flex items-center gap-3 p-3 rounded-lg bg-fill-light min-w-0"
			data-test-id="lock-account"
		>
			<user-avatar
				:size="40"
				:email="accountManager?.details.value?.email"
			/>

			<div class="flex flex-col min-w-0">
				<span
					v-if="accountManager?.details.value?.name"
					class="text-card-title truncate"
				>
					{{ accountManager.details.value.name }}
				</span>

				<span
					v-if="accountManager?.details.value?.email"
					class="text-help truncate"
				>
					{{ accountManager.details.value.email }}
				</span>
			</div>
		</div>

		<router-view />
	</standalone-layout>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { StandaloneLayout, UserAvatar } from '../../../common';
import { injectAccountManager } from '../../../common/services/account-manager';

defineOptions({
	name: 'LayoutLock',
});

const { t } = useI18n();

const accountManager = injectAccountManager();
</script>
