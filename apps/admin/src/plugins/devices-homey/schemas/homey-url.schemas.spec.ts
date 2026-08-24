import { describe, expect, it } from 'vitest';

import { HomeyUrlSchema } from './homey-url.schemas';

describe('HomeyUrlSchema', () => {
	it.each(['http://homey.local:4859', 'https://192.0.2.5'])('accepts a safe Homey URL: %s', (url) => {
		expect(HomeyUrlSchema.safeParse(url).success).toBe(true);
	});

	it.each(['ftp://homey.local', 'http://admin:secret@homey.local', 'not-a-url'])('rejects an unsafe Homey URL: %s', (url) => {
		expect(HomeyUrlSchema.safeParse(url).success).toBe(false);
	});
});
