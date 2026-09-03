<template>
	<el-card shadow="never">
		<template #header>
			<div class="flex items-center justify-between gap-2">
				<div class="flex items-center gap-2">
					<icon icon="mdi:lan-connect" />
					<span class="font-medium">{{ t('remoteAccessTailscalePlugin.headings.tailscale') }}</span>
				</div>
				<el-tag :type="stateTagType">{{ t(`remoteAccessModule.status.${displayState}`) }}</el-tag>
			</div>
		</template>

		<p
			v-if="displayMessage"
			class="text-sm text-gray-500 mb-2"
		>
			{{ displayMessage }}
		</p>

		<dl
			v-if="tailnet || dnsName || ipv4 || ipv6"
			class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm mb-2"
		>
			<template v-if="tailnet">
				<dt class="text-gray-500">{{ t('remoteAccessTailscalePlugin.fields.tailnet') }}</dt>
				<dd class="font-mono break-all">{{ tailnet }}</dd>
			</template>
			<template v-if="dnsName">
				<dt class="text-gray-500">{{ t('remoteAccessTailscalePlugin.fields.dnsName') }}</dt>
				<dd class="font-mono break-all">{{ dnsName }}</dd>
			</template>
			<template v-if="ipv4">
				<dt class="text-gray-500">{{ t('remoteAccessTailscalePlugin.fields.ipv4') }}</dt>
				<dd class="font-mono break-all">{{ ipv4 }}</dd>
			</template>
			<template v-if="ipv6">
				<dt class="text-gray-500">{{ t('remoteAccessTailscalePlugin.fields.ipv6') }}</dt>
				<dd class="font-mono break-all">{{ ipv6 }}</dd>
			</template>
		</dl>

		<div
			v-if="httpsEndpoint"
			class="flex items-center gap-2 text-sm mb-2"
		>
			<el-tag
				type="success"
				size="small"
			>
				{{ t('remoteAccessModule.texts.https') }}
			</el-tag>
			<span class="font-mono flex-1 break-all">{{ httpsEndpoint.url }}</span>
		</div>

		<div
			v-if="unsatisfiedRequirements.length > 0"
			class="flex flex-col gap-1 mb-2"
		>
			<div
				v-for="requirement in unsatisfiedRequirements"
				:key="requirement.code"
				class="flex items-center gap-2 text-sm text-orange-600"
			>
				<icon icon="mdi:alert-circle-outline" />
				<span>{{ requirement.message }}</span>
			</div>
		</div>

		<div class="flex flex-wrap gap-2 mt-2">
			<el-button
				v-if="actions.setup"
				type="primary"
				size="small"
				@click="openWizard('setup')"
			>
				{{ t('remoteAccessTailscalePlugin.buttons.setup') }}
			</el-button>

			<el-button
				v-if="actions.signIn"
				type="primary"
				size="small"
				@click="openWizard('signin')"
			>
				{{ t('remoteAccessTailscalePlugin.buttons.signIn') }}
			</el-button>

			<el-button
				v-if="actions.connect"
				size="small"
				:loading="isActingOnService"
				@click="onConnect"
			>
				{{ t('remoteAccessTailscalePlugin.buttons.connect') }}
			</el-button>

			<el-button
				v-if="actions.disconnect"
				size="small"
				:loading="isActingOnService"
				@click="onDisconnect"
			>
				{{ t('remoteAccessTailscalePlugin.buttons.disconnect') }}
			</el-button>

			<el-button
				v-if="actions.reconnect"
				size="small"
				:loading="isActingOnService"
				@click="onReconnect"
			>
				{{ t('remoteAccessTailscalePlugin.buttons.reconnect') }}
			</el-button>

			<el-button
				v-if="actions.signOut"
				size="small"
				:loading="isLoggingOut"
				@click="onSignOut"
			>
				{{ t('remoteAccessTailscalePlugin.buttons.signOut') }}
			</el-button>

			<el-button
				v-if="actions.resetPreferences"
				size="small"
				:loading="isResettingPreferences"
				@click="onResetPreferences"
			>
				{{ t('remoteAccessTailscalePlugin.buttons.resetPreferences') }}
			</el-button>
		</div>

		<tailscale-setup-wizard
			v-model:visible="wizardVisible"
			:initial-step="wizardStep"
		/>
	</el-card>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElCard, ElTag } from 'element-plus';

import { Icon } from '@iconify/vue';

import { useFlashMessage } from '../../../common';
import { useSession } from '../../../modules/auth/composables/composables';
import { useServiceActions } from '../../../modules/extensions';
import type { IRemoteAccessProviderCardProps } from '../../../modules/remote-access';
import { ExtensionsModuleServiceOwnerKind, UsersModuleUserRole } from '../../../openapi.constants';
import { useTailscaleStatus } from '../composables';
import { REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME } from '../remote-access-tailscale.constants';
import { resolveTailscaleProviderActions } from '../utils/provider-actions';

import type { TailscaleWizardStep } from './tailscale-setup-wizard.types';
import TailscaleSetupWizard from './tailscale-setup-wizard.vue';

defineOptions({
	name: 'TailscaleProviderCard',
});

const props = defineProps<IRemoteAccessProviderCardProps>();

const { t } = useI18n();
const flashMessage = useFlashMessage();

const { profile } = useSession();
const { status, requirements, isLoggingOut, isResettingPreferences, fetchStatus, logout, resetPreferences } = useTailscaleStatus();
const { startService, stopService, restartService, isActing } = useServiceActions();

onBeforeMount(async (): Promise<void> => {
	try {
		await fetchStatus();
	} catch {
		flashMessage.error(t('remoteAccessTailscalePlugin.messages.requestError'));
	}
});

// The plugin's own `GET /status` carries `requirements`, `authUrl` and `qr` that the
// module-level aggregate `provider` prop never does - prefer it once loaded, and fall back to
// the prop (kept fresh by the remote-access module itself) so the card never shows nothing while
// this plugin's own fetch is still in flight.
const displayState = computed(() => status.value?.state ?? props.provider.state);
const displayMessage = computed(() => status.value?.message ?? props.provider.message);
const displayDetails = computed(() => status.value?.details ?? props.provider.details);
const displayEndpoints = computed(() => status.value?.endpoints ?? props.provider.endpoints);

const detailString = (key: string): string | undefined => {
	const value = displayDetails.value[key];

	return typeof value === 'string' && value.length > 0 ? value : undefined;
};

const tailnet = computed(() => detailString('tailnet'));
const dnsName = computed(() => detailString('dnsName'));
const ipv4 = computed(() => detailString('ipv4'));
const ipv6 = computed(() => detailString('ipv6'));

const httpsEndpoint = computed(() => displayEndpoints.value.find((endpoint) => endpoint.https));

const unsatisfiedRequirements = computed(() => requirements.value.filter((requirement) => !requirement.satisfied));

const stateTagType = computed<'success' | 'warning' | 'danger' | 'info'>(() => {
	switch (displayState.value) {
		case 'connected':
			return 'success';
		case 'error':
			return 'danger';
		case 'connecting':
		case 'pending-auth':
		case 'pending-approval':
		case 'setup-required':
			return 'warning';
		default:
			return 'info';
	}
});

const isOwner = computed<boolean>(() => profile.value?.role === UsersModuleUserRole.owner);

const actions = computed(() =>
	resolveTailscaleProviderActions({
		state: displayState.value,
		hasTailnet: typeof tailnet.value !== 'undefined',
		isOwner: isOwner.value,
	})
);

const isActingOnService = computed<boolean>(() => isActing(ExtensionsModuleServiceOwnerKind.plugin, REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME, 'node'));

const onConnect = async (): Promise<void> => {
	await startService(ExtensionsModuleServiceOwnerKind.plugin, REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME, 'node');
};

const onDisconnect = async (): Promise<void> => {
	await stopService(ExtensionsModuleServiceOwnerKind.plugin, REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME, 'node');
};

const onReconnect = async (): Promise<void> => {
	await restartService(ExtensionsModuleServiceOwnerKind.plugin, REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME, 'node');
};

const onSignOut = async (): Promise<void> => {
	try {
		await logout();

		flashMessage.success(t('remoteAccessTailscalePlugin.messages.signedOut'));
	} catch {
		flashMessage.error(t('remoteAccessTailscalePlugin.messages.signOutFailed'));
	}
};

const onResetPreferences = async (): Promise<void> => {
	try {
		await resetPreferences();

		flashMessage.success(t('remoteAccessTailscalePlugin.messages.preferencesReset'));
	} catch {
		flashMessage.error(t('remoteAccessTailscalePlugin.messages.preferencesResetFailed'));
	}
};

const wizardVisible = ref<boolean>(false);
const wizardStep = ref<TailscaleWizardStep>('setup');

const openWizard = (step: TailscaleWizardStep): void => {
	wizardStep.value = step;
	wizardVisible.value = true;
};
</script>
