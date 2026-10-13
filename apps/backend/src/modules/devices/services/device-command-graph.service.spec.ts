import { ChannelCategory, DataTypeType, DeviceCategory } from '../devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../entities/devices.entity';
import { PropertyProducerState, PropertyValueState } from '../models/property-value-state.model';

import { DeviceCommandGraphService } from './device-command-graph.service';
import { DeviceConnectionStateService } from './device-connection-state.service';
import { PropertyMetadataService } from './property-metadata.service';
import { PropertyValueService } from './property-value.service';

it('hydrates command graph with a detached producer state, including unavailable quality', async () => {
	const property = Object.assign(new ChannelPropertyEntity(), {
		id: 'derived-property',
		category: 'temperature',
		dataType: DataTypeType.FLOAT,
	});
	const channel = Object.assign(new ChannelEntity(), {
		id: 'sensor-channel',
		category: ChannelCategory.TEMPERATURE,
		properties: [property],
	});
	const device = Object.assign(new DeviceEntity(), {
		id: 'sensor',
		category: DeviceCategory.SENSOR,
		channels: [channel],
	});
	channel.device = device;
	property.channel = channel;
	const state = new PropertyValueState();
	state.producer = Object.assign(new PropertyProducerState(), {
		quality: 'unavailable',
		reasons: ['quorum_lost'],
		sampledAt: null,
		evaluatedAt: '2026-10-13T10:00:00.000Z',
		expiresAt: null,
		revision: 2,
	});
	const graph = new DeviceCommandGraphService(
		{ findDevice: () => Promise.resolve(device) } as unknown as PropertyMetadataService,
		{ readLatest: () => Promise.resolve(state) } as unknown as PropertyValueService,
		{
			readLatest: () => Promise.resolve({ online: true, status: 'connected', lastChanged: null }),
		} as unknown as DeviceConnectionStateService,
	);
	await graph.findOne(device.id);
	expect(property.value).toEqual(state);
	expect(property.value).not.toBe(state);
	expect(property.value.producer).not.toBe(state.producer);
	property.value.producer.reasons.push('caller_mutation');
	expect(state.producer.reasons).toEqual(['quorum_lost']);
});
