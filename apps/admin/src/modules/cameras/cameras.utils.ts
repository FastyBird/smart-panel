import { resolveIngressBase } from '../../common/utils/ingress.utils';
import { DevicesModuleDeviceConnectionStatus } from '../../openapi.constants';
import type { IDevice } from '../devices/store/devices.store.types';

import { CamerasApiException, CamerasException } from './cameras.exceptions';
import type { ICamera, ICameraProfile } from './store/cameras.store.types';

const MODULE_DISABLED_MESSAGE = 'Cameras module is disabled';

/**
 * Turns the path a session response carries (`/api/v1/modules/cameras/live?session=<token>`) into
 * an absolute WebSocket URL. Only a path is accepted so a token can never be sent to another host,
 * and the error text never repeats the input because it holds the session token.
 */
export const buildLiveSocketUrl = (sessionUrl: string, location: Pick<Location, 'origin' | 'pathname' | 'protocol'>): string => {
	if (!sessionUrl.startsWith('/') || sessionUrl.startsWith('//')) {
		throw new CamerasException('The live view session URL must be a path');
	}

	const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
	const host = location.origin.replace(/^[a-z]+:\/\//i, '');

	return `${scheme}//${host}${resolveIngressBase(location.pathname)}${sessionUrl}`;
};

export const isCameraCategory = (category: string): boolean => category === 'camera' || category === 'doorbell';

/**
 * Reads a human message out of the error bodies the backend sends: the standard envelope
 * (`error.details[].reason`, `error.details.reason`, `error.message`, as `NotFoundExceptionFilter`
 * produces for a 404) and Nest's default body (a top-level string `message`).
 */
export const readErrorMessage = (error: unknown): string | null => {
	if (error === null || typeof error !== 'object') {
		return null;
	}

	const body = error as Record<string, unknown>;
	const envelope = body['error'];

	if (envelope !== null && typeof envelope === 'object') {
		const { details, message } = envelope as Record<string, unknown>;

		if (Array.isArray(details)) {
			for (const row of details) {
				const reason = row !== null && typeof row === 'object' ? (row as Record<string, unknown>)['reason'] : undefined;

				if (typeof reason === 'string' && reason !== '') {
					return reason;
				}
			}
		} else if (details !== null && typeof details === 'object') {
			const reason = (details as Record<string, unknown>)['reason'];

			if (typeof reason === 'string' && reason !== '') {
				return reason;
			}
		}

		if (typeof message === 'string' && message !== '') {
			return message;
		}
	}

	return typeof body['message'] === 'string' && body['message'] !== '' ? body['message'] : null;
};

export const isModuleDisabledError = (status: number, error: unknown): boolean =>
	status === 404 && readErrorMessage(error) === MODULE_DISABLED_MESSAGE;

/** A store call rejected because the cameras module is turned off. */
export const isModuleDisabledException = (error: unknown): boolean =>
	error instanceof CamerasApiException && error.code === 404 && error.message === MODULE_DISABLED_MESSAGE;

/**
 * Whether a session can be requested for the camera: the backend offers live view and at least one profile is
 * available. Anything else would only end in a refused session request.
 */
export const isLiveViewAvailable = (camera: ICamera | null | undefined): boolean =>
	!!camera && camera.liveView && camera.profiles.some((profile) => profile.available);

/** The readable name of a stream profile: its resolution when known, its id otherwise. */
export const cameraProfileLabel = (profile: ICameraProfile): string =>
	profile.width != null && profile.height != null ? `${profile.width}\u00d7${profile.height}` : profile.id;

/**
 * `null` when the device or its connection status is unknown, so callers can tell "offline" from "no idea".
 */
export const isDeviceOffline = (device: IDevice | null | undefined): boolean | null => {
	const status = device?.status?.status;

	if (!device || status === undefined || status === DevicesModuleDeviceConnectionStatus.unknown) {
		return null;
	}

	return status === DevicesModuleDeviceConnectionStatus.disconnected || status === DevicesModuleDeviceConnectionStatus.lost;
};
