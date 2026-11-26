<template>
	<app-breadcrumbs :items="breadcrumbs" />

	<view-header
		:title="extension?.name ?? t('extensionsModule.headings.detail')"
		:subtitle="t('extensionsModule.subHeadings.detail')"
		:icon="extensionIcon"
		:back="{ name: RouteNames.EXTENSIONS }"
		:actions="phoneActions"
	>
		<template
			v-if="extension"
			#actions
		>
			<el-tooltip
				:content="toggleDisabledReason"
				:disabled="extension.canToggleEnabled"
				placement="bottom"
			>
				<span>
					<el-button
						plain
						:disabled="!extension.canToggleEnabled"
						data-test-id="extension-toggle-enabled"
						@click="onToggleEnabled"
					>
						<template #icon>
							<icon :icon="extension.enabled ? 'mdi:power-off' : 'mdi:power'" />
						</template>
						{{ extension.enabled ? t('extensionsModule.buttons.disable') : t('extensionsModule.buttons.enable') }}
					</el-button>
				</span>
			</el-tooltip>

			<el-button
				v-if="hasConfiguration"
				type="primary"
				data-test-id="extension-configure"
				@click="onOpenConfiguration"
			>
				<template #icon>
					<icon icon="mdi:cog" />
				</template>
				{{ t('extensionsModule.buttons.configure') }}
			</el-button>
		</template>
	</view-header>

	<!-- Template 3: the summary card, then tabs with a card each; the page scrolls as one -->
	<div class="page-pad flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto box-border [&>*]:shrink-0">
		<state-view
			v-if="isLoading && !extension"
			kind="loading"
			:icon="extensionIcon"
			:title="t('extensionsModule.texts.loadingExtension')"
		/>

		<state-view
			v-else-if="!extension"
			kind="not-found"
			icon="mdi:puzzle-remove-outline"
			:title="t('extensionsModule.texts.extensionNotFound')"
			data-test-id="extension-not-found"
		>
			<template #action>
				<el-button
					plain
					@click="router.push({ name: RouteNames.EXTENSIONS })"
				>
					{{ t('extensionsModule.breadcrumbs.extensions.list') }}
				</el-button>
			</template>
		</state-view>

		<template v-else>
			<extension-summary :extension="extension" />

			<el-tabs v-model="activeTab">
				<el-tab-pane
					v-if="extension.readme"
					name="readme"
				>
					<template #label>
						<span class="flex items-center gap-2">
							<icon
								icon="mdi:information-outline"
								aria-hidden="true"
							/>
							{{ t('extensionsModule.labels.readme') }}
						</span>
					</template>

					<el-card
						shadow="never"
						body-class="p-5!"
					>
						<markdown-renderer :content="extension.readme" />
					</el-card>
				</el-tab-pane>

				<el-tab-pane
					v-if="extension.docs"
					name="docs"
				>
					<template #label>
						<span class="flex items-center gap-2">
							<icon
								icon="mdi:book-open-page-variant"
								aria-hidden="true"
							/>
							{{ t('extensionsModule.labels.documentation') }}
						</span>
					</template>

					<el-card
						shadow="never"
						body-class="p-5!"
					>
						<markdown-renderer :content="extension.docs" />
					</el-card>
				</el-tab-pane>

				<el-tab-pane
					v-if="hasActions"
					name="actions"
				>
					<template #label>
						<span class="flex items-center gap-2">
							<icon
								icon="mdi:lightning-bolt"
								aria-hidden="true"
							/>
							{{ t('extensionsModule.actions.labels.tab') }}
						</span>
					</template>

					<el-card
						shadow="never"
						body-class="p-0!"
					>
						<extension-actions :extension-type="props.type" />
					</el-card>
				</el-tab-pane>

				<el-tab-pane name="logs">
					<template #label>
						<span class="flex items-center gap-2">
							<icon
								icon="mdi:console"
								aria-hidden="true"
							/>
							{{ t('extensionsModule.labels.logs') }}
						</span>
					</template>

					<!-- The log keeps a height of its own, so a live stream scrolls inside it rather than growing the page -->
					<el-card
						shadow="never"
						class="h-[60vh] min-h-[360px]"
						body-class="p-0! h-full flex flex-col overflow-hidden"
					>
						<extension-logs
							v-model:live="logsLive"
							:extension-type="props.type"
						/>
					</el-card>
				</el-tab-pane>
			</el-tabs>
		</template>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRouter } from 'vue-router';

import { ElButton, ElCard, ElTabPane, ElTabs, ElTooltip } from 'element-plus';

import { Icon } from '@iconify/vue';

import { type AppBarAction, AppBreadcrumbs, MarkdownRenderer, StateView, ViewHeader } from '../../../common';
import { useModules } from '../../config/composables/useModules';
import { usePlugins } from '../../config/composables/usePlugins';
import { ExtensionActions, ExtensionLogs, ExtensionSummary } from '../components/components';
import { useExtensionActions } from '../composables/composables';
import { useActionsProvider } from '../composables/useActions';
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

const { extension, isLoading, fetchExtension } = useExtension({ type: () => props.type });

watch(
	(): boolean => extension.value !== null,
	(val: boolean): void => {
		if (val) {
			meta.title = t('extensionsModule.meta.extensions.detail.title', { extension: extension.value?.name });
		}
	},
	{ immediate: true }
);

const { toggleEnabled } = useExtensionActions();
const { modules: configurableModules } = useModules();
const { plugins: configurablePlugins } = usePlugins();
const { actions: registeredActions, fetchActions } = useActionsProvider();

// Re-fetch when navigating between extension detail pages (Vue Router reuses component)
watch(
	() => props.type,
	(newType: string): void => {
		fetchExtension().catch((error: unknown): void => {
			const err = error as Error;
			throw new ExtensionsException('Something went wrong', err);
		});

		fetchActions(newType).catch(() => {
			// Actions are optional, silently ignore errors
		});
	}
);

const hasActions = computed<boolean>(() => registeredActions.value.length > 0);

const activeTab = ref<string>('readme');
const logsLive = ref<boolean>(false);

// Compute the default tab based on available content
const defaultTab = computed<string>(() => {
	if (extension.value?.readme) return 'readme';
	if (extension.value?.docs) return 'docs';
	if (hasActions.value) return 'actions';
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
			(activeTab.value === 'docs' && extension.value?.docs) ||
			(activeTab.value === 'actions' && hasActions.value);

		if (!currentTabExists) {
			activeTab.value = newDefault;
		}
	},
	{ immediate: true }
);

const extensionIcon = computed<string>(() => {
	if (extension.value?.kind === ExtensionKind.module) {
		return 'mdi:cube-outline';
	}
	return 'mdi:puzzle';
});

const hasConfiguration = computed<boolean>(() => {
	if (!extension.value) return false;

	if (extension.value.kind === ExtensionKind.module) {
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
	if (extension.value?.kind === ExtensionKind.module) {
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

const toggleDisabledReason = computed<string>(() => {
	if (extension.value?.isCore && extension.value.kind === ExtensionKind.module) {
		return t('extensionsModule.tooltips.coreModuleCannotBeDisabled');
	}

	return t('extensionsModule.tooltips.cannotToggleEnabled');
});

// The phone app bar: Configure, and Enable or Disable when the extension allows it
const phoneActions = computed<AppBarAction[]>((): AppBarAction[] => {
	if (!extension.value) {
		return [];
	}

	const actions: AppBarAction[] = [];

	if (extension.value.canToggleEnabled) {
		actions.push({
			icon: extension.value.enabled ? 'mdi:power-off' : 'mdi:power',
			label: extension.value.enabled ? t('extensionsModule.buttons.disable') : t('extensionsModule.buttons.enable'),
			handler: onToggleEnabled,
		});
	}

	if (hasConfiguration.value) {
		actions.push({ icon: 'mdi:cog', label: t('extensionsModule.buttons.configure'), handler: onOpenConfiguration });
	}

	return actions;
});

onBeforeMount((): void => {
	fetchExtension().catch((error: unknown): void => {
		const err = error as Error;

		throw new ExtensionsException('Something went wrong', err);
	});

	fetchActions(props.type).catch(() => {
		// Actions are optional, silently ignore errors
	});
});
</script>
