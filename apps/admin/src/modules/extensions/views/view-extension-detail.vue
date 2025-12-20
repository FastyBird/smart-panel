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
	>
		<template
			v-if="extension"
			#extra
		>
			<div class="flex items-center">
				<el-button
					v-if="hasConfiguration"
					type="primary"
					plain
					class="px-4! ml-2!"
					@click="onOpenConfiguration"
				>
					<template #icon>
						<icon icon="mdi:cog" />
					</template>

					{{ t('extensionsModule.buttons.configure') }}
				</el-button>
				<el-button
					:type="extension.enabled ? 'danger' : 'success'"
					plain
					class="px-4! ml-2!"
					:disabled="!extension.canToggleEnabled"
					@click="onToggleEnabled"
				>
					<template #icon>
						<icon :icon="extension.enabled ? 'mdi:power-off' : 'mdi:power'" />
					</template>

					{{ extension.enabled ? t('extensionsModule.buttons.disable') : t('extensionsModule.buttons.enable') }}
				</el-button>
				<el-button
					v-if="extension.links?.documentation"
					plain
					class="px-4! ml-2!"
					@click="openLink(extension.links.documentation)"
				>
					<template #icon>
						<icon icon="mdi:book-open-page-variant" />
					</template>
				</el-button>
				<el-button
					v-if="extension.links?.repository"
					plain
					class="px-4! ml-2!"
					@click="openLink(extension.links.repository)"
				>
					<template #icon>
						<icon icon="mdi:github" />
					</template>
				</el-button>
				<el-button
					v-if="extension.links?.bugsTracking"
					plain
					class="px-4! ml-2!"
					@click="openLink(extension.links.bugsTracking)"
				>
					<template #icon>
						<icon icon="mdi:bug" />
					</template>
				</el-button>
			</div>
		</template>
	</view-header>

	<!-- Large devices: flex container with tabs -->
	<div
		v-if="isMDDevice"
		class="flex flex-col flex-1 min-h-0 mx-2 mb-2"
	>
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
			<!-- Info card -->
			<el-card
				shadow="never"
				class="mt-2 mb-2 shrink-0"
				body-class="p-0!"
			>
				<dl class="grid grid-cols-[auto_1fr_auto_1fr] m-0">
					<!-- Row 1: Type | Kind -->
					<dt
						class="b-b b-b-solid b-r b-r-solid py-1 px-2 flex items-center justify-end"
						style="background: var(--el-fill-color-light)"
					>
						{{ t('extensionsModule.labels.type') }}
					</dt>
					<dd class="b-b b-b-solid b-r b-r-solid m-0 p-2 flex items-center min-w-[8rem]">
						<el-text>{{ extension.type }}</el-text>
					</dd>
					<dt
						class="b-b b-b-solid b-r b-r-solid py-1 px-2 flex items-center justify-end"
						style="background: var(--el-fill-color-light)"
					>
						{{ t('extensionsModule.labels.kind') }}
					</dt>
					<dd class="b-b b-b-solid m-0 p-2 flex items-center min-w-[8rem]">
						<el-tag
							:type="extension.kind === ExtensionKind.MODULE ? 'primary' : 'success'"
							size="small"
						>
							{{ extension.kind === ExtensionKind.MODULE ? t('extensionsModule.labels.module') : t('extensionsModule.labels.plugin') }}
						</el-tag>
					</dd>

					<!-- Row 2: Source | Status -->
					<dt
						class="b-b b-b-solid b-r b-r-solid py-1 px-2 flex items-center justify-end"
						style="background: var(--el-fill-color-light)"
					>
						{{ t('extensionsModule.labels.source') }}
					</dt>
					<dd class="b-b b-b-solid b-r b-r-solid m-0 p-2 flex items-center min-w-[8rem]">
						<el-tag
							:type="extension.isCore ? 'warning' : undefined"
							size="small"
						>
							{{ extension.isCore ? t('extensionsModule.labels.core') : t('extensionsModule.labels.addon') }}
						</el-tag>
					</dd>
					<dt
						class="b-b b-b-solid b-r b-r-solid py-1 px-2 flex items-center justify-end"
						style="background: var(--el-fill-color-light)"
					>
						{{ t('extensionsModule.labels.status') }}
					</dt>
					<dd class="b-b b-b-solid m-0 p-2 flex items-center min-w-[8rem]">
						<el-tag
							:type="extension.enabled ? 'success' : 'info'"
							size="small"
						>
							{{ extension.enabled ? t('extensionsModule.labels.enabled') : t('extensionsModule.labels.disabled') }}
						</el-tag>
					</dd>

					<!-- Row 3: Version | Author -->
					<dt
						class="b-b b-b-solid b-r b-r-solid py-1 px-2 flex items-center justify-end"
						style="background: var(--el-fill-color-light)"
					>
						{{ t('extensionsModule.labels.version') }}
					</dt>
					<dd class="b-b b-b-solid b-r b-r-solid m-0 p-2 flex items-center min-w-[8rem]">
						<el-text>{{ extension.version ?? '-' }}</el-text>
					</dd>
					<dt
						class="b-b b-b-solid b-r b-r-solid py-1 px-2 flex items-center justify-end"
						style="background: var(--el-fill-color-light)"
					>
						{{ t('extensionsModule.labels.author') }}
					</dt>
					<dd class="b-b b-b-solid m-0 p-2 flex items-center min-w-[8rem]">
						<el-text>{{ extension.author ?? '-' }}</el-text>
					</dd>

					<!-- Row 4: Description (full width) -->
					<dt
						v-if="extension.description"
						class="b-r b-r-solid py-1 px-2 flex items-center justify-end"
						style="background: var(--el-fill-color-light)"
					>
						{{ t('extensionsModule.labels.description') }}
					</dt>
					<dd
						v-if="extension.description"
						class="col-span-3 m-0 p-2 flex items-center"
					>
						<el-text>{{ extension.description }}</el-text>
					</dd>
				</dl>
			</el-card>

			<!-- Tabs for README, Docs, and Logs -->
			<el-card
				shadow="never"
				class="flex-1 min-h-0 flex flex-col"
				body-class="p-0! flex-1 min-h-0 flex flex-col"
			>
				<el-tabs
					v-model="activeTab"
					:class="['flex-1 min-h-0 flex flex-col', ns.e('tabs')]"
				>
					<el-tab-pane
						v-if="extension.readme"
						name="readme"
						class="h-full overflow-hidden"
					>
						<template #label>
							<div class="flex items-center gap-2 px-4">
								<icon icon="mdi:information-outline" />
								{{ t('extensionsModule.labels.readme') }}
							</div>
						</template>

						<el-scrollbar class="h-full">
							<div class="p-5">
								<markdown-renderer :content="extension.readme" />
							</div>
						</el-scrollbar>
					</el-tab-pane>
					<el-tab-pane
						v-if="extension.docs"
						name="docs"
						class="h-full overflow-hidden"
					>
						<template #label>
							<div class="flex items-center gap-2 px-4">
								<icon icon="mdi:book-open-page-variant" />
								{{ t('extensionsModule.labels.documentation') }}
							</div>
						</template>

						<el-scrollbar class="h-full">
							<div class="p-5">
								<markdown-renderer :content="extension.docs" />
							</div>
						</el-scrollbar>
					</el-tab-pane>
					<el-tab-pane
						name="logs"
						class="h-full overflow-hidden"
					>
						<template #label>
							<div class="flex items-center gap-2 px-4">
								<icon icon="mdi:console" />
								{{ t('extensionsModule.labels.logs') }}
							</div>
						</template>

						<extension-logs
							v-model:live="logsLive"
							:extension-type="extension.type"
						/>
					</el-tab-pane>
				</el-tabs>
			</el-card>
		</template>
	</div>

	<!-- Small devices: scrollable container with stacked cards -->
	<el-scrollbar
		v-else
		class="grow-1 flex flex-col lt-sm:mx-1 sm:mx-2 lt-sm:mb-1 sm:mb-2"
	>
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
			<!-- Info card -->
			<el-card
				shadow="never"
				class="mt-2 mb-2"
				body-class="p-0!"
			>
				<dl class="grid grid-cols-[auto_1fr_auto_1fr] m-0">
					<!-- Row 1: Type | Kind -->
					<dt
						class="b-b b-b-solid b-r b-r-solid py-1 px-2 flex items-center justify-end"
						style="background: var(--el-fill-color-light)"
					>
						{{ t('extensionsModule.labels.type') }}
					</dt>
					<dd class="b-b b-b-solid b-r b-r-solid m-0 p-2 flex items-center min-w-[8rem]">
						<el-text>{{ extension.type }}</el-text>
					</dd>
					<dt
						class="b-b b-b-solid b-r b-r-solid py-1 px-2 flex items-center justify-end"
						style="background: var(--el-fill-color-light)"
					>
						{{ t('extensionsModule.labels.kind') }}
					</dt>
					<dd class="b-b b-b-solid m-0 p-2 flex items-center min-w-[8rem]">
						<el-tag
							:type="extension.kind === ExtensionKind.MODULE ? 'primary' : 'success'"
							size="small"
						>
							{{ extension.kind === ExtensionKind.MODULE ? t('extensionsModule.labels.module') : t('extensionsModule.labels.plugin') }}
						</el-tag>
					</dd>

					<!-- Row 2: Source | Status -->
					<dt
						class="b-b b-b-solid b-r b-r-solid py-1 px-2 flex items-center justify-end"
						style="background: var(--el-fill-color-light)"
					>
						{{ t('extensionsModule.labels.source') }}
					</dt>
					<dd class="b-b b-b-solid b-r b-r-solid m-0 p-2 flex items-center min-w-[8rem]">
						<el-tag
							:type="extension.isCore ? 'warning' : undefined"
							size="small"
						>
							{{ extension.isCore ? t('extensionsModule.labels.core') : t('extensionsModule.labels.addon') }}
						</el-tag>
					</dd>
					<dt
						class="b-b b-b-solid b-r b-r-solid py-1 px-2 flex items-center justify-end"
						style="background: var(--el-fill-color-light)"
					>
						{{ t('extensionsModule.labels.status') }}
					</dt>
					<dd class="b-b b-b-solid m-0 p-2 flex items-center min-w-[8rem]">
						<el-tag
							:type="extension.enabled ? 'success' : 'info'"
							size="small"
						>
							{{ extension.enabled ? t('extensionsModule.labels.enabled') : t('extensionsModule.labels.disabled') }}
						</el-tag>
					</dd>

					<!-- Row 3: Version | Author -->
					<dt
						class="b-b b-b-solid b-r b-r-solid py-1 px-2 flex items-center justify-end"
						style="background: var(--el-fill-color-light)"
					>
						{{ t('extensionsModule.labels.version') }}
					</dt>
					<dd class="b-b b-b-solid b-r b-r-solid m-0 p-2 flex items-center min-w-[8rem]">
						<el-text>{{ extension.version ?? '-' }}</el-text>
					</dd>
					<dt
						class="b-b b-b-solid b-r b-r-solid py-1 px-2 flex items-center justify-end"
						style="background: var(--el-fill-color-light)"
					>
						{{ t('extensionsModule.labels.author') }}
					</dt>
					<dd class="b-b b-b-solid m-0 p-2 flex items-center min-w-[8rem]">
						<el-text>{{ extension.author ?? '-' }}</el-text>
					</dd>

					<!-- Row 4: Description (full width) -->
					<dt
						v-if="extension.description"
						class="b-r b-r-solid py-1 px-2 flex items-center justify-end"
						style="background: var(--el-fill-color-light)"
					>
						{{ t('extensionsModule.labels.description') }}
					</dt>
					<dd
						v-if="extension.description"
						class="col-span-3 m-0 p-2 flex items-center"
					>
						<el-text>{{ extension.description }}</el-text>
					</dd>
				</dl>
			</el-card>

			<!-- README card -->
			<el-card
				v-if="extension.readme"
				shadow="never"
				class="mb-2"
			>
				<template #header>
					<span class="font-semibold">{{ t('extensionsModule.labels.readme') }}</span>
				</template>
				<markdown-renderer :content="extension.readme" />
			</el-card>

			<!-- Docs card -->
			<el-card
				v-if="extension.docs"
				shadow="never"
				class="mb-2"
			>
				<template #header>
					<span class="font-semibold">{{ t('extensionsModule.labels.documentation') }}</span>
				</template>
				<markdown-renderer :content="extension.docs" />
			</el-card>

			<!-- Logs card -->
			<el-card
				shadow="never"
				class="mb-2"
			>
				<template #header>
					<span class="font-semibold">{{ t('extensionsModule.labels.logs') }}</span>
				</template>
				<extension-logs
					v-model:live="logsLive"
					:extension-type="extension.type"
				/>
			</el-card>
		</template>
	</el-scrollbar>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRouter } from 'vue-router';

import { ElButton, ElCard, ElIcon, ElResult, ElScrollbar, ElSkeleton, ElTabPane, ElTabs, ElTag, ElText, useNamespace } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBarButton, AppBarButtonAlign, AppBarHeading, AppBreadcrumbs, MarkdownRenderer, ViewHeader, useBreakpoints } from '../../../common';
import { useModules } from '../../config/composables/useModules';
import { usePlugins } from '../../config/composables/usePlugins';
import { ExtensionLogs } from '../components/components';
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
const { meta } = useMeta({});

const ns = useNamespace('view-extension-detail');

const { isMDDevice } = useBreakpoints();

const { extension, isLoading, fetchExtension } = useExtension({ type: () => props.type });

watch(
	(): boolean => extension.value !== null,
	(val: boolean): void => {
		if (val) {
			meta.title = t('extensionsModule.meta.extensions.detail.title', { extension: extension.value?.name });
		}
	}, { immediate: true }
);

// Re-fetch when navigating between extension detail pages (Vue Router reuses component)
watch(
	() => props.type,
	(): void => {
		fetchExtension().catch((error: unknown): void => {
			const err = error as Error;
			throw new ExtensionsException('Something went wrong', err);
		});
	}
);

const { toggleEnabled } = useExtensionActions();
const { modules: configurableModules } = useModules();
const { plugins: configurablePlugins } = usePlugins();

const activeTab = ref<string>('logs');
const logsLive = ref<boolean>(false);

// Compute the default tab based on available content
const defaultTab = computed<string>(() => {
	if (extension.value?.readme) return 'readme';
	if (extension.value?.docs) return 'docs';
	return 'logs';
});

// Reset active tab when extension changes or when current tab becomes unavailable
watch(
	() => extension.value?.type,
	() => {
		activeTab.value = defaultTab.value;
	}
);

watch(
	defaultTab,
	(newDefault) => {
		// If current tab is no longer available, switch to the default
		const currentTabExists =
			activeTab.value === 'logs' ||
			(activeTab.value === 'readme' && extension.value?.readme) ||
			(activeTab.value === 'docs' && extension.value?.docs);

		if (!currentTabExists) {
			activeTab.value = newDefault;
		}
	},
	{ immediate: true }
);

const extensionIcon = computed<string>(() => {
	if (extension.value?.kind === ExtensionKind.MODULE) {
		return 'mdi:cube-outline';
	}
	return 'mdi:puzzle';
});

const hasConfiguration = computed<boolean>(() => {
	if (!extension.value) return false;

	if (extension.value.kind === ExtensionKind.MODULE) {
		return configurableModules.value.some((m) => m.type === props.type);
	}
	return configurablePlugins.value.some((p) => p.type === props.type);
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
				label: t('extensionsModule.breadcrumbs.extensions.detail', { extension: extension.value.name }),
				route: router.resolve({ name: RouteNames.EXTENSION_DETAIL, params: { type: props.type } }),
			});
		}

		return items;
	}
);

const onToggleEnabled = async (): Promise<void> => {
	if (!extension.value) return;
	await toggleEnabled(props.type, !extension.value.enabled);
};

const onOpenConfiguration = (): void => {
	if (extension.value?.kind === ExtensionKind.MODULE) {
		router.push({
			name: 'config_module-config_module_edit',
			params: { module: props.type },
		});
	} else {
		router.push({
			name: 'config_module-config_plugin_edit',
			params: { plugin: props.type },
		});
	}
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

<style lang="scss">
@use 'view-extension-detail.scss';
</style>
