import { useContainer } from 'class-validator';
import { EventEmitter, once } from 'node:events';
import { createServer } from 'node:http';
import { AddressInfo } from 'node:net';

import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';

import { AppModule } from '../src/app.module';
import { DeviceCategory, EventType } from '../src/modules/devices/devices.constants';
import { ChannelsPropertiesService } from '../src/modules/devices/services/channels.properties.service';
import { ChannelsService } from '../src/modules/devices/services/channels.service';
import { DevicesService } from '../src/modules/devices/services/devices.service';
import { PlatformRegistryService } from '../src/modules/devices/services/platform.registry.service';
import { PropertyValueService } from '../src/modules/devices/services/property-value.service';
import {
	DEVICES_SHELLY_V1_PLUGIN_PREFIX,
	DEVICES_SHELLY_V1_TYPE,
} from '../src/plugins/devices-shelly-v1/devices-shelly-v1.constants';
import { DevicesShellyV1Plugin } from '../src/plugins/devices-shelly-v1/devices-shelly-v1.plugin';
import shellies from '../src/plugins/devices-shelly-v1/lib/shellies';
import { DeviceMapperService } from '../src/plugins/devices-shelly-v1/services/device-mapper.service';
import { ShellyV1AdoptionService } from '../src/plugins/devices-shelly-v1/services/shelly-v1-adoption.service';
import { ShellyV1Service } from '../src/plugins/devices-shelly-v1/services/shelly-v1.service';

describe.each(['DDEEFF', 'shelly1-AABBCCDDEEFF'])('a Shelly Gen1 thermostat relay adopted as %s', (identifier) => {
	it('routes commands, independent reads and incoming changes to the same renamed output', async () => {
		const mac = 'AABBCCDDEEFF';
		const rawId = 'DDEEFF';
		const type = 'SHSW-1';
		const requests: string[] = [];
		let relayOn = true;
		let malformedRelays = false;
		const sensorMac = '112233DDEEFF';
		const sensor = createServer((request, response) => {
			response.setHeader('Content-Type', 'application/json');
			switch (request.url) {
				case '/shelly':
					return response.end(JSON.stringify({ type: 'SHHT-1', mac: sensorMac }));
				case '/status':
					return response.end(JSON.stringify({ mac: sensorMac }));
				default:
					response.writeHead(404);
					return response.end();
			}
		});
		const server = createServer((request, response) => {
			requests.push(request.url);
			response.setHeader('Content-Type', 'application/json');
			switch (request.url) {
				case '/shelly':
					return response.end(JSON.stringify({ type, mac }));
				case '/relay/0?turn=off':
					relayOn = false;
					return response.end(JSON.stringify({ ison: relayOn }));
				case '/status':
					return response.end(
						JSON.stringify({ mac, relays: malformedRelays ? { 0: { ison: relayOn } } : [{ ison: relayOn }] }),
					);
				default:
					response.writeHead(404);
					return response.end();
			}
		});
		const fixture = await Test.createTestingModule({
			imports: [
				AppModule.register({
					moduleExtensions: [],
					pluginExtensions: [{ routePrefix: DEVICES_SHELLY_V1_PLUGIN_PREFIX, extensionClass: DevicesShellyV1Plugin }],
				}),
			],
		}).compile();
		const connector = fixture.get(ShellyV1Service);
		const receiver = (shellies as typeof shellies & { _listener: EventEmitter })._listener;
		jest.spyOn(shellies, 'start').mockImplementation(() => undefined);
		jest.spyOn(shellies, 'stop').mockImplementation(() => undefined);
		try {
			await once(server.listen(0, '127.0.0.1'), 'listening');
			const host = `127.0.0.1:${(server.address() as AddressInfo).port}`;
			await once(sensor.listen(0, '127.0.0.1'), 'listening');
			const sensorHost = `127.0.0.1:${(sensor.address() as AddressInfo).port}`;
			useContainer(fixture, { fallbackOnErrors: true });
			await fixture.init();
			await connector.start();
			const adoption = fixture.get(ShellyV1AdoptionService);
			const [adopted] = await adoption.adopt([
				{
					identifier,
					hostname: host,
					name: 'Heating relay',
					category: DeviceCategory.SWITCHER,
				},
			]);
			expect(adopted.status).toBe('created');
			const mapper = jest.spyOn(fixture.get(DeviceMapperService), 'mapDevice');
			const announceRelay = (serial: number) =>
				receiver.emit('statusUpdate', {
					deviceType: type,
					deviceId: rawId,
					host,
					serial,
					payload: { G: [[0, 1101, Number(relayOn)]] },
				});
			const discover = async () => {
				mapper.mockClear();
				announceRelay(1);
				expect(mapper).toHaveBeenCalledTimes(1);
				await expect(mapper.mock.results[0].value).resolves.toMatchObject({ id: adopted.deviceId });
			};
			const announceUnverifiedSensor = async () => {
				mapper.mockClear();
				// The H&T uses the same CoIoT ID, but /shelly at this endpoint identifies a relay.
				receiver.emit('statusUpdate', { deviceType: 'SHHT-1', deviceId: rawId, host, serial: 1, payload: { G: [] } });
				expect(mapper).toHaveBeenCalledTimes(1);
				const mapping = mapper.mock.results[0].value as ReturnType<DeviceMapperService['mapDevice']>;
				await expect(mapping.catch(() => null)).resolves.toBeNull();
			};
			await discover();
			const [probe] = await adoption.adopt([
				{ identifier: sensorMac, hostname: sensorHost, name: 'Room sensor', category: DeviceCategory.SENSOR },
			]);
			expect(probe.status).toBe('created');
			mapper.mockClear();
			receiver.emit('statusUpdate', {
				deviceType: 'SHHT-1',
				deviceId: rawId,
				host: sensorHost,
				serial: 1,
				payload: { G: [] },
			});
			expect(mapper).toHaveBeenCalledTimes(1);
			await expect(mapper.mock.results[0].value).resolves.toMatchObject({ id: probe.deviceId });
			const channel = await fixture
				.get(ChannelsService)
				.findOneBy('identifier', 'relay_0', adopted.deviceId, DEVICES_SHELLY_V1_TYPE);
			const property = await fixture
				.get(ChannelsPropertiesService)
				.findOneBy('identifier', 'state', channel.id, DEVICES_SHELLY_V1_TYPE);
			const device = await fixture.get(DevicesService).update(adopted.deviceId, {
				type: DEVICES_SHELLY_V1_TYPE,
				identifier: 'shelly1-aabbccddeeff',
			});
			const registry = fixture.get(PlatformRegistryService);
			const target = { device, channel, property };
			await announceUnverifiedSensor();
			await expect(registry.get(device).processBatch([{ ...target, value: false }])).resolves.toBe(true);
			expect(requests).toContain('/relay/0?turn=off');
			await connector.stop();
			await connector.start();
			await discover();
			await announceUnverifiedSensor();
			const values = fixture.get(PropertyValueService);
			const prior = values.readQualifiedSample(property, 30_000)?.ingressSequence;
			malformedRelays = true;
			await expect(registry.requestPropertyRead({ ...target, dispatching: jest.fn() })).resolves.toBe(true);
			expect(values.readQualifiedSample(property, 30_000)?.ingressSequence).toBe(prior);
			malformedRelays = false;
			requests.length = 0;
			const dispatching = jest.fn();
			await expect(registry.requestPropertyRead({ ...target, dispatching })).resolves.toBe(true);
			expect(requests).toContain('/status');
			expect(dispatching).toHaveBeenCalledTimes(1);
			expect(values.readQualifiedSample(property, 30_000)).toMatchObject({
				propertyId: property.id,
				value: false,
				provenance: 'live',
				quality: 'good',
			});
			const incoming = fixture.get(EventEmitter2).waitFor(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, 5_000);
			relayOn = true;
			announceRelay(2);
			await expect(incoming).resolves.toMatchObject([
				{ propertyId: property.id, sample: { value: true, provenance: 'live', quality: 'good' } },
			]);
		} finally {
			try {
				await connector.stop();
				await fixture.close();
			} finally {
				jest.restoreAllMocks();
				if (server.listening) await once(server.close(), 'close');
				if (sensor.listening) await once(sensor.close(), 'close');
			}
		}
	});
});
