import { z } from 'zod';

export const isSafeHomeyUrl = (value: string): boolean => {
	try {
		const url = new URL(value);

		return (url.protocol === 'http:' || url.protocol === 'https:') && url.username === '' && url.password === '';
	} catch {
		return false;
	}
};

export const HomeyUrlSchema = z.string().refine(isSafeHomeyUrl, {
	message: 'Homey URL must use HTTP or HTTPS without embedded credentials',
});
