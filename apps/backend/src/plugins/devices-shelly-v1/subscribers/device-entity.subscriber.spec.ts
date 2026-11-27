import { DataSource } from 'typeorm';

import { ShellyV1DeviceEntity } from '../entities/devices-shelly-v1.entity';
import { ShelliesAdapterService } from '../services/shellies-adapter.service';
import { ShellyV1AdoptedIdentityService } from '../services/shelly-v1-adopted-identity.service';
import { ShellyV1HttpClientService } from '../services/shelly-v1-http-client.service';

import { DeviceEntitySubscriber } from './device-entity.subscriber';

describe('Gen1 credential setup after catalog publication', () => {
	it.each(['missing', 'conflicting', 'moved', 'verified', 'legacy'])(
		'applies credentials only to the captured and authorized peer (%s)',
		async (scenario) => {
			const peer = { id: 'DDEEFF', type: 'SHSW-1', host: 'new-host' };
			const registration = { ...peer };
			const adapter = {
				getRegisteredDevice: () => registration,
				getDevice: () => peer,
				setDeviceAuthCredentials: jest.fn(),
				updateDeviceEnabledStatus: jest.fn(),
			};
			const identities = {
				findPin: jest
					.fn()
					.mockResolvedValue(scenario === 'legacy' ? null : { mac: 'AABBCCDDEEFF', verifiedHost: 'old-host' }),
				confirmHost: jest.fn().mockResolvedValue(true),
			};
			const http = {
				getDeviceInfo: jest
					.fn()
					.mockResolvedValue(
						scenario === 'missing'
							? null
							: { type: peer.type, mac: scenario === 'conflicting' ? '112233DDEEFF' : 'AABBCCDDEEFF' },
					),
				getLoginSettings: jest.fn(() => {
					if (scenario === 'moved') peer.host = 'elsewhere';
					return Promise.resolve({ username: 'admin' });
				}),
			};
			const subscriber = new DeviceEntitySubscriber(
				{ subscribers: [] } as unknown as DataSource,
				adapter as unknown as ShelliesAdapterService,
				http as unknown as ShellyV1HttpClientService,
				identities as unknown as ShellyV1AdoptedIdentityService,
			);
			const device = Object.assign(new ShellyV1DeviceEntity(), {
				id: 'stored',
				identifier: 'DDEEFF',
				hostname: 'new-host',
				password: 'fixture',
			});
			await subscriber.deviceCreated(device);
			expect(adapter.setDeviceAuthCredentials).toHaveBeenCalledTimes(['verified', 'legacy'].includes(scenario) ? 1 : 0);
			expect(http.getLoginSettings).toHaveBeenCalledTimes(['verified', 'legacy', 'moved'].includes(scenario) ? 1 : 0);
			expect(identities.confirmHost).toHaveBeenCalledTimes(['verified', 'moved'].includes(scenario) ? 1 : 0);
		},
	);
});
