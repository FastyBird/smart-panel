<template>
	<el-scrollbar view-class="h-full">
		<nav
			:aria-label="t('application.navigation.label')"
			:class="[ns.b(), ns.is('collapsed', props.collapsed)]"
			class="flex flex-col py-2"
		>
			<template
				v-for="section in sections"
				:key="section.group ?? 'top'"
			>
				<template v-if="section.group">
					<span
						v-if="props.collapsed"
						:class="ns.e('divider')"
						aria-hidden="true"
					/>
					<span
						v-else
						:class="ns.e('section')"
						data-test-id="navigation-section"
					>
						{{ groupLabel(section.group) }}
					</span>
				</template>

				<template
					v-for="entry in entriesOf(section.items)"
					:key="entry.name"
				>
					<el-tooltip
						:content="entry.title"
						:disabled="!props.collapsed"
						placement="right"
					>
						<router-link
							:to="{ name: entry.name }"
							:aria-label="props.collapsed ? entry.title : undefined"
							:aria-current="entry.name === activeName ? 'page' : undefined"
							:class="[ns.e('item'), ns.is('active', entry.name === activeName), ns.is('nested', entry.nested)]"
							:data-test-id="`navigation-item-${entry.name}`"
							@click="emit('click')"
						>
							<icon
								v-if="entry.icon"
								:icon="entry.icon"
								:class="ns.e('icon')"
								aria-hidden="true"
							/>
							<span
								v-if="!props.collapsed"
								:class="ns.e('label')"
							>
								{{ entry.title }}
							</span>
						</router-link>
					</el-tooltip>
				</template>
			</template>

			<template v-if="props.accountActions">
				<span
					:class="ns.e('divider')"
					aria-hidden="true"
				/>

				<button
					v-if="accountManager?.routes.edit"
					:class="ns.e('item')"
					type="button"
					data-test-id="navigation-user-edit"
					@click="onEditProfile"
				>
					<icon
						icon="mdi:user-edit"
						:class="ns.e('icon')"
						aria-hidden="true"
					/>
					<span :class="ns.e('label')">{{ t('application.userMenu.profileGeneralSettings') }}</span>
				</button>

				<button
					v-if="accountManager?.routes.security"
					:class="ns.e('item')"
					type="button"
					data-test-id="navigation-user-security"
					@click="onEditSecurity"
				>
					<icon
						icon="mdi:user-lock"
						:class="ns.e('icon')"
						aria-hidden="true"
					/>
					<span :class="ns.e('label')">{{ t('application.userMenu.profileSecuritySettings') }}</span>
				</button>

				<button
					v-if="accountManager?.routes.lock"
					:class="ns.e('item')"
					type="button"
					data-test-id="navigation-lock-screen"
					@click="onLock"
				>
					<icon
						icon="mdi:lock"
						:class="ns.e('icon')"
						aria-hidden="true"
					/>
					<span :class="ns.e('label')">{{ t('application.userMenu.lockScreen') }}</span>
				</button>

				<button
					:class="ns.e('item')"
					type="button"
					data-test-id="navigation-sign-out"
					@click="onSignOut"
				>
					<icon
						icon="mdi:logout"
						:class="ns.e('icon')"
						aria-hidden="true"
					/>
					<span :class="ns.e('label')">{{ t('application.userMenu.signOut') }}</span>
				</button>
			</template>
		</nav>
	</el-scrollbar>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import { ElScrollbar, ElTooltip, useNamespace } from 'element-plus';

import { Icon } from '@iconify/vue';

import { useConfigModules } from '../../modules/config/composables/useConfigModules';
import { type IMenuSection, type MenuGroup, type RouteRecord, groupMenuItems, useMenu } from '../composables/useMenu';
import { injectAccountManager } from '../services/account-manager';

import type { AppNavigationProps } from './app-navigation.types';

defineOptions({
	name: 'AppNavigation',
});

const props = withDefaults(defineProps<AppNavigationProps>(), {
	collapsed: false,
	accountActions: false,
});

const emit = defineEmits<{
	(e: 'click'): void;
}>();

interface INavigationEntry {
	name: string;
	title: string;
	icon: string | undefined;
	nested: boolean;
}

const router = useRouter();
const route = useRoute();

const { t } = useI18n();
const ns = useNamespace('app-navigation');

const { mainMenuItems } = useMenu();
const { configModules, enabled: isModuleEnabled, loaded: modulesLoaded, fetchConfigModules } = useConfigModules();

const accountManager = injectAccountManager();

const configFetchFailed = ref(false);

onBeforeMount(() => {
	fetchConfigModules().catch(() => {
		configFetchFailed.value = true;
	});
});

const visibleMenuItems = computed<{ [key: string]: RouteRecord }>(() => {
	return Object.fromEntries(
		Object.entries(mainMenuItems).filter(([, menuRoute]) => {
			const moduleType = menuRoute.meta?.module as string | undefined;

			if (!moduleType) return true;

			// While loading, hide module items to avoid showing disabled modules
			// If fetch failed, show all as degraded fallback
			if (!modulesLoaded.value) return configFetchFailed.value;

			if (!isModuleEnabled(moduleType)) return false;

			// Some routes depend on a feature within an otherwise enabled module —
			// the page exists but has nothing to show while the feature is off.
			const moduleFlag = menuRoute.meta?.moduleFlag as string | undefined;

			if (!moduleFlag) return true;

			const moduleConfig = configModules.value.find((module) => module.type === moduleType) as Record<string, unknown> | undefined;

			return moduleConfig?.[moduleFlag] === true;
		})
	);
});

const sections = computed<IMenuSection[]>((): IMenuSection[] => groupMenuItems(visibleMenuItems.value));

const GROUP_LABELS: Record<MenuGroup, string> = {
	home: 'application.navigation.groups.home',
	'wall-displays': 'application.navigation.groups.wallDisplays',
	integrations: 'application.navigation.groups.integrations',
	system: 'application.navigation.groups.system',
};

const groupLabel = (group: MenuGroup): string => t(GROUP_LABELS[group]);

const titleOf = (item: RouteRecord): string => {
	const title = item.meta?.title;

	return typeof title === 'function' ? String(title()) : String(title ?? '');
};

const iconOf = (item: RouteRecord): string | undefined => (typeof item.meta?.icon === 'string' ? item.meta.icon : undefined);

// A menu item with menu children (Configuration → Modules, Plugins) lists them indented below it
const entriesOf = (items: RouteRecord[]): INavigationEntry[] =>
	items.flatMap((item): INavigationEntry[] => [
		{ name: String(item.name), title: titleOf(item), icon: iconOf(item), nested: false },
		...Object.values(item.children ?? {}).map(
			(child): INavigationEntry => ({ name: String(child.name), title: titleOf(child), icon: iconOf(child), nested: true })
		),
	]);

// The deepest menu entry on the current route: a child when it matches, otherwise its parent
const activeName = computed<string | undefined>((): string | undefined => {
	const matched = new Set(route.matched.map((record) => record.name));

	for (const section of sections.value) {
		for (const item of section.items) {
			if (!matched.has(item.name)) {
				continue;
			}

			const child = Object.values(item.children ?? {}).find((candidate) => matched.has(candidate.name));

			return String(child?.name ?? item.name);
		}
	}

	return undefined;
});

const onLock = (): void => {
	if (accountManager) {
		accountManager.lock?.();

		if (accountManager.routes.lock) {
			router.push({ name: accountManager.routes.lock });
		}

		emit('click');
	}
};

const onSignOut = (): void => {
	if (accountManager) {
		accountManager.signOut();

		router.push({ name: accountManager.routes.signIn });
	}
};

const onEditProfile = (): void => {
	if (accountManager) {
		router.push({ name: accountManager.routes.edit });

		emit('click');
	}
};

const onEditSecurity = (): void => {
	if (accountManager) {
		router.push({ name: accountManager.routes.security });

		emit('click');
	}
};
</script>

<style rel="stylesheet/scss" lang="scss" scoped>
@use 'app-navigation.scss';
</style>
