import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { DEVICES_VIRTUAL_TYPE } from '../devices-virtual.constants';
import { VirtualChannelPropertyEntity, VirtualValueOrigin } from '../entities/devices-virtual.entity';

import { VirtualValueSourceService } from './virtual-value-source.service';

describe('VirtualValueSourceService', () => {
	let service: VirtualValueSourceService;

	const virtualProperty = (overrides: Partial<VirtualChannelPropertyEntity>): VirtualChannelPropertyEntity => {
		const property = new VirtualChannelPropertyEntity();

		Object.assign(
			property,
			{ id: 'virtual-prop', valueOrigin: VirtualValueOrigin.SOURCE, sourcePropertyId: null },
			overrides,
		);

		return property;
	};

	beforeEach(() => {
		service = new VirtualValueSourceService();
	});

	it('registers for the virtual discriminator', () => {
		expect(service.getType()).toBe(DEVICES_VIRTUAL_TYPE);
	});

	it('resolves a linked property to its source', () => {
		expect(service.resolve(virtualProperty({ sourcePropertyId: 'source-prop' }))).toBe('source-prop');
	});

	it('returns null for an owned property so it keeps its own series', () => {
		expect(service.resolve(virtualProperty({ valueOrigin: VirtualValueOrigin.LOCAL }))).toBeNull();
	});

	it('returns null for an orphaned property so it falls back to its own empty series', () => {
		expect(service.resolve(virtualProperty({ sourcePropertyId: null }))).toBeNull();
	});

	it('returns null for a property that is not a virtual entity', () => {
		expect(service.resolve({ id: 'x' } as ChannelPropertyEntity)).toBeNull();
	});
});
