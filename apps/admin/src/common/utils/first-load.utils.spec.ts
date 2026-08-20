import { describe, expect, it } from 'vitest';

import { markFirstLoad } from './first-load.utils';

describe('markFirstLoad', () => {
	it('pushes an id only once', () => {
		const firstLoad: string[] = [];

		markFirstLoad(firstLoad, 'a');
		markFirstLoad(firstLoad, 'a');
		markFirstLoad(firstLoad, 'b');

		expect(firstLoad).toEqual(['a', 'b']);
	});
});
