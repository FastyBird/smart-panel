/* eslint-disable vue/require-prop-types */
import { defineComponent, h } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import type { ICamera } from '../store';

import CameraTile from './camera-tile.vue';

const observers: { callback: IntersectionObserverCallback; observe: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }[] = [];

const CameraPlayerStub = defineComponent({
	name: 'CameraPlayer',
	props: ['deviceId', 'variant', 'snapshotActive', 'controls'],
	setup: (props) => () => h('button', { 'data-test-id': 'player-stub', 'data-active': String(props.snapshotActive) }),
});

const camera: ICamera = { deviceId: 'cam-1', name: 'Front door', category: 'camera', type: 't', liveView: true, profiles: [] };

const intersect = (isIntersecting: boolean): void => {
	observers[0].callback([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver);
};

describe('CameraTile', () => {
	beforeEach(() => {
		observers.length = 0;
		vi.stubGlobal(
			'IntersectionObserver',
			class {
				observe = vi.fn();
				disconnect = vi.fn();
				constructor(callback: IntersectionObserverCallback) {
					observers.push({ callback, observe: this.observe, disconnect: this.disconnect });
				}
			}
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	const mountTile = (roomName: string | null = 'Hall') =>
		mount(CameraTile, { props: { camera, roomName }, global: { stubs: { CameraPlayer: CameraPlayerStub } } });

	it('shows the name and the room under the player', () => {
		const wrapper = mountTile();

		expect(wrapper.text()).toContain('Front door');
		expect(wrapper.find('[data-test-id="camera-tile-room"]').text()).toBe('Hall');
		expect(wrapper.findComponent(CameraPlayerStub).props('variant')).toBe('tile');
	});

	it('omits the room when it is unknown', () => {
		expect(mountTile(null).find('[data-test-id="camera-tile-room"]').exists()).toBe(false);
	});

	it('emits open with the device id on click, before child handlers run', async () => {
		const wrapper = mountTile();

		await wrapper.find('[data-test-id="player-stub"]').trigger('click');

		expect(wrapper.emitted('open')).toEqual([['cam-1']]);
	});

	it('emits open on Enter', async () => {
		const wrapper = mountTile();

		await wrapper.find('[data-test-id="camera-tile"]').trigger('keydown.enter');

		expect(wrapper.emitted('open')).toEqual([['cam-1']]);
	});

	it('opens on Space and hides the inline player controls', async () => {
		const wrapper = mountTile();

		await wrapper.find('[data-test-id="camera-tile"]').trigger('keydown.space');

		expect(wrapper.emitted('open')).toEqual([['cam-1']]);
		expect(wrapper.findComponent(CameraPlayerStub).props('controls')).toBe(false);
	});

	it('pauses the snapshot while off screen and resumes when visible', async () => {
		const wrapper = mountTile();

		expect(observers[0].observe).toHaveBeenCalledTimes(1);
		expect(wrapper.findComponent(CameraPlayerStub).props('snapshotActive')).toBe(true);

		intersect(false);
		await wrapper.vm.$nextTick();

		expect(wrapper.findComponent(CameraPlayerStub).props('snapshotActive')).toBe(false);

		intersect(true);
		await wrapper.vm.$nextTick();

		expect(wrapper.findComponent(CameraPlayerStub).props('snapshotActive')).toBe(true);

		wrapper.unmount();

		expect(observers[0].disconnect).toHaveBeenCalled();
	});
});
