import { ref } from 'vue';

import { type Pinia, defineStore } from 'pinia';

import { PLUGINS_PREFIX } from '../../../app.constants';
import { getErrorReason, useBackend } from '../../../common';
import type {
	DevicesHomeyPluginCancelCloudAuthorizationOperation,
	DevicesHomeyPluginCloudAuthorizationSelectionRequestSchema,
	DevicesHomeyPluginCloudAuthorizationTransactionRequestSchema,
	DevicesHomeyPluginDisconnectCloudAuthorizationOperation,
	DevicesHomeyPluginGetCloudAuthorizationStatusOperation,
	DevicesHomeyPluginListCloudAuthorizationHomeysOperation,
	DevicesHomeyPluginReconnectCloudAuthorizationOperation,
	DevicesHomeyPluginSelectCloudAuthorizationHomeyOperation,
	DevicesHomeyPluginStartCloudAuthorizationOperation,
} from '../../../openapi.constants';
import { DEVICES_HOMEY_PLUGIN_PREFIX, HOMEY_CLOUD_AUTHORIZATION_STORAGE_KEY } from '../devices-homey.constants';
import { DevicesHomeyApiException } from '../devices-homey.exceptions';

import { HomeyCloudPendingTransactionSchema } from './homey.schemas';
import {
	transformHomeyCloudAuthorizationCompletion,
	transformHomeyCloudAuthorizationStart,
	transformHomeyCloudAuthorizationStatus,
	transformHomeyCloudHomeyChoices,
} from './homey.transformers';
import type {
	IHomeyCloudAuthorizationCompletion,
	IHomeyCloudAuthorizationStart,
	IHomeyCloudAuthorizationStatus,
	IHomeyCloudHomeyChoices,
	IHomeyCloudPendingTransaction,
} from './homey.types';

const endpoint = `/${PLUGINS_PREFIX}/${DEVICES_HOMEY_PLUGIN_PREFIX}/oauth` as const;

const removePendingTransactionFromStorage = (): void => {
	try {
		window.sessionStorage.removeItem(HOMEY_CLOUD_AUTHORIZATION_STORAGE_KEY);
	} catch {
		// Browser policy may make session storage unavailable; authorization can safely start without a cached transaction.
	}
};

const readPendingTransaction = (): IHomeyCloudPendingTransaction | null => {
	if (typeof window === 'undefined') return null;

	try {
		const value = window.sessionStorage.getItem(HOMEY_CLOUD_AUTHORIZATION_STORAGE_KEY);
		if (value === null) return null;

		const result = HomeyCloudPendingTransactionSchema.safeParse(JSON.parse(value));
		if (!result.success) {
			removePendingTransactionFromStorage();
			return null;
		}

		return result.data;
	} catch {
		removePendingTransactionFromStorage();
		return null;
	}
};

export const useHomeyCloudAuthorization = defineStore('devices_homey_plugin-cloud-authorization', () => {
	const backend = useBackend();
	const status = ref<IHomeyCloudAuthorizationStatus | null>(null);
	const pendingTransaction = ref<IHomeyCloudPendingTransaction | null>(readPendingTransaction());
	const homeys = ref<IHomeyCloudHomeyChoices['homeys']>([]);
	const fetching = ref(false);
	const authorizing = ref(false);
	const mutating = ref(false);
	let statusGeneration = 0;

	const persistPendingTransaction = (value: IHomeyCloudPendingTransaction | null): void => {
		if (typeof window === 'undefined') {
			pendingTransaction.value = value;
			return;
		}

		if (value === null) {
			pendingTransaction.value = null;
			removePendingTransactionFromStorage();
		} else {
			window.sessionStorage.setItem(HOMEY_CLOUD_AUTHORIZATION_STORAGE_KEY, JSON.stringify(value));
			pendingTransaction.value = value;
		}
	};

	const clearPendingTransaction = (): void => {
		homeys.value = [];
		persistPendingTransaction(null);
	};

	const applyConnectedHomey = (homeyId: string | null | undefined): void => {
		statusGeneration += 1;
		clearPendingTransaction();
		status.value = { connected: true, selectedHomeyId: homeyId ?? null };
	};

	const recoverCompletedSelection = async (transactionId: string): Promise<IHomeyCloudAuthorizationCompletion | null> => {
		const { data, error, response } = await backend.client.GET(`${endpoint}/transactions/{transactionId}/homeys`, {
			params: { path: { transactionId } },
		});

		if (data) {
			const result = transformHomeyCloudHomeyChoices(data.data);
			if (result.status !== 'connected') return null;

			applyConnectedHomey(result.homeyId);

			return { status: 'connected', changed: false, homeyId: result.homeyId ?? null };
		}

		if ([400, 403, 409, 422].includes(response.status)) return null;

		throw new DevicesHomeyApiException(
			getErrorReason<DevicesHomeyPluginListCloudAuthorizationHomeysOperation>(error, 'Failed to verify the Homey Cloud authorization selection.'),
			response.status
		);
	};

	const cancelUnpersistedTransaction = async (transactionId: string): Promise<void> => {
		const body: DevicesHomeyPluginCloudAuthorizationTransactionRequestSchema = {
			data: { transaction_id: transactionId },
		};

		try {
			await backend.client.POST(`${endpoint}/cancel`, { body });
		} catch {
			// The backend still expires an unreachable transaction; preserve the storage failure as the actionable error.
		}

		clearPendingTransaction();
	};

	const fetchStatus = async (): Promise<IHomeyCloudAuthorizationStatus> => {
		const generation = ++statusGeneration;
		fetching.value = true;

		try {
			const { data, error, response } = await backend.client.GET(`${endpoint}/status`);
			if (data) {
				const result = transformHomeyCloudAuthorizationStatus(data.data);
				if (generation === statusGeneration) status.value = result;

				return result;
			}

			throw new DevicesHomeyApiException(
				getErrorReason<DevicesHomeyPluginGetCloudAuthorizationStatusOperation>(error, 'Failed to load Homey Cloud authorization status.'),
				response.status
			);
		} finally {
			fetching.value = false;
		}
	};

	const start = async (reconnect = false): Promise<IHomeyCloudAuthorizationStart> => {
		authorizing.value = true;

		try {
			const { data, error, response } = reconnect
				? await backend.client.POST(`${endpoint}/reconnect`, {})
				: await backend.client.POST(`${endpoint}/authorize`, {});

			if (data) {
				const result = transformHomeyCloudAuthorizationStart(data.data);

				try {
					persistPendingTransaction({ transactionId: result.transactionId, expiresAt: result.expiresAt });
				} catch {
					await cancelUnpersistedTransaction(result.transactionId);
					throw new DevicesHomeyApiException('Browser session storage is required for Homey Cloud authorization.');
				}

				homeys.value = [];
				return result;
			}

			const reason = reconnect
				? getErrorReason<DevicesHomeyPluginReconnectCloudAuthorizationOperation>(error, 'Failed to restart Homey Cloud authorization.')
				: getErrorReason<DevicesHomeyPluginStartCloudAuthorizationOperation>(error, 'Failed to start Homey Cloud authorization.');
			throw new DevicesHomeyApiException(reason, response.status);
		} finally {
			authorizing.value = false;
		}
	};

	const resume = async (): Promise<IHomeyCloudHomeyChoices | null> => {
		const transaction = pendingTransaction.value;
		if (transaction === null) return null;

		fetching.value = true;

		try {
			const { data, error, response } = await backend.client.GET(`${endpoint}/transactions/{transactionId}/homeys`, {
				params: { path: { transactionId: transaction.transactionId } },
			});
			if (pendingTransaction.value?.transactionId !== transaction.transactionId) return null;

			if (data) {
				const result = transformHomeyCloudHomeyChoices(data.data);
				if (result.status === 'connected') {
					clearPendingTransaction();
					status.value = { connected: true, selectedHomeyId: result.homeyId ?? null };
					return result;
				}

				homeys.value = result.homeys;
				return result;
			}

			if ([400, 403, 409, 422].includes(response.status)) clearPendingTransaction();
			throw new DevicesHomeyApiException(
				getErrorReason<DevicesHomeyPluginListCloudAuthorizationHomeysOperation>(error, 'Failed to continue Homey Cloud authorization.'),
				response.status
			);
		} finally {
			fetching.value = false;
		}
	};

	const select = async (homeyId: string): Promise<IHomeyCloudAuthorizationCompletion> => {
		const transaction = pendingTransaction.value;
		if (transaction === null) throw new DevicesHomeyApiException('The Homey Cloud authorization session has expired.', 400);

		mutating.value = true;
		const body: DevicesHomeyPluginCloudAuthorizationSelectionRequestSchema = {
			data: { transaction_id: transaction.transactionId, homey_id: homeyId },
		};

		try {
			const { data, error, response } = await backend.client.POST(`${endpoint}/select`, { body });
			if (data) {
				const result = transformHomeyCloudAuthorizationCompletion(data.data);
				applyConnectedHomey(result.homeyId);
				return result;
			}

			if (response.status === 400) {
				const refreshed = await resume();
				if (refreshed?.status === 'connected') {
					return { status: 'connected', changed: false, homeyId: refreshed.homeyId ?? null };
				}
			}

			if (response.status === 409) {
				const recovered = await recoverCompletedSelection(transaction.transactionId);
				if (recovered !== null) return recovered;
			}

			if ([403, 409].includes(response.status)) clearPendingTransaction();
			throw new DevicesHomeyApiException(
				getErrorReason<DevicesHomeyPluginSelectCloudAuthorizationHomeyOperation>(error, 'Failed to select the Homey.'),
				response.status
			);
		} finally {
			mutating.value = false;
		}
	};

	const cancel = async (): Promise<IHomeyCloudAuthorizationCompletion | null> => {
		const transaction = pendingTransaction.value;
		if (transaction === null) return null;

		mutating.value = true;
		const body: DevicesHomeyPluginCloudAuthorizationTransactionRequestSchema = {
			data: { transaction_id: transaction.transactionId },
		};

		try {
			const { data, error, response } = await backend.client.POST(`${endpoint}/cancel`, { body });
			if (data) {
				const result = transformHomeyCloudAuthorizationCompletion(data.data);
				clearPendingTransaction();
				return result;
			}

			if ([400, 403].includes(response.status)) clearPendingTransaction();
			throw new DevicesHomeyApiException(
				getErrorReason<DevicesHomeyPluginCancelCloudAuthorizationOperation>(error, 'Failed to cancel Homey Cloud authorization.'),
				response.status
			);
		} finally {
			mutating.value = false;
		}
	};

	const disconnect = async (): Promise<IHomeyCloudAuthorizationCompletion> => {
		mutating.value = true;

		try {
			const { data, error, response } = await backend.client.POST(`${endpoint}/disconnect`);
			if (data) {
				const result = transformHomeyCloudAuthorizationCompletion(data.data);
				clearPendingTransaction();
				statusGeneration += 1;
				status.value = { connected: false, selectedHomeyId: null };
				return result;
			}

			throw new DevicesHomeyApiException(
				getErrorReason<DevicesHomeyPluginDisconnectCloudAuthorizationOperation>(error, 'Failed to disconnect Homey Cloud.'),
				response.status
			);
		} finally {
			mutating.value = false;
		}
	};

	return {
		status,
		pendingTransaction,
		homeys,
		fetching,
		authorizing,
		mutating,
		fetchStatus,
		start,
		resume,
		select,
		cancel,
		disconnect,
		clearPendingTransaction,
	};
});

export const registerHomeyCloudAuthorizationStore = (pinia: Pinia): ReturnType<typeof useHomeyCloudAuthorization> =>
	useHomeyCloudAuthorization(pinia);
