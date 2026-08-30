import {
	DevicesHomeyPluginTestCandidateConnectionMode,
	type DevicesHomeyPluginTestConnectionRequestSchema,
	DevicesHomeyPluginTestSavedConnectionMode,
} from '../../../openapi.constants';
import { HOMEY_CLOUD_CALLBACK_PATH } from '../devices-homey.constants';
import { isSafeHomeyCloudRedirectUrl } from '../schemas/homey-cloud-redirect-url.schemas';
import { isSafeHomeyUrl } from '../schemas/homey-url.schemas';

export const normalizeHomeyUrlInput = (value: string): string | null => (value.trim() === '' ? null : value);

export const buildDefaultHomeyCloudRedirectUrl = (adminOrigin: string): string | null => {
	try {
		const origin = new URL(adminOrigin);

		const callbackUrl = new URL(HOMEY_CLOUD_CALLBACK_PATH, origin).toString();

		return isSafeHomeyCloudRedirectUrl(callbackUrl) ? callbackUrl : null;
	} catch {
		return null;
	}
};

export const createSavedHomeyConnectionTestRequest = (): DevicesHomeyPluginTestConnectionRequestSchema => ({
	data: { mode: DevicesHomeyPluginTestSavedConnectionMode.saved },
});

export const createCandidateHomeyConnectionTestRequest = (
	url: string | null | undefined,
	apiKey: string | null | undefined
): DevicesHomeyPluginTestConnectionRequestSchema | null => {
	if (typeof url !== 'string' || !isSafeHomeyUrl(url) || typeof apiKey !== 'string' || apiKey.trim() === '') {
		return null;
	}

	return {
		data: {
			mode: DevicesHomeyPluginTestCandidateConnectionMode.candidate,
			url,
			api_key: apiKey.trim(),
		},
	};
};

export const formatHomeyTimestamp = (value: string | null | undefined): string | null => {
	if (!value) return null;

	const date = new Date(value);

	return Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};
