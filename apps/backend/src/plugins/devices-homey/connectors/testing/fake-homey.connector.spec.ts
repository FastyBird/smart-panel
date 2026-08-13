import { FakeHomeyConnector, FakeHomeyConnectorFixtures } from '../../../../../test/support/fake-homey.connector';
import {
	HomeyConnectorContractFixtures,
	HomeyConnectorContractHarness,
	describeHomeyConnectorContract,
} from '../../../../../test/support/homey-connector.contract';
import { HomeyCapabilityType, createHomeyCapability } from '../../models/homey-capability.model';
import { HomeyEventType } from '../../models/homey-event.model';

const connectorFixtures: FakeHomeyConnectorFixtures = {
	systemInfo: {
		id: 'homey-1',
		name: 'Homey Pro',
		version: '12.4.0',
		tier: 'pro',
		model: 'Homey Pro',
	},
	zones: [
		{ id: 'zone-home', name: 'Home', parentId: null, active: true, path: ['Home'] },
		{
			id: 'zone-living',
			name: 'Living room',
			parentId: 'zone-home',
			active: true,
			path: ['Home', 'Living room'],
		},
	],
	devices: [
		{
			id: 'device-1',
			name: 'Living room sensor',
			class: 'sensor',
			zoneId: 'zone-living',
			zoneName: 'Living room',
			zonePath: ['Home', 'Living room'],
			available: true,
			availabilityMessage: null,
			driverId: 'homey:app:driver:sensor',
			manufacturer: 'Example',
			model: 'Sensor 1',
			energy: null,
			capabilities: [
				createHomeyCapability({
					id: 'measure_temperature.inside',
					title: 'Inside temperature',
					value: 21.5,
					type: HomeyCapabilityType.NUMBER,
					unit: '°C',
					minimum: -40,
					maximum: 125,
					step: 0.1,
					enumValues: [],
					readable: true,
					writable: false,
					available: true,
					lastUpdatedAt: '2026-08-13T10:00:00.000Z',
				}),
			],
		},
	],
};

const contractFixtures: HomeyConnectorContractFixtures = {
	...connectorFixtures,
	events: [
		{
			type: HomeyEventType.CAPABILITY_VALUE_CHANGED,
			deviceId: 'device-1',
			capabilityId: 'measure_temperature.inside',
			value: 22,
			lastUpdatedAt: '2026-08-13T10:01:00.000Z',
			occurredAt: '2026-08-13T10:01:00.000Z',
			sequence: 1,
		},
		{
			type: HomeyEventType.DEVICE_AVAILABILITY_CHANGED,
			deviceId: 'device-1',
			available: false,
			availabilityMessage: 'Device unavailable',
			occurredAt: '2026-08-13T10:02:00.000Z',
			sequence: 2,
		},
	],
	writeTarget: {
		deviceId: 'device-1',
		capabilityId: 'measure_temperature.inside',
	},
};

describeHomeyConnectorContract('Fake', (): HomeyConnectorContractHarness => {
	const connector = new FakeHomeyConnector(connectorFixtures);

	return {
		connector,
		fixtures: contractFixtures,
		emit: (event) => connector.emit(event),
		failNext: (operation, category) => connector.failNext(operation, category),
		get writes() {
			return connector.writes;
		},
		get subscriberCount() {
			return connector.subscriberCount;
		},
		get connectCount() {
			return connector.connectCount;
		},
		get disconnectCount() {
			return connector.disconnectCount;
		},
		dispose: () => connector.disconnect(),
	};
});
