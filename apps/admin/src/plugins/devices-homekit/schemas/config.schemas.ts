import { z } from 'zod';

import { ConfigPluginEditFormSchema } from '../../../modules/config';
import { HOMEKIT_FORBIDDEN_PINS } from '../devices-homekit.constants';

export const HomeKitConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
	bridgeName: z.string().trim().min(1),
	port: z.number().int().min(1024).max(65535),
	pincode: z.string().trim().optional(),
	pincodeConfigured: z.boolean().optional(),
	username: z
		.string()
		.trim()
		.regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/),
	setupId: z.string().trim().length(4),
	mappedDeviceIds: z.array(z.string().uuid()).default([]),
})
	.superRefine((value, ctx) => {
		const pin = typeof value.pincode === 'string' ? value.pincode.trim() : '';

		if (pin === '') {
			if (!value.pincodeConfigured) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'PIN code is required',
					path: ['pincode'],
				});
			}
			return;
		}

		if (!/^\d{3}-\d{2}-\d{3}$/.test(pin)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'PIN code must be in format XXX-XX-XXX',
				path: ['pincode'],
			});
			return;
		}

		if (HOMEKIT_FORBIDDEN_PINS.has(pin)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'PIN code is not allowed by Apple HomeKit',
				path: ['pincode'],
			});
		}
	})
	.overwrite((value) => {
		const pin = typeof value.pincode === 'string' ? value.pincode.trim() : '';
		const pincode = pin === '' && value.pincodeConfigured ? undefined : pin || undefined;

		return {
			...value,
			pincode,
		};
	});

