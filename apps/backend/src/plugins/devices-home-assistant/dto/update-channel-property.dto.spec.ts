import { validate } from 'class-validator';

import { toInstance } from '../../../common/utils/transform.utils';
import { DEVICES_HOME_ASSISTANT_TYPE } from '../devices-home-assistant.constants';

import { CreateHomeAssistantChannelPropertyDto } from './create-channel-property.dto';
import { UpdateHomeAssistantChannelPropertyDto } from './update-channel-property.dto';

describe('UpdateHomeAssistantChannelPropertyDto partial metadata', () => {
	it('accepts metadata edits without Home Assistant mapping fields', async () => {
		const dto = toInstance(UpdateHomeAssistantChannelPropertyDto, {
			type: DEVICES_HOME_ASSISTANT_TYPE,
			name: 'Renamed',
		});

		expect(await validate(dto)).toEqual([]);
	});

	it.each(['ha_entity_id', 'ha_attribute', 'ha_transformer'])('documents %s as optional only for updates', (field) => {
		const update = Reflect.getMetadata(
			'swagger/apiModelProperties',
			UpdateHomeAssistantChannelPropertyDto.prototype,
			field,
		) as { required: boolean };
		const create = Reflect.getMetadata(
			'swagger/apiModelProperties',
			CreateHomeAssistantChannelPropertyDto.prototype,
			field,
		) as { required?: boolean };

		expect(update.required).toBe(false);
		expect(create.required).not.toBe(false);
	});

	it.each(['ha_entity_id', 'ha_attribute', 'ha_transformer'])(
		'accepts explicit null and rejects invalid supplied %s',
		async (field) => {
			const cleared = toInstance(UpdateHomeAssistantChannelPropertyDto, {
				type: DEVICES_HOME_ASSISTANT_TYPE,
				[field]: null,
			});
			const invalid = toInstance(UpdateHomeAssistantChannelPropertyDto, {
				type: DEVICES_HOME_ASSISTANT_TYPE,
				[field]: '',
			});

			expect(await validate(cleared)).toEqual([]);
			expect((await validate(invalid)).some((error) => error.property === field)).toBe(true);
		},
	);
});
