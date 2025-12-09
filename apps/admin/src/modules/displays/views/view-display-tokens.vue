<template>
	<div class="p-4">
		<h3 class="text-lg font-semibold mb-2">
			{{ t('displaysModule.detail.tokens.title') }}
		</h3>
		<p class="text-gray-500 text-sm mb-4">
			{{ t('displaysModule.detail.tokens.description') }}
		</p>

		<div
			v-loading="isLoadingTokens"
			class="min-h-[100px]"
		>
			<el-table
				v-if="tokens.length > 0"
				:data="tokens"
				style="width: 100%"
			>
				<el-table-column
					prop="name"
					label="Name"
					min-width="150"
				/>

				<el-table-column
					prop="created_at"
					label="Created"
					width="180"
				>
					<template #default="{ row }">
						{{ formatDate(row.created_at) }}
					</template>
				</el-table-column>

				<el-table-column
					prop="expires_at"
					label="Expires"
					width="180"
				>
					<template #default="{ row }">
						{{ row.expires_at ? formatDate(row.expires_at) : 'Never' }}
					</template>
				</el-table-column>

				<el-table-column
					prop="revoked"
					label="Status"
					width="100"
				>
					<template #default="{ row }">
						<el-tag :type="row.revoked ? 'danger' : 'success'">
							{{ row.revoked ? 'Revoked' : 'Active' }}
						</el-tag>
					</template>
				</el-table-column>
			</el-table>

			<div
				v-else-if="!isLoadingTokens"
				class="text-center py-8 text-gray-500"
			>
				{{ t('displaysModule.detail.tokens.noTokens') }}
			</div>
		</div>

		<div
			v-if="tokens.length > 0"
			class="mt-6"
		>
			<el-button
				type="danger"
				:loading="isRevoking"
				@click="onRevokeToken"
			>
				<template #icon>
					<icon icon="mdi:key-remove" />
				</template>
				{{ t('displaysModule.actions.revokeToken') }}
			</el-button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElMessage, ElMessageBox, ElTable, ElTableColumn, ElTag } from 'element-plus';

import { Icon } from '@iconify/vue';

import { useDisplay } from '../composables/composables';

import type { IViewDisplayTokensProps } from './view-display-tokens.types';

defineOptions({
	name: 'ViewDisplayTokens',
});

const props = defineProps<IViewDisplayTokensProps>();

const { t } = useI18n();

const displayId = computed(() => props.id);
const { tokens, fetchTokens, revokeToken } = useDisplay(displayId);

const isLoadingTokens = ref(false);
const isRevoking = ref(false);

const formatDate = (date: string): string => {
	const d = new Date(date);
	return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
};

const loadTokens = async (): Promise<void> => {
	isLoadingTokens.value = true;
	try {
		await fetchTokens();
	} finally {
		isLoadingTokens.value = false;
	}
};

const onRevokeToken = (): void => {
	ElMessageBox.confirm(t('displaysModule.detail.tokens.revokeConfirm'), t('displaysModule.actions.revokeToken'), {
		confirmButtonText: 'Revoke',
		cancelButtonText: 'Cancel',
		type: 'warning',
	})
		.then(async () => {
			isRevoking.value = true;
			try {
				const result = await revokeToken();
				if (result) {
					ElMessage.success(t('displaysModule.detail.tokens.revoked'));
				}
			} catch {
				ElMessage.error('Failed to revoke token');
			} finally {
				isRevoking.value = false;
			}
		})
		.catch(() => {
			// Cancelled
		});
};

onMounted(() => {
	loadTokens();
});
</script>
