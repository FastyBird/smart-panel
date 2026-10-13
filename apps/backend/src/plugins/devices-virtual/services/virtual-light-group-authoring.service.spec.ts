import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { LightGroupDraftDto } from '../dto/light-group-draft.dto';

import { VirtualLightGroupAuthoringService } from './virtual-light-group-authoring.service';

const physical = (id: string, categories: PropertyCategory[]): ChannelEntity => {
	const device = Object.assign(new DeviceEntity(), { id: `device-${id}`, category: DeviceCategory.LIGHTING, name: id });
	const channel = Object.assign(new ChannelEntity(), { id, device, category: ChannelCategory.LIGHT, name: id });
	channel.properties = categories.map((category) =>
		Object.assign(new ChannelPropertyEntity(), {
			id: `${id}-${category}`,
			channel,
			category,
			permissions: [PermissionType.READ_WRITE],
			dataType: category === PropertyCategory.ON ? DataTypeType.BOOL : DataTypeType.UCHAR,
			format: category === PropertyCategory.ON ? null : [0, 100],
			step: category === PropertyCategory.ON ? null : 1,
		}),
	);
	return channel;
};
describe('light group draft preview', () => {
	const setup = (channels: ChannelEntity[]) => {
		const reads = jest.fn((_entity: unknown, options: { where: { id: string } }) =>
			Promise.resolve(channels.find((channel) => channel.id === options.where.id) ?? null),
		);
		const service = new VirtualLightGroupAuthoringService(
			{ manager: { findOne: reads } } as never,
			{ runShared: (operation: () => Promise<unknown>) => operation() } as never,
			{ revision: () => Promise.resolve(7) } as never,
			{} as never,
			{} as never,
		);
		return { service, reads };
	};
	const draft = (ids: string[], capabilities?: PropertyCategory[]) =>
		Object.assign(new LightGroupDraftDto(), { members: ids.map((id) => ({ sourceChannelId: id })), capabilities });
	it('explains heterogeneous optional capability loss with the same metadata intersection and never creates or hides a row', async () => {
		const a = physical('a', [PropertyCategory.ON, PropertyCategory.BRIGHTNESS]);
		const b = physical('b', [PropertyCategory.ON]);
		const { service, reads } = setup([a, b]);
		const preview = await service.preview(draft(['a', 'b']));
		expect(preview.common_capabilities.map((capability) => capability.category)).toEqual([PropertyCategory.ON]);
		expect(preview.unavailable_capabilities).toContain(PropertyCategory.BRIGHTNESS);
		expect(preview.graph_revision).toBe(7);
		expect(reads).toHaveBeenCalledTimes(2);
	});
	it('rejects duplicate members and partial color tuples before persistence', async () => {
		const colors = [
			PropertyCategory.ON,
			PropertyCategory.COLOR_RED,
			PropertyCategory.COLOR_GREEN,
			PropertyCategory.COLOR_BLUE,
		];
		const { service } = setup([physical('a', colors), physical('b', colors)]);
		await expect(service.preview(draft(['a', 'a']))).rejects.toThrow('only once');
		await expect(service.preview(draft(['a', 'b'], [PropertyCategory.ON, PropertyCategory.COLOR_RED]))).rejects.toThrow(
			'complete RGB',
		);
	});
});
