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
						icon="mdi:lan-connect"
						class="provider-card__icon"
					/>
					<h3 class="provider-card__title">{{ t('remoteAccessTailscalePlugin.headings.tailscale') }}</h3>
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
				:title="t('remoteAccessTailscalePlugin.texts.cannotBeUsedYetTitle')"
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
				{{ t('remoteAccessTailscalePlugin.texts.cardDescription') }}
			</p>

			<div
				v-if="tailnet || dnsName || ipv4 || ipv6"
				class="provider-card__meta"
			>
				<div
					v-if="tailnet"
					class="provider-card__meta-item"
				>
					<span class="provider-card__meta-label">{{ t('remoteAccessTailscalePlugin.fields.tailnet') }}:</span>
					<span class="font-mono break-all">{{ tailnet }}</span>
				</div>
				<div
					v-if="dnsName"
					class="provider-card__meta-item"
				>
					<span class="provider-card__meta-label">{{ t('remoteAccessTailscalePlugin.fields.dnsName') }}:</span>
					<span class="font-mono break-all">{{ dnsName }}</span>
				</div>
				<div
					v-if="ipv4"
					class="provider-card__meta-item"
				>
					<span class="provider-card__meta-label">{{ t('remoteAccessTailscalePlugin.fields.ipv4') }}:</span>
					<span class="font-mono break-all">{{ ipv4 }}</span>
				</div>
				<div
					v-if="ipv6"
					class="provider-card__meta-item"
				>
					<span class="provider-card__meta-label">{{ t('remoteAccessTailscalePlugin.fields.ipv6') }}:</span>
					<span class="font-mono break-all">{{ ipv6 }}</span>
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

			<!-- D12: the operator-not-granted advisory names the exact recovery command, sourced from the operator-granted requirement's own remedy. -->
			<div
				v-if="operatorNotGrantedAdvisory"
				class="flex flex-col gap-1"
			>
				<div class="flex items-center gap-2 text-sm text-red-600">
					<icon icon="mdi:alert-circle" />
					<span>{{ operatorNotGrantedAdvisory.message }}</span>
				</div>
				<div
					v-if="operatorGrantCommand"
					class="flex items-start gap-2"
				>
					<pre class="font-mono text-xs bg-gray-100 rounded px-2 py-1 flex-1 whitespace-pre-wrap break-all">{{ operatorGrantCommand }}</pre>
					<el-button
						size="small"
						@click="onCopyOperatorCommand"
					>
						{{ t('remoteAccessTailscalePlugin.buttons.copy') }}
					</el-button>
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

		<tailscale-setup-wizard
			v-model:visible="wizardVisible"
			:initial-step="wizardStep"
		/>
	</el-card>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElCard, ElDropdown, ElDropdownItem, ElDropdownMenu, ElTag } from 'element-plus';

import { Icon } from '@iconify/vue';

import { useClipboard, useFlashMessage } from '../../../common';
import { useSession } from '../../../modules/auth/composables/composables';
import { useExtension, useServiceActions } from '../../../modules/extensions';
import { type IRemoteAccessProviderCardProps, useRemoteAccessStatus } from '../../../modules/remote-access';
import { ExtensionsModuleServiceOwnerKind, UsersModuleUserRole } from '../../../openapi.constants';
import { useTailscaleStatus } from '../composables';
import { REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME } from '../remote-access-tailscale.constants';
import { RemoteAccessTailscaleApiException } from '../remote-access-tailscale.exceptions';
import {
	type ITailscaleProviderActions,
	findFirstUnsatisfiedRequirement,
	findOperatorGrantCommand,
	flashTailscaleApiError,
	isTailscaleUnusableState,
	resolveTailscaleErrorHintKey,
	resolveTailscaleProviderActions,
} from '../utils/provider-actions';

import type { TailscaleWizardStep } from './tailscale-setup-wizard.types';
import TailscaleSetupWizard from './tailscale-setup-wizard.vue';

defineOptions({
	name: 'TailscaleProviderCard',
});

const props = defineProps<IRemoteAccessProviderCardProps>();

const { t } = useI18n();
const flashMessage = useFlashMessage();
const { copy } = useClipboard();

const { profile } = useSession();
const { status, requirements, isLoggingOut, isResettingPreferences, fetchStatus, logout, resetPreferences } = useTailscaleStatus();
const { fetchStatus: fetchRemoteAccessStatus } = useRemoteAccessStatus();
const { startService, stopService, restartService, isActing } = useServiceActions();
// Only ever reads the extensions store - never triggers its own fetch, so the documentation link
// simply stays hidden until something else (e.g. the Extensions page) has loaded the list. Purely
// presentational: no new network call is introduced by this card.
const { extension } = useExtension({ type: REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME });

const actionErrorCode = ref<string | null>(null);

onBeforeMount(async (): Promise<void> => {
	try {
		await fetchStatus();

		// A page reload during a running privileged setup job must resume the wizard's progress
		// view purely from this same `GET /status` read - no extra endpoint, no remembering
		// anything client-side across the reload.
		if (status.value?.setup?.state === 'running') {
			openWizard('setup');
		}
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

// D12: "Cannot be used yet", naming the first unsatisfied requirement - only while a prerequisite
// (not a normal sign-in step) is what's actually blocking the node.
const firstUnsatisfiedRequirement = computed(() => findFirstUnsatisfiedRequirement(requirements.value));
const showCannotBeUsedYetBanner = computed<boolean>(() => isTailscaleUnusableState(displayState.value) && firstUnsatisfiedRequirement.value !== null);

// D12: the operator-not-granted advisory, and its exact recovery command sourced from the
// `operator-granted` requirement's own remedy - never hardcoded, since only the backend knows the
// actual detected service-user name.
const operatorNotGrantedAdvisory = computed(
	() => (status.value?.advisories ?? []).find((advisory) => advisory.code === 'operator-not-granted') ?? null
);
const operatorGrantCommand = computed<string | null>(() => findOperatorGrantCommand(requirements.value));

const actionErrorHintKey = computed<string | null>(() => resolveTailscaleErrorHintKey(actionErrorCode.value));

// Mirrors the wizard's own `flashApiError` (see `flashTailscaleApiError`'s doc) - the backend's
// actual reason for a 409 (e.g. sign-out/reset-preferences refused because a prerequisite isn't
// satisfied) instead of a generic message.
const flashApiError = (error: unknown, meaningfulCodes: number[], fallback: string): void =>
	flashTailscaleApiError(error, meaningfulCodes, fallback, flashMessage.error);

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

const documentationLink = computed<string | undefined>(() => extension.value?.links?.documentation ?? undefined);

const openLink = (url: string): void => {
	window.open(url, '_blank', 'noopener,noreferrer');
};

const wizardVisible = ref<boolean>(false);
const wizardStep = ref<TailscaleWizardStep>('setup');

const openWizard = (step: TailscaleWizardStep): void => {
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
		await startService(ExtensionsModuleServiceOwnerKind.plugin, REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME, 'node');
	} finally {
		await refreshAfterServiceAction();
	}
};

const onDisconnect = async (): Promise<void> => {
	try {
		await stopService(ExtensionsModuleServiceOwnerKind.plugin, REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME, 'node');
	} finally {
		await refreshAfterServiceAction();
	}
};

const onReconnect = async (): Promise<void> => {
	try {
		await restartService(ExtensionsModuleServiceOwnerKind.plugin, REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME, 'node');
	} finally {
		await refreshAfterServiceAction();
	}
};

const onSignOut = async (): Promise<void> => {
	actionErrorCode.value = null;

	try {
		await logout();

		flashMessage.success(t('remoteAccessTailscalePlugin.messages.signedOut'));
	} catch (error) {
		actionErrorCode.value = error instanceof RemoteAccessTailscaleApiException ? error.errorCode : null;

		flashApiError(error, [409], t('remoteAccessTailscalePlugin.messages.signOutFailed'));
	}
};

const onResetPreferences = async (): Promise<void> => {
	actionErrorCode.value = null;

	try {
		await resetPreferences();

		flashMessage.success(t('remoteAccessTailscalePlugin.messages.preferencesReset'));
	} catch (error) {
		actionErrorCode.value = error instanceof RemoteAccessTailscaleApiException ? error.errorCode : null;

		flashApiError(error, [409], t('remoteAccessTailscalePlugin.messages.preferencesResetFailed'));
	}
};

const onCopyOperatorCommand = async (): Promise<void> => {
	if (!operatorGrantCommand.value) {
		return;
	}

	const copied = await copy(operatorGrantCommand.value);

	if (copied) {
		flashMessage.success(t('remoteAccessTailscalePlugin.messages.commandCopied'));
	} else {
		flashMessage.error(t('remoteAccessTailscalePlugin.messages.commandCopyFailed'));
	}
};

// Split-button main action, in priority order - `resolveTailscaleProviderActions` only ever
// offers one of `setup`/`signIn`/`connect`/`disconnect` at a time for a given state (each is
// gated on a disjoint set of `state` values), so this reduces to "whichever of those four is
// true"; `reconnect`/`signOut`/`resetPreferences` are the fallback for states (e.g. `error`) that
// offer none of the first four, so the split button always has a main action whenever `actions`
// offers anything at all.
const primaryActionOrder: (keyof ITailscaleProviderActions)[] = [
	'setup',
	'signIn',
	'connect',
	'disconnect',
	'reconnect',
	'signOut',
	'resetPreferences',
];

const primaryActionKey = computed<keyof ITailscaleProviderActions | null>(() => primaryActionOrder.find((key) => actions.value[key]) ?? null);

const secondaryActionOrder: (keyof ITailscaleProviderActions)[] = ['reconnect', 'disconnect', 'signOut', 'resetPreferences'];

const secondaryActionKeys = computed<(keyof ITailscaleProviderActions)[]>(() =>
	secondaryActionOrder.filter((key) => actions.value[key] && key !== primaryActionKey.value)
);

const primaryActionType = computed<'primary' | undefined>(() =>
	primaryActionKey.value === 'setup' || primaryActionKey.value === 'signIn' ? 'primary' : undefined
);

const primaryActionLoading = computed<boolean>(() => {
	switch (primaryActionKey.value) {
		case 'connect':
		case 'disconnect':
		case 'reconnect':
			return isActingOnService.value;
		case 'signOut':
			return isLoggingOut.value;
		case 'resetPreferences':
			return isResettingPreferences.value;
		default:
			return false;
	}
});

const actionLabel = (key: keyof ITailscaleProviderActions): string => {
	switch (key) {
		case 'setup':
			return t('remoteAccessTailscalePlugin.buttons.setup');
		case 'signIn':
			return t('remoteAccessTailscalePlugin.buttons.signIn');
		case 'connect':
			return t('remoteAccessTailscalePlugin.buttons.connect');
		case 'disconnect':
			return t('remoteAccessTailscalePlugin.buttons.disconnect');
		case 'reconnect':
			return t('remoteAccessTailscalePlugin.buttons.reconnect');
		case 'signOut':
			return t('remoteAccessTailscalePlugin.buttons.signOut');
		case 'resetPreferences':
			return t('remoteAccessTailscalePlugin.buttons.resetPreferences');
	}
};

const runAction = (key: keyof ITailscaleProviderActions): void => {
	switch (key) {
		case 'setup':
			openWizard('setup');
			break;
		case 'signIn':
			openWizard('signin');
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
		case 'signOut':
			void onSignOut();
			break;
		case 'resetPreferences':
			void onResetPreferences();
			break;
	}
};

const onPrimaryAction = (): void => {
	if (primaryActionKey.value === null) return;

	runAction(primaryActionKey.value);
};

const onCommand = (command: string): void => {
	runAction(command as keyof ITailscaleProviderActions);
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
