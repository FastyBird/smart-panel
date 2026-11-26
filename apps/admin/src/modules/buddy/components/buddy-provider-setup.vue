<template>
	<div
		class="flex flex-col items-center"
		data-test-id="buddy-provider-setup"
	>
		<!-- Buddy cannot answer yet: says why, leads to the setup wizard, and lists the providers it could use -->
		<state-view
			kind="empty"
			icon="mdi:robot-confused-outline"
			:title="heading"
			:description="hint"
		>
			<template #action>
				<el-button
					type="primary"
					data-test-id="buddy-provider-setup-wizard"
					@click="router.push({ name: RouteNames.BUDDY_SETUP })"
				>
					<template #icon>
						<icon icon="mdi:magic-staff" />
					</template>
					{{ t('buddyModule.buttons.setupWizard.title') }}
				</el-button>
				<el-button
					plain
					data-test-id="buddy-provider-setup-configure"
					@click="router.push(configureRoute)"
				>
					{{ t('buddyModule.buttons.configure.title') }}
				</el-button>
			</template>
		</state-view>

		<section
			v-if="otherProviders.length > 0"
			:aria-labelledby="listHeadingId"
			class="w-full max-w-[480px] px-4 pb-6 box-border"
		>
			<h3
				:id="listHeadingId"
				class="text-card-title m-0 mb-2"
			>
				{{ t('buddyModule.texts.availableProviders') }}
			</h3>

			<ul class="m-0 p-0 list-none border border-solid border-light rounded-lg">
				<li
					v-for="provider in otherProviders"
					:key="provider.type"
					class="flex items-center justify-between gap-3 px-4 py-2 border-b border-b-solid border-light last:border-b-0"
				>
					<span class="text-body truncate">{{ provider.name }}</span>
					<status-tag
						:status="provider.configured ? 'ok' : 'info'"
						:label="provider.configured ? t('buddyModule.texts.configured') : t('buddyModule.texts.notConfigured')"
					/>
				</li>
			</ul>
		</section>
	</div>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue';
import { useI18n } from 'vue-i18n';
import { type RouteLocationRaw, useRouter } from 'vue-router';

import { ElButton } from 'element-plus';

import { Icon } from '@iconify/vue';

import { StateView, StatusTag } from '../../../common';
import { RouteNames as ConfigRouteNames } from '../../config/config.constants';
import { BUDDY_MODULE_NAME, RouteNames } from '../buddy.constants';
import type { IProviderStatus } from '../composables/useBuddyProviders';

defineOptions({
	name: 'BuddyProviderSetup',
});

const props = defineProps<{
	/** The provider Buddy is set to use, if any */
	selectedProvider?: IProviderStatus;
	providerStatuses: IProviderStatus[];
}>();

const { t } = useI18n();
const router = useRouter();

const listHeadingId = useId();

const otherProviders = computed<IProviderStatus[]>(() => props.providerStatuses.filter((p) => !p.selected));

const heading = computed<string>(() => {
	const selected = props.selectedProvider;

	if (!selected) {
		return t('buddyModule.texts.noProviderSelected');
	}

	if (!selected.enabled) {
		return t('buddyModule.texts.providerNotEnabled', { name: selected.name });
	}

	return t('buddyModule.texts.providerMissingConfig', { name: selected.name });
});

const hint = computed<string>(() => {
	const selected = props.selectedProvider;

	if (!selected) {
		return t('buddyModule.texts.noProviderSelectedHint');
	}

	if (!selected.enabled) {
		return t('buddyModule.texts.providerNotEnabledHint');
	}

	return t('buddyModule.texts.providerMissingConfigHint');
});

// Without a provider the module settings pick one; with one, its plugin settings finish it
const configureRoute = computed<RouteLocationRaw>(() =>
	props.selectedProvider
		? { name: ConfigRouteNames.CONFIG_PLUGIN_EDIT, params: { plugin: props.selectedProvider.type } }
		: { name: ConfigRouteNames.CONFIG_MODULE_EDIT, params: { module: BUDDY_MODULE_NAME } }
);
</script>
