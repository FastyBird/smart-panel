import { DataSource } from 'typeorm';

import { DataTypeType, PermissionType, PropertyCategory } from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { GroupCatalogDto } from '../dto/group-catalog.dto';
import { VirtualLightGroupProfile } from '../entities/virtual-producer.entity';

import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { VirtualGroupCatalogService } from './virtual-group-catalog.service';

const rgb = [PropertyCategory.COLOR_RED, PropertyCategory.COLOR_GREEN, PropertyCategory.COLOR_BLUE];
const light = (id: string, categories: PropertyCategory[]): ChannelEntity =>
	Object.assign(new ChannelEntity(), {
		id,
		name: id,
		device: Object.assign(new DeviceEntity(), { id: `device-${id}`, name: id }),
		properties: categories.map((category) =>
			Object.assign(new ChannelPropertyEntity(), {
				id: `${id}-${category}`,
				category,
				dataType: category === PropertyCategory.ON ? DataTypeType.BOOL : DataTypeType.UCHAR,
				permissions: [PermissionType.READ_WRITE],
				format: category === PropertyCategory.ON ? null : [0, 255],
				step: category === PropertyCategory.ON ? null : 1,
			}),
		),
	});

describe('prospective group catalog controls', () => {
	let catalog: VirtualGroupCatalogService;
	let quarantined: Set<string>;
	let outputs: ChannelPropertyEntity[];
	beforeEach(() => {
		const channels = [
			light('rgb', [PropertyCategory.ON, PropertyCategory.BRIGHTNESS, ...rgb]),
			light('on-only', [PropertyCategory.ON]),
			light('dimmer', [PropertyCategory.ON, PropertyCategory.BRIGHTNESS, ...rgb]),
		];
		const query = {
			leftJoinAndSelect: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			andWhere: jest.fn().mockReturnThis(),
			callListeners: jest.fn().mockReturnThis(),
			getMany: jest.fn().mockResolvedValue(channels),
		};
		quarantined = new Set(['dimmer-brightness']);
		outputs = [];
		catalog = new VirtualGroupCatalogService(
			{
				manager: {
					createQueryBuilder: () => query,
					findOneBy: () => Promise.resolve({ profile: VirtualLightGroupProfile.LIGHT }),
					find: () => Promise.resolve(outputs),
				},
				getMetadata: () => ({ discriminatorValue: 'devices-virtual' }),
			} as unknown as DataSource,
			{ isQuarantined: (id: string) => quarantined.has(id) } as VirtualDependencyGraphService,
		);
	});

	it('narrows additional members before excluding controls and retains all common controls for display', async () => {
		const dto = Object.assign(new GroupCatalogDto(), {
			selectedChannels: ['rgb'],
			excludedCapabilities: [PropertyCategory.BRIGHTNESS],
		});
		const result = await catalog.read(dto);
		expect(result.candidates.find(({ channel }) => channel === 'on-only')).toMatchObject({
			eligible: true,
			reasons: [],
			common_capabilities: [{ category: PropertyCategory.ON }],
		});
		const dimmer = result.candidates.find(({ channel }) => channel === 'dimmer');
		expect(dimmer.eligible).toBe(true);
		expect(dimmer.common_capabilities.map(({ category }) => category)).toEqual([
			PropertyCategory.ON,
			PropertyCategory.BRIGHTNESS,
			...rgb,
		]);
		dto.excludedCapabilities = [];
		expect((await catalog.read(dto)).candidates.find(({ channel }) => channel === 'dimmer')?.reasons).toContain(
			'graph_quarantined',
		);
	});

	it('still checks enabled controls and never excludes required controls from quarantine checks', async () => {
		quarantined = new Set(['rgb-color_red']);
		const dto = Object.assign(new GroupCatalogDto(), {
			selectedChannels: ['rgb'],
			excludedCapabilities: [PropertyCategory.BRIGHTNESS],
		});
		expect((await catalog.read(dto)).candidates.find(({ channel }) => channel === 'dimmer')?.reasons).toContain(
			'graph_quarantined',
		);
		expect((await catalog.read(dto)).candidates.find(({ channel }) => channel === 'on-only')?.eligible).toBe(true);
		quarantined = new Set(['on-only-on']);
		dto.excludedCapabilities = [PropertyCategory.ON, PropertyCategory.BRIGHTNESS];
		expect((await catalog.read(dto)).candidates.find(({ channel }) => channel === 'on-only')?.reasons).toContain(
			'graph_quarantined',
		);
	});

	it('preserves explicit capability requirements for callers that prohibit narrowing', async () => {
		const result = await catalog.read(
			Object.assign(new GroupCatalogDto(), {
				selectedChannels: ['rgb'],
				capabilities: [PropertyCategory.ON, ...rgb],
				excludedCapabilities: rgb,
			}),
		);
		expect(result.candidates.find(({ channel }) => channel === 'on-only')?.reasons).toEqual(
			rgb.map((category) => `group_capability_incompatible:${category}`),
		);
	});

	it('cannot exclude an existing output from repair eligibility checks', async () => {
		outputs = [Object.assign(new ChannelPropertyEntity(), { category: PropertyCategory.BRIGHTNESS })];
		const result = await catalog.read({
			selectedChannels: ['rgb'],
			exposedGroup: 'existing-group',
			excludedCapabilities: [PropertyCategory.BRIGHTNESS],
		});
		expect(result.candidates.find(({ channel }) => channel === 'dimmer')?.reasons).toContain('graph_quarantined');
		expect(result.candidates.find(({ channel }) => channel === 'on-only')?.reasons).toContain(
			'group_capability_incompatible:brightness',
		);
	});
});
