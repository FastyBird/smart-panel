<template>
	<provider-card
		icon="mdi:lan-connect"
		:title="t('remoteAccessTailscalePlugin.headings.tailscale')"
		:status="providerStateStatus(displayState)"
		:status-label="t(`remoteAccessModule.status.${displayState}`)"
		:line="line"
		:endpoints="endpoints"
		:action="cardAction"
		:menu="cardMenu"
		@action="onCardAction"
	/>

	<tailscale-setup-wizard
		v-if="wizardVisible"
		v-model:visible="wizardVisible"
		:initial-step="wizardStep"
	/>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { useClipboard, useFlashMessage } from '../../../common';
import { useSession } from '../../../modules/auth/composables/composables';
import { useExtension } from '../../../modules/extensions';
import {
	type IProviderCardAction,
	type IProviderCardLine,
	type IProviderCardMenuItem,
	type IRemoteAccessProviderCardProps,
	ProviderCard,
	providerStateStatus,
	useRemoteAccessStatus,
} from '../../../modules/remote-access';
import { UsersModuleUserRole } from '../../../openapi.constants';
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
const {
	status,
	requirements,
	isConnecting,
	isDisconnecting,
	isLoggingOut,
	isResettingPreferences,
	fetchStatus,
	refreshStatus,
	connect,
	disconnect,
	logout,
	resetPreferences,
} = useTailscaleStatus();
const { fetchStatus: fetchRemoteAccessStatus } = useRemoteAccessStatus();
// Read already-loaded metadata; the platform requirement also carries a documentation URL
// for direct visits where the extensions store has not been populated.
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

const dnsName = computed(() => detailString('dnsName'));
const ipv4 = computed(() => detailString('ipv4'));

// Up to two endpoints on the card: the published URLs, HTTPS first, or the node's name and address before any is
// published
const endpoints = computed<string[]>(() => {
	const urls = [...displayEndpoints.value].sort((a, b) => Number(b.https) - Number(a.https)).map((endpoint) => endpoint.url);

	return urls.length > 0 ? urls : [dnsName.value, ipv4.value].filter((value): value is string => value !== undefined);
});

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

// The card's one line: how to recover from the last failed action, then what blocks the node, then its status
const line = computed<IProviderCardLine>(() => {
	if (actionErrorHintKey.value) {
		return { text: t(actionErrorHintKey.value), status: 'warn' };
	}

	if (operatorNotGrantedAdvisory.value) {
		return { text: operatorNotGrantedAdvisory.value.message, status: 'danger' };
	}

	if (status.value?.control?.operation) {
		return { text: t('remoteAccessTailscalePlugin.texts.operationInProgress'), status: 'info' };
	}

	if (showCannotBeUsedYetBanner.value && firstUnsatisfiedRequirement.value) {
		return { text: `${t('remoteAccessTailscalePlugin.texts.cannotBeUsedYetTitle')}: ${firstUnsatisfiedRequirement.value.message}`, status: 'warn' };
	}

	if (displayMessage.value) {
		return { text: displayMessage.value, status: displayState.value === 'error' ? 'danger' : undefined };
	}

	return { text: t('remoteAccessTailscalePlugin.texts.cardDescription') };
});

// Mirrors the wizard's own `flashApiError` (see `flashTailscaleApiError`'s doc) - the backend's
// actual reason for a 409 (e.g. sign-out/reset-preferences refused because a prerequisite isn't
// satisfied) instead of a generic message.
const flashApiError = (error: unknown, meaningfulCodes: number[], fallback: string): void =>
	flashTailscaleApiError(error, meaningfulCodes, fallback, flashMessage.error);

const isOwner = computed<boolean>(() => profile.value?.role === UsersModuleUserRole.owner);

const actions = computed(() =>
	resolveTailscaleProviderActions({
		state: displayState.value,
		control: status.value?.control,
		isAdmin: profile.value?.role === UsersModuleUserRole.admin,
		isOwner: isOwner.value,
	})
);

const documentationLink = computed<string | undefined>(() => {
	const metadataLink = extension.value?.links?.documentation;

	if (metadataLink) return metadataLink;

	const note = requirements.value.find((requirement) => requirement.code === 'platform-supported')?.remedy?.note;

	if (!note) return undefined;

	try {
		const url = new URL(note);

		return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined;
	} catch {
		return undefined;
	}
});

const DOCUMENTATION = 'documentation';
const COPY_GRANT_COMMAND = 'copyGrantCommand';

const openLink = (url: string): void => {
	window.open(url, '_blank', 'noopener,noreferrer');
};

const wizardVisible = ref<boolean>(false);
const wizardStep = ref<TailscaleWizardStep>('setup');

const openWizard = (step: TailscaleWizardStep): void => {
	wizardStep.value = step;
	wizardVisible.value = true;
};

// Reconcile private controls and aggregate URLs after every action, including failures.
const refreshAfterServiceAction = async (): Promise<void> => {
	await Promise.allSettled([refreshStatus(), fetchRemoteAccessStatus()]);
};

const runConnectionAction = async (action: 'connect' | 'disconnect'): Promise<void> => {
	actionErrorCode.value = null;
	try {
		await (action === 'connect' ? connect() : disconnect());
	} catch (error: unknown) {
		actionErrorCode.value = error instanceof RemoteAccessTailscaleApiException ? error.errorCode : null;
		flashApiError(error, [409, 422], t(`remoteAccessTailscalePlugin.messages.${action}Failed`));
	} finally {
		await refreshAfterServiceAction();
	}
};

const onConnect = (): Promise<void> => runConnectionAction('connect');
const onDisconnect = (): Promise<void> => runConnectionAction('disconnect');

const onSignOut = async (): Promise<void> => {
	actionErrorCode.value = null;

	try {
		await logout();

		flashMessage.success(t('remoteAccessTailscalePlugin.messages.signedOut'));
	} catch (error) {
		actionErrorCode.value = error instanceof RemoteAccessTailscaleApiException ? error.errorCode : null;

		flashApiError(error, [409], t('remoteAccessTailscalePlugin.messages.signOutFailed'));
	} finally {
		await refreshAfterServiceAction();
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
	} finally {
		await refreshAfterServiceAction();
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

// Backend availability determines the primary action; Disconnect remains usable to cancel login.
const primaryActionOrder: (keyof ITailscaleProviderActions)[] = [
	'setup',
	'resumeSignIn',
	'signIn',
	'connect',
	'disconnect',
	'signOut',
	'resetPreferences',
];

const primaryActionKey = computed<keyof ITailscaleProviderActions | null>(() => primaryActionOrder.find((key) => actions.value[key]) ?? null);

const secondaryActionOrder: (keyof ITailscaleProviderActions)[] = ['disconnect', 'signOut', 'resetPreferences'];

const secondaryActionKeys = computed<(keyof ITailscaleProviderActions)[]>(() =>
	secondaryActionOrder.filter((key) => actions.value[key] && key !== primaryActionKey.value)
);

const primaryActionType = computed<'primary' | undefined>(() =>
	primaryActionKey.value === 'setup' || primaryActionKey.value === 'signIn' || primaryActionKey.value === 'resumeSignIn' ? 'primary' : undefined
);

const isLocalBusy = computed<boolean>(() => isConnecting.value || isDisconnecting.value || isLoggingOut.value || isResettingPreferences.value);
const primaryActionLoading = computed<boolean>(() => (primaryActionKey.value === 'disconnect' ? isDisconnecting.value : isLocalBusy.value));

const actionLabel = (key: keyof ITailscaleProviderActions): string => {
	switch (key) {
		case 'setup':
			return t('remoteAccessTailscalePlugin.buttons.setup');
		case 'resumeSignIn':
			return t('remoteAccessTailscalePlugin.buttons.resumeSignIn');
		case 'signIn':
			return t('remoteAccessTailscalePlugin.buttons.signIn');
		case 'connect':
			return t('remoteAccessTailscalePlugin.buttons.connect');
		case 'disconnect':
			return t('remoteAccessTailscalePlugin.buttons.disconnect');
		case 'signOut':
			return t('remoteAccessTailscalePlugin.buttons.signOut');
		case 'resetPreferences':
			return t('remoteAccessTailscalePlugin.buttons.resetPreferences');
	}
};

const runAction = (key: keyof ITailscaleProviderActions): void => {
	if (!actions.value[key] || (isLocalBusy.value && (key !== 'disconnect' || isDisconnecting.value))) return;
	switch (key) {
		case 'setup':
			openWizard('setup');
			break;
		case 'resumeSignIn':
		case 'signIn':
			openWizard('signin');
			break;
		case 'connect':
			void onConnect();
			break;
		case 'disconnect':
			void onDisconnect();
			break;
		case 'signOut':
			void onSignOut();
			break;
		case 'resetPreferences':
			void onResetPreferences();
			break;
	}
};

// The card's one action; the other actions, the operator grant command and the documentation are in its ⋯ menu
const cardAction = computed<IProviderCardAction | null>(() =>
	primaryActionKey.value === null
		? null
		: {
				key: primaryActionKey.value,
				label: actionLabel(primaryActionKey.value),
				primary: primaryActionType.value === 'primary',
				loading: primaryActionLoading.value,
				disabled: primaryActionLoading.value,
			}
);

const cardMenu = computed<IProviderCardMenuItem[]>(() => [
	...(operatorNotGrantedAdvisory.value && operatorGrantCommand.value
		? [{ key: COPY_GRANT_COMMAND, label: t('remoteAccessTailscalePlugin.buttons.copyGrantCommand') }]
		: []),
	...secondaryActionKeys.value.map((key) => ({
		key,
		label: actionLabel(key),
		disabled: isLocalBusy.value && key !== 'disconnect',
		// Both undo the node's setup: listed last, after a divider
		danger: key === 'signOut' || key === 'resetPreferences',
	})),
	...(documentationLink.value ? [{ key: DOCUMENTATION, label: t('extensionsModule.buttons.documentation') }] : []),
]);

const onCardAction = (key: string): void => {
	if (key === DOCUMENTATION) {
		if (documentationLink.value) {
			openLink(documentationLink.value);
		}

		return;
	}

	if (key === COPY_GRANT_COMMAND) {
		void onCopyOperatorCommand();

		return;
	}

	runAction(key as keyof ITailscaleProviderActions);
};
</script>
