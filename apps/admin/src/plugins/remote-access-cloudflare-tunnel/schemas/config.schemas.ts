import { z } from 'zod';

import { ConfigPluginEditFormSchema } from '../../../modules/config';
import { RemoteAccessCloudflareTunnelPluginProtocol } from '../../../openapi.constants';

import { isValidCloudflareTunnelHostname } from './hostname.schemas';

export const CloudflareTunnelConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
	// Absent/blank keeps the stored hostname unset - a plain (non-secret) nullable field, always
	// sent as-is on submit (not omitted), so no "keep vs remove" gesture is needed the way the
	// write-only `tunnelToken` below requires.
	publicHostname: z.preprocess((value) => (typeof value === 'string' && value.trim() === '' ? null : value), z.string().nullable()),
	protocol: z.nativeEnum(RemoteAccessCloudflareTunnelPluginProtocol),
	// Absent or blank keeps the stored token and null removes it - the `ConfigSecretInput`
	// contract (mirrors `WebhookConfigEditFormSchema.url`). The backend never sends the token
	// back, so the field always starts blank.
	tunnelToken: z.string().nullable().optional(),
	// What the backend answers with in place of the token. Declared so the form knows whether
	// there is anything to keep; the update request schema drops it again.
	tunnelTokenConfigured: z.boolean().optional(),
}).superRefine((value, context) => {
	if (typeof value.publicHostname === 'string' && !isValidCloudflareTunnelHostname(value.publicHostname)) {
		context.addIssue({
			code: 'custom',
			path: ['publicHostname'],
			message: 'Public hostname must be a valid hostname, without a scheme or path.',
		});
	}

	// A tunnel cannot run without a token: required unless one is already stored and this submit
	// leaves it untouched (`undefined` - blank input, `tunnelTokenConfigured` true).
	const tokenRetained = typeof value.tunnelToken === 'undefined' && value.tunnelTokenConfigured === true;
	const tokenProvided = (typeof value.tunnelToken === 'string' && value.tunnelToken.trim() !== '') || tokenRetained;

	if (!tokenProvided) {
		context.addIssue({
			code: 'custom',
			path: ['tunnelToken'],
			message: 'A tunnel token is required.',
		});
	}
});
