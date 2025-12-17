<template>
	<app-breadcrumbs :items="breadcrumbs" />

	<app-bar-heading
		v-if="!isMDDevice"
		teleport
	>
		<template #icon>
			<icon
				:icon="extensionIcon"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ extension?.name ?? t('extensionsModule.headings.detail') }}
		</template>

		<template #subtitle>
			{{ t('extensionsModule.subHeadings.detail') }}
		</template>
	</app-bar-heading>

	<app-bar-button
		v-if="!isMDDevice"
		:align="AppBarButtonAlign.LEFT"
		teleport
		small
		@click="router.push({ name: RouteNames.EXTENSIONS })"
	>
		<template #icon>
			<el-icon :size="24">
				<icon icon="mdi:chevron-left" />
			</el-icon>
		</template>

		<span class="uppercase">{{ t('extensionsModule.breadcrumbs.extensions.list') }}</span>
	</app-bar-button>

	<view-header
		:heading="extension?.name ?? t('extensionsModule.headings.detail')"
		:sub-heading="t('extensionsModule.subHeadings.detail')"
		:icon="extensionIcon"
	/>

	<el-scrollbar class="grow-1 flex flex-col lt-sm:mx-1 sm:mx-2 lt-sm:mb-1 sm:mb-2">
		<el-skeleton
			v-if="isLoading && !extension"
			:rows="10"
			animated
		/>

		<el-result
			v-else-if="!extension"
			icon="warning"
			:title="t('extensionsModule.messages.noExtensions')"
		>
			<template #extra>
				<el-button
					type="primary"
					@click="router.push({ name: RouteNames.EXTENSIONS })"
				>
					{{ t('extensionsModule.breadcrumbs.extensions.list') }}
				</el-button>
			</template>
		</el-result>

		<template v-else>
			<el-card
				shadow="never"
				class="mb-4"
			>
				<template #header>
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-3">
							<icon
								:icon="extensionIcon"
								class="text-2xl text-primary"
							/>
							<div>
								<h2 class="m-0 text-lg font-semibold">{{ extension.name }}</h2>
								<p class="m-0 text-sm text-gray-500">{{ extension.type }}</p>
							</div>
						</div>
						<div class="flex items-center gap-2">
							<el-tag
								:type="extension.kind === ExtensionKind.MODULE ? 'primary' : 'success'"
								size="default"
							>
								{{ extension.kind === ExtensionKind.MODULE ? t('extensionsModule.labels.module') : t('extensionsModule.labels.plugin') }}
							</el-tag>
							<el-tag
								v-if="extension.isCore"
								type="warning"
								size="default"
							>
								{{ t('extensionsModule.labels.core') }}
							</el-tag>
							<el-tag
								:type="extension.enabled ? 'success' : 'info'"
								size="default"
							>
								{{ extension.enabled ? t('extensionsModule.labels.enabled') : t('extensionsModule.labels.disabled') }}
							</el-tag>
						</div>
					</div>
				</template>

				<el-descriptions
					:column="2"
					border
				>
					<el-descriptions-item :label="t('extensionsModule.labels.type')">
						{{ extension.type }}
					</el-descriptions-item>
					<el-descriptions-item :label="t('extensionsModule.labels.status')">
						<el-switch
							:model-value="extension.enabled"
							:disabled="!extension.canToggleEnabled"
							:active-text="t('extensionsModule.labels.enabled')"
							:inactive-text="t('extensionsModule.labels.disabled')"
							@change="onToggleEnabled"
						/>
					</el-descriptions-item>
					<el-descriptions-item
						v-if="extension.version"
						:label="t('extensionsModule.labels.version')"
					>
						{{ extension.version }}
					</el-descriptions-item>
					<el-descriptions-item
						v-if="extension.author"
						:label="t('extensionsModule.labels.author')"
					>
						{{ extension.author }}
					</el-descriptions-item>
					<el-descriptions-item
						:label="t('extensionsModule.labels.configuration')"
						:span="2"
					>
						<el-button
							type="primary"
							size="small"
							@click="onOpenConfiguration"
						>
							<icon
								icon="mdi:cog"
								class="mr-1"
							/>
							{{ t('extensionsModule.buttons.configure') }}
						</el-button>
					</el-descriptions-item>
				</el-descriptions>
			</el-card>

			<el-card
				v-if="extension.description"
				shadow="never"
				class="mb-4"
			>
				<template #header>
					<span class="font-semibold">{{ t('extensionsModule.labels.description') }}</span>
				</template>
				<p class="m-0 leading-relaxed">{{ extension.description }}</p>
			</el-card>

			<el-card
				v-if="hasLinks"
				shadow="never"
			>
				<template #header>
					<span class="font-semibold">{{ t('extensionsModule.labels.links') }}</span>
				</template>
				<div class="flex flex-wrap gap-4">
					<el-button
						v-if="extension.links?.documentation"
						type="primary"
						@click="openLink(extension.links.documentation)"
					>
						<icon
							icon="mdi:book-open-page-variant"
							class="mr-2"
						/>
						{{ t('extensionsModule.buttons.documentation') }}
					</el-button>
					<el-button
						v-if="extension.links?.repository"
						@click="openLink(extension.links.repository)"
					>
						<icon
							icon="mdi:github"
							class="mr-2"
						/>
						{{ t('extensionsModule.buttons.repository') }}
					</el-button>
					<el-button
						v-if="extension.links?.bugsTracking"
						@click="openLink(extension.links.bugsTracking)"
					>
						<icon
							icon="mdi:bug"
							class="mr-2"
						/>
						{{ t('extensionsModule.buttons.issues') }}
					</el-button>
				</div>
			</el-card>
		</template>
	</el-scrollbar>
</template>

<script setup lang="ts">
import { computed, onBeforeMount } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRouter } from 'vue-router';

import { ElButton, ElCard, ElDescriptions, ElDescriptionsItem, ElIcon, ElResult, ElScrollbar, ElSkeleton, ElSwitch, ElTag } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBarButton, AppBarButtonAlign, AppBarHeading, AppBreadcrumbs, ViewHeader, useBreakpoints } from '../../../common';
import { useExtensionActions } from '../composables/composables';
import { useExtension } from '../composables/useExtension';
import { ExtensionKind, RouteNames } from '../extensions.constants';
import { ExtensionsException } from '../extensions.exceptions';

import type { IViewExtensionDetailProps } from './view-extension-detail.types';

defineOptions({
	name: 'ViewExtensionDetail',
});

const props = defineProps<IViewExtensionDetailProps>();

const router = useRouter();
const { t } = useI18n();

useMeta(() => ({
	title: extension.value?.name ?? t('extensionsModule.meta.extensions.detail.title'),
}));

const { isMDDevice } = useBreakpoints();

const { extension, isLoading, fetchExtension } = useExtension({ type: props.type });
const { toggleEnabled } = useExtensionActions();

const extensionIcon = computed<string>(() => {
	if (extension.value?.kind === ExtensionKind.MODULE) {
		return 'mdi:cube-outline';
	}
	return 'mdi:puzzle';
});

const hasLinks = computed<boolean>(() => {
	return !!(
		extension.value?.links?.documentation ||
		extension.value?.links?.repository ||
		extension.value?.links?.bugsTracking
	);
});

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => {
		const items: { label: string; route: RouteLocationResolvedGeneric }[] = [
			{
				label: t('extensionsModule.breadcrumbs.extensions.list'),
				route: router.resolve({ name: RouteNames.EXTENSIONS }),
			},
		];

		if (extension.value) {
			items.push({
				label: extension.value.name,
				route: router.resolve({ name: RouteNames.EXTENSION_DETAIL, params: { type: props.type } }),
			});
		}

		return items;
	}
);

const onToggleEnabled = async (value: boolean | string | number): Promise<void> => {
	await toggleEnabled(props.type, value as boolean);
};

const onOpenConfiguration = (): void => {
	const kind = extension.value?.kind === ExtensionKind.MODULE ? 'module' : 'plugin';
	router.push({
		name: 'config_module-extension',
		params: { type: props.type, kind },
	});
};

const openLink = (url: string): void => {
	window.open(url, '_blank', 'noopener,noreferrer');
};

onBeforeMount((): void => {
	fetchExtension().catch((error: unknown): void => {
		const err = error as Error;

		throw new ExtensionsException('Something went wrong', err);
	});
});
</script>
