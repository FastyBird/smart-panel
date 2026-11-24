<template>
	<!-- Template 3, the Access tokens tab: the tokens the display signs in with, and Revoke -->
	<el-card
		shadow="never"
		body-class="flex flex-col gap-4 p-4!"
		data-test-id="display-tokens"
	>
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div class="flex flex-col gap-0.5 min-w-0 flex-1">
				<span class="text-card-title">{{ t('displaysModule.detail.tokens.title') }}</span>
				<span class="text-help">{{ t('displaysModule.detail.tokens.description') }}</span>
			</div>

			<el-button
				v-if="tokens.length > 0"
				type="danger"
				plain
				:loading="revoking"
				data-test-id="revoke-display-tokens"
				@click="onRevoke"
			>
				<template #icon>
					<icon icon="mdi:key-remove" />
				</template>

				{{ t('displaysModule.actions.revokeToken') }}
			</el-button>
		</div>

		<state-view
			v-if="loading"
			kind="loading"
			icon="mdi:key"
			:title="t('displaysModule.detail.tokens.loading')"
		/>

		<state-view
			v-else-if="tokens.length === 0"
			kind="empty"
			icon="mdi:key"
			:title="t('displaysModule.detail.tokens.noTokens')"
			:description="t('displaysModule.detail.tokens.noTokensHint')"
		/>

		<ul
			v-else
			class="m-0 p-0 list-none border border-solid border-light rounded-lg"
			data-test-id="display-tokens-list"
		>
			<li
				v-for="token in tokens"
				:key="token.id"
				class="flex flex-col gap-3 p-4 border-b border-b-solid border-light last:border-b-0"
				data-test-id="display-token"
			>
				<div class="flex flex-wrap items-center gap-2">
					<span class="text-card-title">{{ token.name }}</span>
					<status-tag
						:status="token.revoked ? 'danger' : 'ok'"
						:label="token.revoked ? t('displaysModule.detail.tokens.status.revoked') : t('displaysModule.detail.tokens.status.active')"
					/>
				</div>

				<span
					v-if="token.description"
					class="text-help"
				>
					{{ token.description }}
				</span>

				<copy-field
					:value="token.id"
					:label="t('displaysModule.detail.tokens.fields.id')"
					class="max-w-[480px]"
				/>

				<kv-grid
					:items="[
						{ label: t('displaysModule.detail.tokens.fields.created'), value: formatDate(token.created_at) },
						{
							label: t('displaysModule.detail.tokens.fields.expires'),
							value: token.expires_at ? formatDate(token.expires_at) : t('displaysModule.detail.tokens.never'),
						},
					]"
					:cols="2"
				/>
			</li>
		</ul>
	</el-card>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElCard, ElMessageBox } from 'element-plus';

import { Icon } from '@iconify/vue';

import { CopyField, KvGrid, StateView, StatusTag, useFlashMessage } from '../../../common';
import { useDisplay } from '../composables/composables';
import type { IDisplay } from '../store/displays.store.types';

defineOptions({
	name: 'DisplayTokens',
});

const props = defineProps<{ display: IDisplay }>();

const { t, locale } = useI18n();
const flashMessage = useFlashMessage();

const { tokens, fetchTokens, revokeToken } = useDisplay(computed<IDisplay['id']>((): IDisplay['id'] => props.display.id));

const loading = ref<boolean>(false);
const revoking = ref<boolean>(false);

const formatDate = (date: string): string =>
	new Intl.DateTimeFormat(locale.value, {
		dateStyle: 'medium',
		timeStyle: 'short',
	}).format(new Date(date));

// Revoke is destructive: the dialog repeats the action, and the display has to register again afterwards
const onRevoke = async (): Promise<void> => {
	try {
		await ElMessageBox.confirm(t('displaysModule.detail.tokens.revokeConfirm'), t('displaysModule.actions.revokeToken'), {
			confirmButtonText: t('displaysModule.actions.revokeToken'),
			cancelButtonText: t('displaysModule.buttons.cancel.title'),
			type: 'warning',
		});
	} catch {
		return;
	}

	revoking.value = true;

	try {
		if (await revokeToken()) {
			flashMessage.success(t('displaysModule.detail.tokens.revoked'));
		}
	} catch {
		flashMessage.error(t('displaysModule.detail.tokens.revokeError'));
	} finally {
		revoking.value = false;
	}
};

onMounted(async (): Promise<void> => {
	loading.value = true;

	try {
		await fetchTokens();
	} finally {
		loading.value = false;
	}
});
</script>
