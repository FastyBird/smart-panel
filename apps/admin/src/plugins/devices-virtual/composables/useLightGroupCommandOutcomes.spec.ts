import { defineComponent } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { enableAutoUnmount, mount } from '@vue/test-utils';

import { useLightGroupCommandOutcomes } from './useLightGroupCommandOutcomes';

const handlers = vi.hoisted(() => new Map<string, (value: unknown) => void>());
vi.mock('../../../common', () => ({
	injectSockets: () => ({
		on: (event: string, handler: (value: unknown) => void) => handlers.set(event, handler),
		off: (event: string) => handlers.delete(event),
	}),
}));
enableAutoUnmount(afterEach);
const emit = (id: string, sequence: number, epoch = 'epoch-a', status?: string) =>
	handlers.get('event')?.({
		event: status ? 'DevicesModule.CompositeCommand.Completed' : 'DevicesModule.CompositeCommand.Progress',
		payload: {
			id,
			sequence,
			epoch,
			...(status ? { status } : {}),
			targets: [{ deviceId: 'group' }],
			children: [{ memberId: id, propertyId: 'power', status: status === 'confirmed' ? 'confirmed' : 'accepted' }],
		},
	});
const setup = () => {
	let outcomes!: ReturnType<typeof useLightGroupCommandOutcomes>;
	const wrapper = mount(
		defineComponent({
			setup: () => {
				outcomes = useLightGroupCommandOutcomes('group');
				return () => null;
			},
		})
	);
	return { outcomes, wrapper };
};
describe('light group parent outcome ordering', () => {
	it('does not let a late former parent overwrite newer progress or completion', () => {
		const { outcomes } = setup();
		emit('former', 1);
		emit('current', 2);
		emit('former', 3, 'epoch-a', 'confirmed');
		expect(outcomes.progress.value[0].memberId).toBe('current');
		emit('current', 4, 'epoch-a', 'confirmed');
		emit('former', 5);
		expect(outcomes.progress.value).toEqual([]);
		expect(outcomes.terminal.value[0].id).toBe('current');
	});
	it('rejects a retired server epoch and clears active claims on disconnect', () => {
		const { outcomes, wrapper } = setup();
		emit('old-server', 7);
		emit('new-server', 1, 'epoch-b');
		emit('old-server', 99);
		expect(outcomes.progress.value[0].memberId).toBe('new-server');
		handlers.get('disconnect')?.(undefined);
		expect(outcomes.progress.value).toEqual([]);
		wrapper.unmount();
		expect(handlers.size).toBe(0);
	});
});
