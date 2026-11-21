import { ref } from 'vue';

import { describe, expect, it } from 'vitest';

import { type IAppBarHeading, createAppBarHost } from './useAppBarHost';

const heading = (title: string): IAppBarHeading => ({ title, left: 'menu', actions: [] });

describe('useAppBarHost', () => {
	it('has no heading until a header registers', () => {
		expect(createAppBarHost(() => true).heading.value).toBeNull();
	});

	it('shows the most recently registered heading and falls back when it leaves', () => {
		const host = createAppBarHost(() => true);

		const unregisterList = host.register(() => heading('Devices'));
		const unregisterDetail = host.register(() => heading('Living room lamp'));

		expect(host.heading.value?.title).toBe('Living room lamp');

		unregisterDetail();

		expect(host.heading.value?.title).toBe('Devices');

		unregisterList();

		expect(host.heading.value).toBeNull();
	});

	it('removes the right heading when one below the top leaves', () => {
		const host = createAppBarHost(() => true);

		const unregisterList = host.register(() => heading('Devices'));

		host.register(() => heading('Living room lamp'));

		unregisterList();

		expect(host.heading.value?.title).toBe('Living room lamp');
	});

	it('follows its active state', () => {
		const phone = ref(true);
		const host = createAppBarHost(() => phone.value);

		expect(host.active.value).toBe(true);

		phone.value = false;

		expect(host.active.value).toBe(false);
	});
});
