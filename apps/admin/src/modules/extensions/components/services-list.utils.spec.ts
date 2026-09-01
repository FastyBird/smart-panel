import { describe, expect, it } from 'vitest';

import {
	ExtensionsModuleServiceActivationPolicy,
	ExtensionsModuleServiceDesiredState,
	ExtensionsModuleServiceOwnerKind,
	ExtensionsModuleServiceState,
} from '../../../openapi.constants';

import { groupServicesByOwnerKind } from './services-list.utils';

describe('groupServicesByOwnerKind', () => {
	it('groups module and plugin services independently', () => {
		const services = [
			{
				extensionKind: ExtensionsModuleServiceOwnerKind.module,
				extensionType: 'mdns-module',
				serviceId: 'advertisement',
				activationPolicy: ExtensionsModuleServiceActivationPolicy.owner_enabled,
				state: ExtensionsModuleServiceState.started,
				desiredState: ExtensionsModuleServiceDesiredState.started,
				enabled: true,
				startCount: 1,
			},
			{
				extensionKind: ExtensionsModuleServiceOwnerKind.plugin,
				extensionType: 'devices-home-assistant-plugin',
				serviceId: 'discovery',
				activationPolicy: ExtensionsModuleServiceActivationPolicy.always,
				state: ExtensionsModuleServiceState.started,
				desiredState: ExtensionsModuleServiceDesiredState.started,
				enabled: false,
				startCount: 1,
			},
		];

		const grouped = groupServicesByOwnerKind(services);

		expect(grouped.modules).toEqual([services[0]]);
		expect(grouped.plugins).toEqual([services[1]]);
	});
});
