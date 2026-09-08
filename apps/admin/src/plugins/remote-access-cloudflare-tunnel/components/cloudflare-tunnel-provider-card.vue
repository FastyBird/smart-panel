<template>
	<el-card
		class="provider-card"
		shadow="hover"
		header-class="py-2!"
		body-class="py-3!"
		footer-class="py-2! px-4!"
	>
		<template #header>
			<div class="provider-card__header">
				<div class="provider-card__heading">
					<icon
						icon="mdi:cloud-lock-outline"
						class="provider-card__icon"
					/>
					<h3 class="provider-card__title">{{ t('remoteAccessCloudflareTunnelPlugin.headings.cloudflareTunnel') }}</h3>
				</div>
				<div class="provider-card__tags">
					<el-tag
						:type="stateTagType"
						size="small"
					>
						{{ t(`remoteAccessModule.status.${displayState}`) }}
					</el-tag>
					<el-tag
						v-if="httpsEndpoint"
						type="success"
						size="small"
					>
						{{ t('remoteAccessModule.texts.https') }}
					</el-tag>
				</div>
			</div>
		</template>

		<div class="provider-card__content">
			<el-alert
				v-if="showCannotBeUsedYetBanner"
				type="warning"
				:title="t('remoteAccessCloudflareTunnelPlugin.texts.cannotBeUsedYetTitle')"
				:description="firstUnsatisfiedRequirement?.message"
				:closable="false"
				show-icon
			/>

			<p
				v-if="displayMessage"
				class="provider-card__description"
			>
				{{ displayMessage }}
			</p>
			<p
				v-else
				class="provider-card__description"
			>
				{{ t('remoteAccessCloudflareTunnelPlugin.texts.cardDescription') }}
			</p>

			<div
				v-if="hostname || connectorId || readyConnections !== undefined"
				class="provider-card__meta"
			>
				<div
					v-if="hostname"
					class="provider-card__meta-item"
				>
					<span class="provider-card__meta-label">{{ t('remoteAccessCloudflareTunnelPlugin.fields.hostname') }}:</span>
					<span class="font-mono break-all">{{ hostname }}</span>
				</div>
				<div
					v-if="connectorId"
					class="provider-card__meta-item"
				>
					<span class="provider-card__meta-label">{{ t('remoteAccessCloudflareTunnelPlugin.fields.connectorId') }}:</span>
					<span class="font-mono break-all">{{ connectorId }}</span>
				</div>
				<div
					v-if="readyConnections !== undefined"
					class="provider-card__meta-item"
				>
					<span class="provider-card__meta-label">{{ t('remoteAccessCloudflareTunnelPlugin.fields.readyConnections') }}:</span>
					<span>{{ readyConnections }}</span>
				</div>
			</div>

			<div
				v-if="httpsEndpoint"
				class="text-sm font-mono break-all"
			>
				{{ httpsEndpoint.url }}
			</div>

			<div
				v-if="unsatisfiedRequirements.length > 0"
				class="flex flex-col gap-1"
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

			<el-alert
				v-if="actionErrorHintKey"
				type="warning"
				:title="t(actionErrorHintKey)"
				:closable="false"
				show-icon
			/>
		</div>

		<template
			v-if="documentationLink || primaryActionKey"
			#footer
		>
			<div class="provider-card__footer">
				<div class="provider-card__links">
					<el-button
						v-if="documentationLink"
						type="primary"
						size="small"
						link
						@click.stop="openLink(documentationLink)"
					>
						<icon
							icon="mdi:book-open-page-variant"
							class="mr-1"
						/>
						{{ t('extensionsModule.buttons.documentation') }}
					</el-button>
				</div>

				<el-dropdown
					v-if="primaryActionKey"
					split-button
					size="small"
					trigger="click"
					:type="primaryActionType"
					:loading="primaryActionLoading"
					@click="onPrimaryAction"
					@command="onCommand"
				>
					{{ actionLabel(primaryActionKey) }}
					<template #dropdown>
						<el-dropdown-menu>
							<el-dropdown-item
								v-for="key in secondaryActionKeys"
								:key="key"
								:command="key"
							>
								{{ actionLabel(key) }}
							</el-dropdown-item>
						</el-dropdown-menu>
					</template>
				</el-dropdown>
			</div>
		</template>

		<cloudflare-tunnel-setup-wizard
			v-model:visible="wizardVisible"
			:initial-step="wizardStep"
		/>
	</el-card>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElCard, ElDropdown, ElDropdownItem, ElDropdownMenu, ElMessageBox, ElTag } from 'element-plus';

import { Icon } from '@iconify/vue';

import { useFlashMessage } from '../../../common';
import { useSession } from '../../../modules/auth/composables/composables';
import { useExtension, useServiceActions } from '../../../modules/extensions';
import { type IRemoteAccessProviderCardProps, useRemoteAccessStatus } from '../../../modules/remote-access';
import { ExtensionsModuleServiceOwnerKind, UsersModuleUserRole } from '../../../openapi.constants';
import { useCloudflareTunnelStatus } from '../composables';
import { REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME } from '../remote-access-cloudflare-tunnel.constants';
import { RemoteAccessCloudflareTunnelApiException } from '../remote-access-cloudflare-tunnel.exceptions';
import {
	type ICloudflareTunnelProviderActions,
	findFirstUnsatisfiedRequirement,
	flashCloudflareTunnelApiError,
	isCloudflareTunnelUnusableState,
	resolveCloudflareTunnelErrorHintKey,
	resolveCloudflareTunnelProviderActions,
} from '../utils/provider-actions';

import type { CloudflareTunnelWizardStep } from './cloudflare-tunnel-setup-wizard.types';
import CloudflareTunnelSetupWizard from './cloudflare-tunnel-setup-wizard.vue';

defineOptions({
	name: 'CloudflareTunnelProviderCard',
});

const props = defineProps<IRemoteAccessProviderCardProps>();

const { t } = useI18n();
const flashMessage = useFlashMessage();

const { profile } = useSession();
const { status, requirements, isResetting, fetchStatus, reset } = useCloudflareTunnelStatus();
const { fetchStatus: fetchRemoteAccessStatus } = useRemoteAccessStatus();
const { startService, stopService, restartService, isActing } = useServiceActions();
// Only ever reads the extensions store - never triggers its own fetch, so the documentation link
// simply stays hidden until something else (e.g. the Extensions page) has loaded the list. Purely
// presentational: no new network call is introduced by this card.
const { extension } = useExtension({ type: REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME });

const actionErrorCode = ref<string | null>(null);

onBeforeMount(async (): Promise<void> => {
	try {
		await fetchStatus();

		// A page reload during a running privileged setup job must resume the wizard's progress
		// view purely from this same `GET /status` read - no extra endpoint, no remembering
		// anything client-side across the reload.
		if (status.value?.setup?.state === 'running') {
			openWizard('install');
		}
	} catch {
		flashMessage.error(t('remoteAccessCloudflareTunnelPlugin.messages.requestError'));
	}
});

// The plugin's own `GET /status` carries `requirements`, `setup` and `privilegedSetup` that the
// module-level aggregate `provider` prop never does - prefer it once loaded, and fall back to the
// prop (kept fresh by the remote-access module itself) so the card never shows nothing while this
// plugin's own fetch is still in flight.
const displayState = computed(() => status.value?.state ?? props.provider.state);
const displayMessage = computed(() => status.value?.message ?? props.provider.message);
const displayDetails = computed(() => status.value?.details ?? props.provider.details);
const displayEndpoints = computed(() => status.value?.endpoints ?? props.provider.endpoints);

const detailString = (key: string): string | undefined => {
	const value = displayDetails.value[key];

	return typeof value === 'string' && value.length > 0 ? value : undefined;
};

const hostname = computed(() => detailString('hostname'));
const connectorId = computed(() => detailString('connectorId'));
const readyConnections = computed<number | undefined>(() => {
	const value = displayDetails.value['readyConnections'];

	return typeof value === 'number' ? value : undefined;
});

const httpsEndpoint = computed(() => displayEndpoints.value.find((endpoint) => endpoint.https));

const unsatisfiedRequirements = computed(() => requirements.value.filter((requirement) => !requirement.satisfied));

// D12: "Cannot be used yet", naming the first unsatisfied requirement - only while a prerequisite
// (not a normal lifecycle step) is what's actually blocking the tunnel.
const firstUnsatisfiedRequirement = computed(() => findFirstUnsatisfiedRequirement(requirements.value));
const showCannotBeUsedYetBanner = computed<boolean>(
	() => isCloudflareTunnelUnusableState(displayState.value) && firstUnsatisfiedRequirement.value !== null
);

const actionErrorHintKey = computed<string | null>(() => resolveCloudflareTunnelErrorHintKey(actionErrorCode.value));

const flashApiError = (error: unknown, meaningfulCodes: number[], fallback: string): void =>
	flashCloudflareTunnelApiError(error, meaningfulCodes, fallback, flashMessage.error);

const stateTagType = computed<'success' | 'warning' | 'danger' | 'info'>(() => {
	switch (displayState.value) {
		case 'connected':
			return 'success';
		case 'error':
			return 'danger';
		case 'connecting':
		case 'setup-required':
			return 'warning';
		default:
			return 'info';
	}
});

const isOwner = computed<boolean>(() => profile.value?.role === UsersModuleUserRole.owner);

const actions = computed(() => resolveCloudflareTunnelProviderActions({ state: displayState.value, isOwner: isOwner.value }));

const isActingOnService = computed<boolean>(() =>
	isActing(ExtensionsModuleServiceOwnerKind.plugin, REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME, 'tunnel')
);

const documentationLink = computed<string | undefined>(() => extension.value?.links?.documentation ?? undefined);

const openLink = (url: string): void => {
	window.open(url, '_blank', 'noopener,noreferrer');
};

const wizardVisible = ref<boolean>(false);
const wizardStep = ref<CloudflareTunnelWizardStep>('install');

const openWizard = (step: CloudflareTunnelWizardStep): void => {
	wizardStep.value = step;
	wizardVisible.value = true;
};

// Refetches both the plugin status (this card's own state/requirements/advisories) and the
// module-level remote-access status (URLs/aggregate advisories) once the service action settles,
// whether it succeeded or failed - `startService`/`stopService`/`restartService` never throw (they
// report failure via their own return value/toast), so a plain sequential `finally` is enough.
const refreshAfterServiceAction = async (): Promise<void> => {
	await Promise.allSettled([fetchStatus(), fetchRemoteAccessStatus()]);
};

const onConnect = async (): Promise<void> => {
	try {
		await startService(ExtensionsModuleServiceOwnerKind.plugin, REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME, 'tunnel');
	} finally {
		await refreshAfterServiceAction();
	}
};

const onDisconnect = async (): Promise<void> => {
	try {
		await stopService(ExtensionsModuleServiceOwnerKind.plugin, REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME, 'tunnel');
	} finally {
		await refreshAfterServiceAction();
	}
};

const onReconnect = async (): Promise<void> => {
	try {
		await restartService(ExtensionsModuleServiceOwnerKind.plugin, REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME, 'tunnel');
	} finally {
		await refreshAfterServiceAction();
	}
};

const onRemove = (): void => {
	ElMessageBox.confirm(t('remoteAccessCloudflareTunnelPlugin.texts.confirmRemove'), t('remoteAccessCloudflareTunnelPlugin.headings.removeTunnel'), {
		confirmButtonText: t('remoteAccessCloudflareTunnelPlugin.buttons.remove'),
		cancelButtonText: t('remoteAccessCloudflareTunnelPlugin.buttons.cancel'),
		type: 'warning',
	})
		.then(async (): Promise<void> => {
			actionErrorCode.value = null;

			try {
				await reset();

				flashMessage.success(t('remoteAccessCloudflareTunnelPlugin.messages.tunnelRemoved'));

				await fetchRemoteAccessStatus();
			} catch (error) {
				actionErrorCode.value = error instanceof RemoteAccessCloudflareTunnelApiException ? error.errorCode : null;

				flashApiError(error, [422], t('remoteAccessCloudflareTunnelPlugin.messages.tunnelRemoveFailed'));
			}
		})
		.catch((): void => {
			// Cancelled - nothing to do.
		});
};

// Split-button main action, in priority order - `resolveCloudflareTunnelProviderActions` only
// ever offers one of `setup`/`configure`/`connect`/`disconnect` at a time for a given state (each
// is gated on a disjoint set of `state` values), so this reduces to "whichever of those four is
// true"; `reconnect` is the fallback for states (e.g. `error`) that offer none of the first four.
const primaryActionOrder: (keyof ICloudflareTunnelProviderActions)[] = ['setup', 'configure', 'connect', 'disconnect', 'reconnect'];

const primaryActionKey = computed<keyof ICloudflareTunnelProviderActions | null>(() => primaryActionOrder.find((key) => actions.value[key]) ?? null);

const secondaryActionOrder: (keyof ICloudflareTunnelProviderActions)[] = ['connect', 'disconnect', 'reconnect', 'remove'];

const secondaryActionKeys = computed<(keyof ICloudflareTunnelProviderActions)[]>(() =>
	secondaryActionOrder.filter((key) => actions.value[key] && key !== primaryActionKey.value)
);

const primaryActionType = computed<'primary' | undefined>(() =>
	primaryActionKey.value === 'setup' || primaryActionKey.value === 'configure' ? 'primary' : undefined
);

const primaryActionLoading = computed<boolean>(() => {
	switch (primaryActionKey.value) {
		case 'connect':
		case 'disconnect':
		case 'reconnect':
			return isActingOnService.value;
		case 'remove':
			return isResetting.value;
		default:
			return false;
	}
});

const actionLabel = (key: keyof ICloudflareTunnelProviderActions): string => {
	switch (key) {
		case 'setup':
			return t('remoteAccessCloudflareTunnelPlugin.buttons.setup');
		case 'configure':
			return t('remoteAccessCloudflareTunnelPlugin.buttons.configure');
		case 'connect':
			return t('remoteAccessCloudflareTunnelPlugin.buttons.connect');
		case 'disconnect':
			return t('remoteAccessCloudflareTunnelPlugin.buttons.disconnect');
		case 'reconnect':
			return t('remoteAccessCloudflareTunnelPlugin.buttons.reconnect');
		case 'remove':
			return t('remoteAccessCloudflareTunnelPlugin.buttons.removeTunnel');
	}
};

const runAction = (key: keyof ICloudflareTunnelProviderActions): void => {
	switch (key) {
		case 'setup':
			openWizard('install');
			break;
		case 'configure':
			openWizard('config');
			break;
		case 'connect':
			void onConnect();
			break;
		case 'disconnect':
			void onDisconnect();
			break;
		case 'reconnect':
			void onReconnect();
			break;
		case 'remove':
			onRemove();
			break;
	}
};

const onPrimaryAction = (): void => {
	if (primaryActionKey.value === null) return;

	runAction(primaryActionKey.value);
};

const onCommand = (command: string): void => {
	runAction(command as keyof ICloudflareTunnelProviderActions);
};
</script>

<style scoped>
.provider-card {
	transition: opacity 0.2s ease;
}

.provider-card__header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.75rem;
}

.provider-card__heading {
	display: flex;
	align-items: center;
	gap: 0.75rem;
	min-width: 0;
	flex: 1;
}

.provider-card__icon {
	font-size: 1.5rem;
	flex-shrink: 0;
	color: var(--el-color-primary);
}

.provider-card__title {
	margin: 0;
	font-size: 1rem;
	font-weight: 600;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	line-height: 1.25;
}

.provider-card__tags {
	display: flex;
	flex-wrap: wrap;
	justify-content: flex-end;
	flex-shrink: 0;
	gap: 0.375rem;
}

.provider-card__content {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
}

.provider-card__description {
	margin: 0;
	color: var(--el-text-color-regular);
	line-height: 1.5;
}

.provider-card__meta {
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
}

.provider-card__meta-item {
	display: flex;
	align-items: flex-start;
	gap: 0.25rem;
	font-size: 0.8125rem;
	color: var(--el-text-color-secondary);
}

.provider-card__meta-label {
	flex-shrink: 0;
	white-space: nowrap;
}

.provider-card__footer {
	display: flex;
	justify-content: space-between;
	align-items: center;
	gap: 0.5rem;
}

.provider-card__links {
	display: flex;
	flex-wrap: wrap;
	gap: 0.5rem;
}
</style>
