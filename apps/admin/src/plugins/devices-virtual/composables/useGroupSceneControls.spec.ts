import { computed, defineComponent, ref } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import type { IChannel, IChannelProperty, IDevice } from '../../../modules/devices';

import { useGroupSceneControls } from './useGroupSceneControls';

const mocks = vi.hoisted(() => ({ GET: vi.fn(), on: vi.fn(), off: vi.fn() }));
vi.mock('../../../common', () => ({ useBackend: () => ({ client: mocks }), injectSockets: () => mocks }));
describe('group scene authoring capability port', () => {
	it('offers native group controls from backend metadata and fences disconnect/old provider responses', async () => {
		const device = ref({ id: 'group', type: 'virtual', mode: 'actuator_group' } as unknown as IDevice);
		const channels = computed(() => [{ id: 'channel' }] as IChannel[]);
		const property = (category: string) => ({ id: category, channel: 'channel', category, permissions: ['ro'] }) as IChannelProperty;
		mocks.GET.mockResolvedValue({
			data: {
				data: {
					profile: 'cover',
					common_capabilities: [
						{ category: 'command', access: 'wo' },
						{ category: 'position', access: 'rw' },
					],
					operations: [
						{ operation: 'open', commandable: true },
						{ operation: 'stop', commandable: false },
						{ operation: 'position', commandable: false },
					],
				},
			},
		});
		let controls!: ReturnType<typeof useGroupSceneControls>;
		const wrapper = mount(
			defineComponent({
				setup() {
					controls = useGroupSceneControls(
						computed(() => device.value),
						channels
					);
					return () => null;
				},
			})
		);
		await flushPromises();
		expect(controls.allowed(property('command'), 'open')).toBe(true);
		expect(controls.allowed(property('command'), 'stop')).toBe(false);
		expect(controls.allowed(property('position'))).toBe(false);
		mocks.on.mock.calls.find(([event]) => event === 'disconnect')![1]();
		expect(controls.allowed(property('command'), 'open')).toBe(false);
		device.value = { id: 'raw', type: 'physical' } as IDevice;
		await flushPromises();
		expect(controls.allowed({ ...property('position'), permissions: ['rw'] } as IChannelProperty)).toBe(true);
		expect(controls.allowed(property('position'))).toBe(false);
		wrapper.unmount();
		expect(mocks.off).toHaveBeenCalledTimes(3);
	});
});
