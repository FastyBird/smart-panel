<template>
	<app-breadcrumbs :items="breadcrumbs" />

	<template v-if="!isEditRoute || inDrawer">
		<view-header
			:title="t('configModule.headings.config')"
			:subtitle="t('configModule.subHeadings.config')"
			icon="mdi:cog"
		/>

		<!-- Template 5: the modules, then the plugins by family, one card each with the anchor nav from desktop. A row
		     opens its settings in the drawer (template 4); on phone they are a page of their own -->
		<edit-drawer-layout
			:open="isEditRoute"
			:before-close="onCloseDrawer"
			@close="onCloseDrawer()"
		>
			<settings-layout
				ref="layoutEl"
				:sections="sections"
			>
				<template
					v-if="loadFailed"
					#banner
				>
					<el-alert
						type="error"
						:title="t('configModule.messages.loadError')"
						:closable="false"
						show-icon
						data-test-id="config-load-error"
					>
						<el-button
							size="small"
							class="mt-2"
							@click="onRetry"
						>
							{{ t('configModule.buttons.retry.title') }}
						</el-button>
					</el-alert>
				</template>

				<settings-section
					id="modules"
					:title="t('configModule.sections.modules.title')"
					:description="t('configModule.sections.modules.description')"
					:icon="CONFIG_MODULE_ICON"
				>
					<config-list
						:items="moduleItems"
						:active-id="route.name === RouteNames.CONFIG_MODULE_EDIT ? routeParam('module') : null"
						@open="onModuleEdit"
					/>
				</settings-section>

				<settings-section
					v-for="group in pluginGroups"
					:id="`plugins-${group.family.id}`"
					:key="group.family.id"
					:title="t(`configModule.families.${group.family.id}.title`)"
					:description="t(`configModule.families.${group.family.id}.description`)"
					:icon="group.family.icon"
				>
					<config-list
						:items="group.items"
						:active-id="route.name === RouteNames.CONFIG_PLUGIN_EDIT ? routeParam('plugin') : null"
						@open="onPluginEdit"
					/>
				</settings-section>
			</settings-layout>

			<template #form>
				<view-error>
					<template #icon>
						<icon icon="mdi:cog" />
					</template>
					<template #message>
						{{ t('configModule.messages.loadError') }}
					</template>

					<!-- Keyed by the module or plugin: switching to another one remounts its form, so a save goes to the one
					     now shown -->
					<suspense>
						<router-view
							:key="formKey"
							v-slot="{ Component }"
						>
							<component
								:is="Component"
								@update:remote-form-changed="onFormChanged"
							/>
						</router-view>
					</suspense>
				</view-error>
			</template>
		</edit-drawer-layout>
	</template>

	<router-view
		v-else
		:key="formKey"
		v-slot="{ Component }"
	>
		<component :is="Component" />
	</router-view>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeMount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationRaw, useRoute, useRouter } from 'vue-router';

import { ElAlert, ElButton } from 'element-plus';

import { Icon } from '@iconify/vue';

import {
	AppBreadcrumbs,
	EditDrawerLayout,
	SettingsLayout,
	type SettingsLayoutSection,
	SettingsSection,
	ViewError,
	ViewHeader,
	provideEditDrawer,
} from '../../../common';
import { ConfigList, type ConfigListItem } from '../components/components';
import { useConfigDiscard } from '../composables/useConfigDiscard';
import { useConfigPlugins } from '../composables/useConfigPlugins';
import { useModules } from '../composables/useModules';
import { usePlugins } from '../composables/usePlugins';
import { RouteNames } from '../config.constants';
import { CONFIG_MODULE_ICON, CONFIG_PLUGIN_FAMILIES, type ConfigPluginFamily, configPluginFamily } from '../utils/config-families';

defineOptions({
	name: 'LayoutConfig',
});

const router = useRouter();
const route = useRoute();
const { t } = useI18n();

const { modules } = useModules();
const { plugins } = usePlugins();
const { enabled, loaded, fetchConfigPlugins } = useConfigPlugins();

const { confirmDiscard } = useConfigDiscard();

// Not named after the component: a ref called settingsLayout would stand in for <settings-layout> in the template
const layoutEl = ref<InstanceType<typeof SettingsLayout> | null>(null);

const remoteFormChanged = ref<boolean>(false);

const loadFailed = ref<boolean>(false);

const isEditRoute = computed<boolean>((): boolean => route.name === RouteNames.CONFIG_MODULE_EDIT || route.name === RouteNames.CONFIG_PLUGIN_EDIT);

// Template 4: the settings open next to this page from tablet portrait up, as a page of their own on phone
const { inDrawer } = provideEditDrawer((): boolean => isEditRoute.value);

const routeParam = (name: 'module' | 'plugin'): string | null => {
	const value = route.params[name];

	return typeof value === 'string' ? value : null;
};

// One form per module or plugin: a new key remounts the routed form
const formKey = computed<string>((): string => `${String(route.name)}:${routeParam('module') ?? routeParam('plugin') ?? ''}`);

const onFormChanged = (changed: boolean): void => {
	remoteFormChanged.value = changed;
};

// The changed flag belongs to the form that is open; any route change that replaces or closes it clears the flag
watch(formKey, (): void => {
	remoteFormChanged.value = false;
});

const moduleItems = computed<ConfigListItem[]>((): ConfigListItem[] =>
	modules.value.map((module) => ({ id: module.type, name: module.name, description: module.description, icon: CONFIG_MODULE_ICON }))
);

// The plugins by family, in the families' order; a family without plugins is left out
const pluginGroups = computed<{ family: ConfigPluginFamily; items: ConfigListItem[] }[]>(
	(): { family: ConfigPluginFamily; items: ConfigListItem[] }[] =>
		CONFIG_PLUGIN_FAMILIES.map((family) => ({
			family,
			items: plugins.value
				.filter((plugin) => configPluginFamily(plugin.type).id === family.id)
				.map(
					(plugin): ConfigListItem => ({
						id: plugin.type,
						name: plugin.name,
						description: plugin.description,
						icon: family.icon,
						// Until the settings are read the state is not known, so no tag is shown rather than a wrong one
						tag: loaded.value
							? enabled(plugin.type)
								? { status: 'ok', label: t('configModule.states.enabled') }
								: { status: 'info', label: t('configModule.states.disabled') }
							: undefined,
					})
				),
		})).filter((group) => group.items.length > 0)
);

const sections = computed<SettingsLayoutSection[]>((): SettingsLayoutSection[] => [
	{ id: 'modules', label: t('configModule.sections.modules.title'), icon: CONFIG_MODULE_ICON, count: moduleItems.value.length },
	...pluginGroups.value.map((group) => ({
		id: `plugins-${group.family.id}`,
		label: t(`configModule.families.${group.family.id}.title`),
		icon: group.family.icon,
		count: group.items.length,
	})),
]);

const breadcrumbs = computed<{ label: string; route: RouteLocationRaw }[]>((): { label: string; route: RouteLocationRaw }[] => [
	{
		label: t('configModule.breadcrumbs.config'),
		route: router.resolve({ name: RouteNames.CONFIG }),
	},
]);

// Next to a docked form the page stays usable: replacing a changed form asks first, as closing it does
const canReplaceOpenForm = async (): Promise<boolean> => !isEditRoute.value || !remoteFormChanged.value || confirmDiscard();

const openSettings = async (location: RouteLocationRaw, current: boolean): Promise<void> => {
	if (current || !(await canReplaceOpenForm())) {
		return;
	}

	if (inDrawer.value) {
		await router.replace(location);
	} else {
		await router.push(location);
	}
};

const onModuleEdit = (module: string): void => {
	void openSettings(
		{ name: RouteNames.CONFIG_MODULE_EDIT, params: { module } },
		route.name === RouteNames.CONFIG_MODULE_EDIT && routeParam('module') === module
	);
};

const onPluginEdit = (plugin: string): void => {
	void openSettings(
		{ name: RouteNames.CONFIG_PLUGIN_EDIT, params: { plugin } },
		route.name === RouteNames.CONFIG_PLUGIN_EDIT && routeParam('plugin') === plugin
	);
};

const onCloseDrawer = async (done?: () => void): Promise<void> => {
	if (remoteFormChanged.value && !(await confirmDiscard())) {
		return;
	}

	remoteFormChanged.value = false;

	await router.replace({ name: route.name === RouteNames.CONFIG_PLUGIN_EDIT ? RouteNames.CONFIG_PLUGINS : RouteNames.CONFIG_MODULES });

	done?.();
};

const load = (): void => {
	loadFailed.value = false;

	fetchConfigPlugins().catch((): void => {
		loadFailed.value = true;
	});
};

const onRetry = (): void => {
	load();
};

// The plugins route, or a plugin's settings opened by a link, start at that plugin's family; the modules route at the
// modules
const scrollToRoute = (): void => {
	const plugin = routeParam('plugin');

	if (route.name === RouteNames.CONFIG_PLUGIN_EDIT && plugin) {
		layoutEl.value?.goTo(`plugins-${configPluginFamily(plugin).id}`);
	} else if (route.name === RouteNames.CONFIG_PLUGINS && pluginGroups.value.length > 0) {
		layoutEl.value?.goTo(`plugins-${pluginGroups.value[0].family.id}`);
	} else if (route.name === RouteNames.CONFIG_MODULES) {
		layoutEl.value?.goTo('modules');
	}
};

// Moving between the modules and the plugins routes (the menu) scrolls there; closing a form returns to the list route
// too, and then the page stays where it was
watch(
	(): unknown => route.name,
	(name, previous): void => {
		const fromForm = previous === RouteNames.CONFIG_MODULE_EDIT || previous === RouteNames.CONFIG_PLUGIN_EDIT;

		if (!fromForm && (name === RouteNames.CONFIG_MODULES || name === RouteNames.CONFIG_PLUGINS)) {
			void nextTick(scrollToRoute);
		}
	}
);

onBeforeMount((): void => {
	load();
});

onMounted((): void => {
	void nextTick(scrollToRoute);
});

useMeta({
	title: t('configModule.meta.config.title'),
});
</script>
