import { describe, expect, it } from 'vitest';

import type { IChannel, IChannelProperty, IDevice } from '../../../modules/devices';
import { DEVICES_SHELLY_NG_TYPE } from '../devices-shelly-ng.constants';

import { shellyCoverRecoveryTargets } from './shelly-cover-recovery-targets';

const channel = { id: 'cover', device: 'device', category: 'window_covering', identifier: 'cover:0' } as IChannel;
const command = { id: 'command', channel: 'cover', category: 'command' } as IChannelProperty;
describe('Shelly cover recovery targets', () => {
	it.each(['switcher', 'lighting', 'outlet', 'window_covering'])('offers a physical cover even when the device category is %s', (category) => {
		const device = { id: 'device', type: DEVICES_SHELLY_NG_TYPE, category } as IDevice;
		expect(shellyCoverRecoveryTargets(device, [channel], () => [command])).toEqual([
			{ deviceId: 'device', channelId: 'cover', propertyId: 'command' },
		]);
	});
	it('requires a command on the actual Shelly cover channel', () => {
		const device = { id: 'device', type: DEVICES_SHELLY_NG_TYPE } as IDevice;
		expect(shellyCoverRecoveryTargets(device, [channel], () => [])).toEqual([]);
		expect(shellyCoverRecoveryTargets(device, [{ ...channel, identifier: 'switch:0' }], () => [command])).toEqual([]);
		expect(shellyCoverRecoveryTargets({ ...device, type: 'other' }, [channel], () => [command])).toEqual([]);
	});
});
