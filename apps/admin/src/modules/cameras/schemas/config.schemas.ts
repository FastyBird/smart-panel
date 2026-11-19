import { type ZodType, z } from 'zod';

import { CamerasModuleDataGo2rtcConfigMode } from '../../../openapi.constants';
import type { ConfigModuleUpdateModuleSchema } from '../../../openapi.constants';
import { ConfigModuleEditFormSchema } from '../../config';
import { ConfigModuleSchema, ConfigModuleUpdateReqSchema } from '../../config/store/config-modules.store.schemas';
import { CAMERAS_MODULE_NAME } from '../cameras.constants';

type ApiConfigUpdateModule = ConfigModuleUpdateModuleSchema;

// Bounds and rules mirror the backend (`dto/update-config.dto.ts`, `cameras.config.utils.ts`) - duplicated here
// because the admin has no runtime dependency on backend source.
const MAX_SESSIONS_MIN = 1;
const MAX_SESSIONS_MAX = 32;
const MAX_SESSIONS_PER_CAMERA_MIN = 1;
const MAX_SESSIONS_PER_CAMERA_MAX = 16;
const MAX_BINARY_PATH_LENGTH = 4096;
const MAX_EXTERNAL_URL_LENGTH = 2048;
const BINARY_BASENAME = /^go2rtc[A-Za-z0-9._-]*$/;

/**
 * Mirrors `isValidGo2rtcBinaryPath`: an absolute path, no NUL, not ending in a slash, whose file name matches
 * `^go2rtc[A-Za-z0-9._-]*$`.
 */
export const isValidGo2rtcBinaryPath = (value: unknown): value is string => {
	if (typeof value !== 'string' || value.length === 0 || value.length > MAX_BINARY_PATH_LENGTH) {
		return false;
	}

	if (value.includes('\0') || value.endsWith('/') || !value.startsWith('/')) {
		return false;
	}

	return BINARY_BASENAME.test(value.slice(value.lastIndexOf('/') + 1));
};

/**
 * Mirrors `isValidGo2rtcExternalUrl`: an http or https URL with a host and without credentials, query or fragment.
 */
export const isValidGo2rtcExternalUrl = (value: unknown): value is string => {
	if (typeof value !== 'string' || value.length === 0 || value.length > MAX_EXTERNAL_URL_LENGTH) {
		return false;
	}

	let url: URL;

	try {
		url = new URL(value);
	} catch {
		return false;
	}

	return (
		(url.protocol === 'http:' || url.protocol === 'https:') &&
		url.hostname.length > 0 &&
		url.username === '' &&
		url.password === '' &&
		url.search === '' &&
		url.hash === '' &&
		!value.includes('?') &&
		!value.includes('#')
	);
};

const ModeSchema = z.nativeEnum(CamerasModuleDataGo2rtcConfigMode);
const MaxSessionsSchema = z.number().int().min(MAX_SESSIONS_MIN).max(MAX_SESSIONS_MAX);
const MaxSessionsPerCameraSchema = z.number().int().min(MAX_SESSIONS_PER_CAMERA_MIN).max(MAX_SESSIONS_PER_CAMERA_MAX);

// STORE STATE
// ===========

// Parses the generic config module's response into the camelCase shape the config form reads and writes.
export const CamerasConfigSchema = ConfigModuleSchema.extend({
	type: z.literal(CAMERAS_MODULE_NAME),
	go2rtc: z.object({
		mode: ModeSchema,
		binaryPath: z.string(),
		externalUrl: z.string().nullable(),
	}),
	maxSessions: MaxSessionsSchema,
	maxSessionsPerCamera: MaxSessionsPerCameraSchema,
});

// EDIT FORM
// =========

// The form model's gate: `useConfigModuleEditForm`'s `submit()` parses the live model against it before sending.
// The binary path is checked only in managed mode and the external URL only in external mode, the only modes that use
// them, so a value left invalid in a hidden field cannot block saving another mode. An empty external URL becomes
// `null`, and external mode requires a valid one.
export const CamerasConfigEditFormSchema = ConfigModuleEditFormSchema.extend({
	go2rtc: z
		.object({
			mode: ModeSchema,
			binaryPath: z.string(),
			externalUrl: z
				.string()
				.nullable()
				.transform((value): string | null => (value === null || value.trim() === '' ? null : value.trim())),
		})
		.superRefine((go2rtc, context) => {
			if (go2rtc.mode === CamerasModuleDataGo2rtcConfigMode.managed && !isValidGo2rtcBinaryPath(go2rtc.binaryPath)) {
				context.addIssue({ code: 'custom', path: ['binaryPath'], message: 'Invalid binary path' });
			}

			if (go2rtc.mode !== CamerasModuleDataGo2rtcConfigMode.external) {
				return;
			}

			if (go2rtc.externalUrl === null) {
				context.addIssue({ code: 'custom', path: ['externalUrl'], message: 'External mode needs a URL' });
			} else if (!isValidGo2rtcExternalUrl(go2rtc.externalUrl)) {
				context.addIssue({ code: 'custom', path: ['externalUrl'], message: 'Invalid external URL' });
			}
		}),
	maxSessions: MaxSessionsSchema,
	maxSessionsPerCamera: MaxSessionsPerCameraSchema,
});

export type ICamerasConfigEditForm = z.infer<typeof CamerasConfigEditFormSchema>;

// BACKEND API
// ===========

// The binary path is sent only with managed mode (or with no mode, as a partial update), and must be valid then. The
// external URL must be valid with external mode (or no mode); another mode leaves an invalid one out, so the stored URL
// stays as it was.
export const CamerasConfigUpdateReqSchema: ZodType<ApiConfigUpdateModule> = ConfigModuleUpdateReqSchema.and(
	z.object({
		type: z.literal(CAMERAS_MODULE_NAME),
		go2rtc: z
			.object({
				mode: ModeSchema.optional(),
				binary_path: z.string().optional(),
				external_url: z.string().nullable().optional(),
			})
			.transform(({ binary_path, external_url, ...go2rtc }) => {
				const anyMode = go2rtc.mode === undefined;
				const keepUrl =
					anyMode ||
					go2rtc.mode === CamerasModuleDataGo2rtcConfigMode.external ||
					typeof external_url !== 'string' ||
					isValidGo2rtcExternalUrl(external_url);

				return {
					...go2rtc,
					...(anyMode || go2rtc.mode === CamerasModuleDataGo2rtcConfigMode.managed ? { binary_path } : {}),
					...(keepUrl ? { external_url } : {}),
				};
			})
			.superRefine((go2rtc, context) => {
				if ('binary_path' in go2rtc && go2rtc.binary_path !== undefined && !isValidGo2rtcBinaryPath(go2rtc.binary_path)) {
					context.addIssue({ code: 'custom', path: ['binary_path'], message: 'Invalid binary path' });
				}

				if ('external_url' in go2rtc && typeof go2rtc.external_url === 'string' && !isValidGo2rtcExternalUrl(go2rtc.external_url)) {
					context.addIssue({ code: 'custom', path: ['external_url'], message: 'Invalid external URL' });
				}
			})
			.optional(),
		max_sessions: MaxSessionsSchema.optional(),
		max_sessions_per_camera: MaxSessionsPerCameraSchema.optional(),
	})
);
