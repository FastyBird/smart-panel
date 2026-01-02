<template>
	<app-bar-heading teleport>
		<template #icon>
			<icon
				icon="mdi:key"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ t('displaysModule.detail.tokens.title') }}
		</template>

		<template #subtitle>
			{{ t('displaysModule.detail.tokens.subtitle') }}
		</template>
	</app-bar-heading>

	<app-breadcrumbs :items="breadcrumbs" />

	<div class="p-4">
		<el-alert
			:title="t('displaysModule.detail.tokens.description')"
			type="info"
			:closable="false"
			class="mb-4"
		/>

        <div
            v-loading="isLoadingTokens"
            class="min-h-[100px]"
		>
			<el-table
				v-loading="isLoadingTokens"
				:element-loading-text="t('displaysModule.texts.loadingDisplays')"
				:data="tokens"
				class="w-full"
			>
				<template #empty>
					<div
						v-if="isLoadingTokens"
						class="h-full w-full leading-normal"
					>
						<el-result class="h-full w-full">
							<template #icon>
								<icon-with-child :size="80">
									<template #primary>
										<icon icon="mdi:key" />
									</template>
									<template #secondary>
										<icon icon="mdi:database-refresh" />
									</template>
								</icon-with-child>
							</template>
						</el-result>
					</div>

					<div
						v-else
						class="h-full w-full leading-normal"
					>
						<el-result class="h-full w-full">
							<template #icon>
								<icon-with-child :size="80">
									<template #primary>
										<icon icon="mdi:key" />
									</template>
									<template #secondary>
										<icon icon="mdi:information" />
									</template>
								</icon-with-child>
							</template>

							<template #title>
								{{ t('displaysModule.detail.tokens.noTokens') }}
							</template>
						</el-result>
					</div>
				</template>

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
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRouter } from 'vue-router';

import { ElAlert, ElButton, ElMessageBox, ElResult, ElTable, ElTableColumn, ElTag, vLoading } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBarHeading, AppBreadcrumbs, IconWithChild, useFlashMessage } from '../../../common';
import { RouteNames } from '../displays.constants';
import { useDisplay } from '../composables/composables';
import type { IDisplay } from '../store/displays.store.types';

import type { IViewDisplayTokensProps } from './view-display-tokens.types';

defineOptions({
	name: 'ViewDisplayTokens',
});

const props = defineProps<IViewDisplayTokensProps>();

const router = useRouter();
const { t } = useI18n();
const { meta } = useMeta({});
const flashMessage = useFlashMessage();

const displayId = computed(() => props.id);
const { display, tokens, isLoading, fetchTokens, revokeToken } = useDisplay(displayId);

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => {
		return [
			{
				label: t('displaysModule.breadcrumbs.displays.list'),
				route: router.resolve({ name: RouteNames.DISPLAYS }),
			},
			{
				label: t('displaysModule.breadcrumbs.displays.detail', { display: display.value?.name || display.value?.macAddress }),
				route: router.resolve({ name: RouteNames.DISPLAY, params: { id: props.id } }),
			},
			{
				label: t('displaysModule.breadcrumbs.displays.tokens'),
				route: router.resolve({ name: RouteNames.DISPLAY_TOKENS, params: { id: props.id } }),
			},
		];
	}
);

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
					flashMessage.success(t('displaysModule.detail.tokens.revoked'));
				}
			} catch {
				flashMessage.error('Failed to revoke token');
			} finally {
				isRevoking.value = false;
			}
		})
		.catch(() => {
			// Cancelled
		});
};

watch(
	(): IDisplay | null => display.value,
	(val: IDisplay | null): void => {
		if (val !== null) {
			meta.title = t('displaysModule.meta.displays.tokens.title', { display: val.name || val.macAddress });
		} else if (val === null && !isLoading.value) {
			// Display was deleted, redirect to list
			router.push({ name: RouteNames.DISPLAYS });
		}
	},
	{ immediate: true },
);

onMounted(() => {
	loadTokens();
});
</script>
