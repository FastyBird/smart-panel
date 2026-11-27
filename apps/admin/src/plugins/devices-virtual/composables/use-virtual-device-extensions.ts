import { type Component, inject } from 'vue';

import { pluginsManagerKey } from '../../../common/services/plugins';
import type { IPlugin } from '../../../common/services/types';
import type { MeasurementSourceChannel, MeasurementSourceDevice, MeasurementSourceProperty } from '../utils/measurement-authoring.utils';

export type MeasurementAlias = (
	device: MeasurementSourceDevice,
	channel: MeasurementSourceChannel,
	property: MeasurementSourceProperty
) => {
	key: string;
	canonical: boolean;
} | null;

export interface VirtualDeviceExtensionComponents {
	virtualThermostatInstallations?: Record<string, Component>;
	virtualCoverRecovery?: Component;
	virtualMeasurementAlias?: MeasurementAlias;
}

/** Device plugins can contribute UI for their own hardware to the virtual-device editors. */
export function useVirtualDeviceExtensions() {
	const elements =
		inject(pluginsManagerKey, undefined)
			?.getPlugins<IPlugin<VirtualDeviceExtensionComponents>>()
			.flatMap((plugin) => plugin.elements) ?? [];
	const forDevice = (type: string) => elements.find((element) => element.type === type)?.components;
	const measurementAlias: MeasurementAlias = (device, channel, property) =>
		forDevice(device.type)?.virtualMeasurementAlias?.(device, channel, property) ?? null;
	const installation = (profile: string) =>
		elements.find(
			(element) => element.components?.virtualThermostatInstallations && Object.hasOwn(element.components.virtualThermostatInstallations, profile)
		)?.components?.virtualThermostatInstallations?.[profile];
	return { forDevice, measurementAlias, installation };
}
