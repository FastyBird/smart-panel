import { type ComputedRef, computed, onBeforeUnmount, ref, watch } from 'vue';

import { injectSockets, useBackend } from '../../../common';
import type { IChannel, IChannelProperty, IDevice } from '../../../modules/devices';
import type { components } from '../../../openapi';

type Configuration = components['schemas']['DevicesVirtualPluginDataLightGroupConfiguration'];
/** Scene authoring reads the same group metadata as device controls. Execution revalidates in core. */
export const useGroupSceneControls = (device: ComputedRef<IDevice | undefined>, channels: ComputedRef<IChannel[]>) => {
	const backend = useBackend();
	const sockets = injectSockets();
	const configurations = ref<Record<string, Configuration>>({});
	const isGroup = computed(() => device.value?.type === 'virtual' && Reflect.get(device.value, 'mode') === 'actuator_group');
	let generation = 0;
	let connected = true;
	let refreshTimer: ReturnType<typeof setTimeout> | undefined;
	const refresh = async () => {
		const current = ++generation;
		configurations.value = {};
		if (!isGroup.value || !connected) return;
		const result = await Promise.all(
			channels.value.map(async (channel) => {
				try {
					const response = await backend.client.GET('/plugins/devices-virtual/producers/light-groups/{id}', { params: { path: { id: channel.id } } });
					return response.data ? ([channel.id, response.data.data] as const) : null;
				} catch {
					return null;
				}
			})
		);
		if (current === generation && connected) configurations.value = Object.fromEntries(result.filter((entry) => entry !== null));
	};
	const allowed = (property: IChannelProperty, value?: unknown): boolean => {
		if (!isGroup.value) return property.permissions.some((permission) => permission === 'rw' || permission === 'wo');
		const config = configurations.value[property.channel];
		const capability = config?.common_capabilities.find((field) => field.category === property.category);
		if (!capability || !(capability.access === 'rw' || capability.access === 'wo' || (config.profile === 'light' && !capability.access)))
			return false;
		if (config.profile !== 'cover') return true;
		return (
			config.operations?.some(
				(operation) =>
					operation.commandable &&
					(property.category === 'command'
						? value === undefined || operation.operation === value
						: String(operation.operation) === String(property.category))
			) ?? false
		);
	};
	const disconnect = () => {
		connected = false;
		++generation;
		configurations.value = {};
	};
	const connect = () => {
		connected = true;
		void refresh();
	};
	const event = ({ event, payload }: { event: string; payload?: unknown }) => {
		if (event !== 'DevicesVirtual.LightGroup.ReportedStateChanged' || refreshTimer || !isGroup.value || !connected) return;
		if (
			payload &&
			typeof payload === 'object' &&
			'groupChannelId' in payload &&
			!channels.value.some((channel) => channel.id === payload.groupChannelId)
		)
			return;
		++generation;
		configurations.value = {};
		refreshTimer = setTimeout(() => {
			refreshTimer = undefined;
			void refresh();
		}, 200);
	};
	watch([device, channels], refresh, { immediate: true, deep: true });
	sockets.on('connect', connect);
	sockets.on('disconnect', disconnect);
	sockets.on('event', event);
	onBeforeUnmount(() => {
		++generation;
		clearTimeout(refreshTimer);
		sockets.off('connect', connect);
		sockets.off('disconnect', disconnect);
		sockets.off('event', event);
	});
	const diagnostics = computed(() => [
		...new Set(
			Object.values(configurations.value).flatMap(
				(config) =>
					config.operations?.flatMap((operation) =>
						operation.members.flatMap((member) => member.reasons.map((reason) => `${operation.operation} / ${member.source_identity}: ${reason}`))
					) ?? []
			)
		),
	]);
	return { isGroup, allowed, refresh, diagnostics };
};
