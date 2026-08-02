import isUndefined from 'lodash.isundefined';
import omitBy from 'lodash.omitby';

import { toInstance } from '../../../common/utils/transform.utils';
import { DEVICES_VIRTUAL_TYPE } from '../devices-virtual.constants';
import { UpdateVirtualChannelPropertyDto } from '../dto/update-channel-property.dto';

import { VirtualChannelPropertyEntity, VirtualValueOrigin } from './devices-virtual.entity';

describe('VirtualChannelPropertyEntity', () => {
	// Exactly the expression ChannelsPropertiesService.update() computes to decide which entity fields
	// a PATCH writes back (`Object.assign(property, updateFields)` immediately follows it). Reproduced
	// rather than mocked because the defect being pinned lives in that expression's interaction with
	// the entity's own field declarations, not in the service's logic around it.
	const updateFieldsFor = (dto: Partial<UpdateVirtualChannelPropertyDto>): Record<string, unknown> => {
		const instance = new UpdateVirtualChannelPropertyDto();

		Object.assign(instance, dto);

		return omitBy(toInstance(VirtualChannelPropertyEntity, instance), isUndefined) as Record<string, unknown>;
	};

	const propertyWith = (overrides: Partial<VirtualChannelPropertyEntity>): VirtualChannelPropertyEntity => {
		const property = new VirtualChannelPropertyEntity();

		Object.assign(property, overrides);

		return property;
	};

	describe('update transform', () => {
		// Regression test. `valueOrigin` used to carry a class field initializer
		// (`= VirtualValueOrigin.SOURCE`). class-transformer builds its target with `new Target()`
		// before copying any source value across, so that initializer survived `plainToInstance` even
		// for a PATCH that never mentioned `value_origin`, survived `omitBy(..., isUndefined)`, and was
		// then written by `Object.assign`. Renaming one of the synthesized (LOCAL) `device_information`
		// properties therefore silently converted an owned property into a `source` projection with no
		// source — an orphan — losing its value in the process.
		it('does not produce a valueOrigin for a patch that does not mention it', () => {
			const updateFields = updateFieldsFor({ type: DEVICES_VIRTUAL_TYPE, name: 'Renamed' });

			expect(updateFields).not.toHaveProperty('valueOrigin');
			expect(updateFields).toMatchObject({ name: 'Renamed' });
		});

		it('does produce a valueOrigin for a patch that does set it', () => {
			const updateFields = updateFieldsFor({
				type: DEVICES_VIRTUAL_TYPE,
				value_origin: VirtualValueOrigin.LOCAL,
			});

			expect(updateFields).toMatchObject({ valueOrigin: VirtualValueOrigin.LOCAL });
		});
	});

	describe('origin predicates', () => {
		it('classifies a property linked to a live source', () => {
			const property = propertyWith({
				valueOrigin: VirtualValueOrigin.SOURCE,
				sourcePropertyId: 'source-prop',
			});

			expect(property.isProjecting).toBe(true);
			expect(property.isLinked).toBe(true);
			expect(property.isOrphaned).toBe(false);
		});

		it('classifies a property whose source was deleted as orphaned', () => {
			const property = propertyWith({ valueOrigin: VirtualValueOrigin.SOURCE, sourcePropertyId: null });

			expect(property.isProjecting).toBe(true);
			expect(property.isLinked).toBe(false);
			expect(property.isOrphaned).toBe(true);
		});

		it('classifies an owned property as neither linked nor orphaned', () => {
			const property = propertyWith({ valueOrigin: VirtualValueOrigin.LOCAL, sourcePropertyId: null });

			expect(property.isProjecting).toBe(false);
			expect(property.isLinked).toBe(false);
			expect(property.isOrphaned).toBe(false);
		});

		// The flip side of dropping the field initializer: an entity built in memory and not yet read
		// back from the database has `valueOrigin === undefined`, and the column default is SOURCE — so
		// undefined must read as projecting. Treating it as owned would route a freshly created linked
		// property's first value write into its own series instead of its source's
		// (ChannelsPropertiesService.create() calls PropertyValueService.write() with exactly such an
		// entity, before the row is re-read).
		it('treats an unset valueOrigin as projecting, matching the column default', () => {
			const property = propertyWith({ sourcePropertyId: 'source-prop' });

			expect(property.valueOrigin).toBeUndefined();
			expect(property.isProjecting).toBe(true);
			expect(property.isLinked).toBe(true);
		});
	});
});
