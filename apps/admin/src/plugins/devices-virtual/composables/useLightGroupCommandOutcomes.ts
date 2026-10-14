import { computed, onBeforeUnmount, ref } from 'vue';

import { z } from 'zod';

import { injectSockets } from '../../../common';

const ChildSchema = z.object({
	member_id: z.string(),
	property_id: z.string().nullable(),
	member_identity: z.string().optional(),
	property_identity: z.string().nullable().optional(),
	reason: z.string().optional(),
	generation: z.string().optional(),
	value: z.union([z.string(), z.number(), z.boolean()]).optional(),
	status: z.enum(['accepted', 'confirmed', 'failed', 'unavailable', 'superseded', 'timed_out']),
});
const EventSchema = z.object({
	id: z.string(),
	status: z.enum(['confirmed', 'partial', 'failed']).optional(),
	children: z.array(ChildSchema),
	targets: z.array(z.object({ deviceId: z.string(), channelId: z.string().optional() })),
	sequence: z.number().int().optional(),
	epoch: z.string().optional(),
});
export const useLightGroupCommandOutcomes = (deviceId: string) => {
	const sockets = injectSockets();
	const active = ref<z.infer<typeof EventSchema> | null>(null);
	const terminal = ref<Array<{ id: string; status: 'confirmed' | 'partial' | 'failed'; children: z.infer<typeof ChildSchema>[] }>>([]);
	const knownParents = new Set<string>();
	const parentSequences = new Map<string, number>();
	let latestSequence = -1;
	let epoch: string | null = null;
	const retiredEpochs = new Set<string>();
	const reset = () => {
		active.value = null;
		knownParents.clear();
		parentSequences.clear();
		latestSequence = -1;
		epoch = null;
	};
	const handle = (event: { event: string; payload: unknown }) => {
		if (!['DevicesModule.CompositeCommand.Progress', 'DevicesModule.CompositeCommand.Completed'].includes(event.event)) return;
		const parsed = EventSchema.safeParse(event.payload);
		if (!parsed.success || !parsed.data.targets.some((target) => target.deviceId === deviceId)) return;
		const data = parsed.data;
		if (data.epoch && retiredEpochs.has(data.epoch)) return;
		if (data.epoch && epoch !== data.epoch) {
			if (epoch) retiredEpochs.add(epoch);
			if (retiredEpochs.size > 8) {
				const oldest = retiredEpochs.values().next().value;
				if (oldest) retiredEpochs.delete(oldest);
			}
			reset();
			epoch = data.epoch;
		}
		const known = knownParents.has(data.id);
		const previousSequence = parentSequences.get(data.id) ?? -1;
		if (data.sequence !== undefined && data.sequence <= previousSequence) return;
		const former = known && active.value?.id !== data.id;
		const stale = data.sequence !== undefined && data.sequence < latestSequence;
		if (former && !data.status) return;
		if (stale && !known) return;
		if (data.sequence !== undefined) {
			parentSequences.set(data.id, data.sequence);
			latestSequence = Math.max(latestSequence, data.sequence);
		}
		knownParents.add(data.id);
		if (knownParents.size > 32) {
			const oldest = knownParents.values().next().value;
			if (oldest) {
				knownParents.delete(oldest);
				parentSequences.delete(oldest);
			}
		}
		if (data.status) {
			terminal.value = [
				{ id: data.id, status: data.status, children: data.children },
				...terminal.value.filter((entry) => entry.id !== data.id),
			].slice(0, 8);
			// Former parents retain truthful history without reclaiming the latest progress slot.
			if (active.value?.id === data.id || (!former && !stale)) active.value = null;
		} else {
			active.value = data;
		}
	};
	sockets.on('event', handle);
	sockets.on('disconnect', reset);
	onBeforeUnmount(() => {
		sockets.off('event', handle);
		sockets.off('disconnect', reset);
	});
	const progress = computed(() => active.value?.children ?? []);
	return { progress, terminal };
};
