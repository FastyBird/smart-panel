<template>
	<provider-card
		icon="mdi:cloud-lock-outline"
		:title="t('remoteAccessCloudflareTunnelPlugin.headings.cloudflareTunnel')"
		:status="providerStateStatus(displayState)"
		:status-label="t(`remoteAccessModule.status.${displayState}`)"
		:line="line"
		:endpoints="endpoints"
		:action="cardAction"
		:menu="cardMenu"
		@action="onCardAction"
	/>

	<cloudflare-tunnel-setup-wizard
		v-if="wizardVisible"
		v-model:visible="wizardVisible"
		:initial-step="wizardStep"
	/>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, onScopeDispose, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElMessageBox } from 'element-plus';

import { useFlashMessage } from '../../../common';
import { useSession } from '../../../modules/auth/composables/composables';
import { useExtension, useServiceActions, useServices } from '../../../modules/extensions';
import {
	type IProviderCardAction,
	type IProviderCardLine,
	type IProviderCardMenuItem,
	type IRemoteAccessProviderCardProps,
	ProviderCard,
	providerStateStatus,
	useRemoteAccessStatus,
} from '../../../modules/remote-access';
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
const { status, requirements, isResetting, fetchStatus, refreshStatus, reset } = useCloudflareTunnelStatus();
const { fetchStatus: fetchRemoteAccessStatus } = useRemoteAccessStatus();
const { startService, stopService, restartService, isActing } = useServiceActions();
const { services, fetchServices } = useServices();
const service = computed(() =>
	services.value.find(
		(item) =>
			item.extensionKind === ExtensionsModuleServiceOwnerKind.plugin &&
			item.extensionType === REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME &&
			item.serviceId === 'tunnel'
	)
);
// The provider snapshot has no lifecycle field; use the existing Extensions service contract.
// Refresh lifecycle after state events and periodically when those events are lost.
watch(
	() => status.value?.state,
	() => {
		void fetchServices().catch(() => {});
	}
);
const serviceReconciliationTimer = setInterval(() => {
	void fetchServices().catch(() => {});
}, 30_000);
onScopeDispose(() => clearInterval(serviceReconciliationTimer));
// Only ever reads the extensions store - never triggers its own fetch, so the documentation link
// simply stays hidden until something else (e.g. the Extensions page) has loaded the list. Purely
// presentational: no new network call is introduced by this card.
const { extension } = useExtension({ type: REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME });

const actionErrorCode = ref<string | null>(null);

onBeforeMount(async (): Promise<void> => {
	try {
		await Promise.all([fetchStatus(), fetchServices()]);

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

// Up to two endpoints on the card: the published URLs, HTTPS first, or the hostname before any is published
const endpoints = computed<string[]>(() => {
	const urls = [...displayEndpoints.value].sort((a, b) => Number(b.https) - Number(a.https)).map((endpoint) => endpoint.url);

	return urls.length > 0 ? urls : hostname.value ? [hostname.value] : [];
});

// D12: "Cannot be used yet", naming the first unsatisfied requirement - only while a prerequisite
// (not a normal lifecycle step) is what's actually blocking the tunnel.
const firstUnsatisfiedRequirement = computed(() => findFirstUnsatisfiedRequirement(requirements.value));
const showCannotBeUsedYetBanner = computed<boolean>(
	() => isCloudflareTunnelUnusableState(displayState.value) && firstUnsatisfiedRequirement.value !== null
);

const actionErrorHintKey = computed<string | null>(() => resolveCloudflareTunnelErrorHintKey(actionErrorCode.value));

// The card's one line: how to recover from the last failed action, then what blocks the tunnel, then its status
const line = computed<IProviderCardLine>(() => {
	if (actionErrorHintKey.value) {
		return { text: t(actionErrorHintKey.value), status: 'warn' };
	}

	if (showCannotBeUsedYetBanner.value && firstUnsatisfiedRequirement.value) {
		return { text: `${t('remoteAccessCloudflareTunnelPlugin.texts.cannotBeUsedYetTitle')}: ${firstUnsatisfiedRequirement.value.message}`, status: 'warn' };
	}

	if (displayMessage.value) {
		return { text: displayMessage.value, status: displayState.value === 'error' ? 'danger' : undefined };
	}

	return { text: t('remoteAccessCloudflareTunnelPlugin.texts.cardDescription') };
});

const flashApiError = (error: unknown, meaningfulCodes: number[], fallback: string): void =>
	flashCloudflareTunnelApiError(error, meaningfulCodes, fallback, flashMessage.error);

const isOwner = computed<boolean>(() => profile.value?.role === UsersModuleUserRole.owner);

const actions = computed(() =>
	resolveCloudflareTunnelProviderActions({
		state: displayState.value,
		isOwner: isOwner.value,
		isAdmin: profile.value?.role === UsersModuleUserRole.admin,
		service: service.value,
	})
);

const isActingOnService = computed<boolean>(() =>
	isActing(ExtensionsModuleServiceOwnerKind.plugin, REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME, 'tunnel')
);

const documentationLink = computed<string | undefined>(() => extension.value?.links?.documentation ?? undefined);

const DOCUMENTATION = 'documentation';

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
	await Promise.allSettled([refreshStatus(), fetchRemoteAccessStatus(), fetchServices()]);
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
			} catch (error) {
				actionErrorCode.value = error instanceof RemoteAccessCloudflareTunnelApiException ? error.errorCode : null;

				flashApiError(error, [409, 422], t('remoteAccessCloudflareTunnelPlugin.messages.tunnelRemoveFailed'));
			} finally {
				await refreshAfterServiceAction();
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
	if (!actions.value[key] || isActingOnService.value || isResetting.value) return;
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

// The card's one action; the other actions, and the documentation, are in its ⋯ menu
const cardAction = computed<IProviderCardAction | null>(() =>
	primaryActionKey.value === null
		? null
		: {
				key: primaryActionKey.value,
				label: actionLabel(primaryActionKey.value),
				primary: primaryActionType.value === 'primary',
				loading: primaryActionLoading.value,
				disabled: isActingOnService.value || isResetting.value,
			}
);

const cardMenu = computed<IProviderCardMenuItem[]>(() => [
	...secondaryActionKeys.value.map((key) => ({
		key,
		label: actionLabel(key),
		disabled: isActingOnService.value || isResetting.value,
		danger: key === 'remove',
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

	runAction(key as keyof ICloudflareTunnelProviderActions);
};
</script>
