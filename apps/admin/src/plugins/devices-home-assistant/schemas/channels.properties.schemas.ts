import { z } from 'zod';

import { ChannelPropertyAddFormSchema, ChannelPropertyEditFormSchema } from '../../../modules/devices';

const emptyStringToNull = z.string().transform((val) => (val.trim() === '' ? null : val));

export const HomeAssistantChannelPropertyAddFormSchema = ChannelPropertyAddFormSchema.extend({
	haAttribute: emptyStringToNull.nullable(),
});

export const HomeAssistantChannelPropertyEditFormSchema = ChannelPropertyEditFormSchema.extend({
	haAttribute: emptyStringToNull.nullable().optional(),
});
