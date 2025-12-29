import { validate } from 'class-validator';

import { Expose } from 'class-transformer';

import { LEGACY_OUTDOOR_CATEGORY, SpaceRoomCategory, SpaceType, SpaceZoneCategory } from '../spaces.constants';

import { IsValidSpaceCategory } from './space-category-constraint.validator';

class TestCreateDto {
	@Expose()
	type?: SpaceType;

	@Expose()
	@IsValidSpaceCategory()
	category?: string | null;
}

describe('SpaceCategoryConstraintValidator', () => {
	describe('with type provided', () => {
		it('should accept ROOM with room category', async () => {
			const dto = new TestCreateDto();
			dto.type = SpaceType.ROOM;
			dto.category = SpaceRoomCategory.LIVING_ROOM;

			const errors = await validate(dto);
			expect(errors.length).toBe(0);
		});

		it('should accept ZONE with zone category', async () => {
			const dto = new TestCreateDto();
			dto.type = SpaceType.ZONE;
			dto.category = SpaceZoneCategory.FLOOR_GROUND;

			const errors = await validate(dto);
			expect(errors.length).toBe(0);
		});

		it('should reject ROOM with zone category', async () => {
			const dto = new TestCreateDto();
			dto.type = SpaceType.ROOM;
			dto.category = SpaceZoneCategory.FLOOR_GROUND;

			const errors = await validate(dto);
			expect(errors.length).toBe(1);
			expect(errors[0].property).toBe('category');
		});

		it('should reject ZONE with room category', async () => {
			const dto = new TestCreateDto();
			dto.type = SpaceType.ZONE;
			dto.category = SpaceRoomCategory.LIVING_ROOM;

			const errors = await validate(dto);
			expect(errors.length).toBe(1);
			expect(errors[0].property).toBe('category');
		});

		it('should accept ZONE with legacy outdoor value', async () => {
			const dto = new TestCreateDto();
			dto.type = SpaceType.ZONE;
			dto.category = LEGACY_OUTDOOR_CATEGORY;

			const errors = await validate(dto);
			expect(errors.length).toBe(0);
		});

		it('should reject ROOM with legacy outdoor value', async () => {
			const dto = new TestCreateDto();
			dto.type = SpaceType.ROOM;
			dto.category = LEGACY_OUTDOOR_CATEGORY;

			const errors = await validate(dto);
			expect(errors.length).toBe(1);
			expect(errors[0].property).toBe('category');
		});

		it('should accept null category for ROOM', async () => {
			const dto = new TestCreateDto();
			dto.type = SpaceType.ROOM;
			dto.category = null;

			const errors = await validate(dto);
			expect(errors.length).toBe(0);
		});

		it('should accept null category for ZONE', async () => {
			const dto = new TestCreateDto();
			dto.type = SpaceType.ZONE;
			dto.category = null;

			const errors = await validate(dto);
			expect(errors.length).toBe(0);
		});

		it('should reject invalid category value for ROOM', async () => {
			const dto = new TestCreateDto();
			dto.type = SpaceType.ROOM;
			dto.category = 'invalid_category';

			const errors = await validate(dto);
			expect(errors.length).toBe(1);
			expect(errors[0].property).toBe('category');
		});

		it('should reject invalid category value for ZONE', async () => {
			const dto = new TestCreateDto();
			dto.type = SpaceType.ZONE;
			dto.category = 'invalid_category';

			const errors = await validate(dto);
			expect(errors.length).toBe(1);
			expect(errors[0].property).toBe('category');
		});
	});

	describe('without type provided (update case)', () => {
		it('should accept room category when type is not provided', async () => {
			const dto = new TestCreateDto();
			dto.category = SpaceRoomCategory.BEDROOM;

			const errors = await validate(dto);
			expect(errors.length).toBe(0);
		});

		it('should accept zone category when type is not provided', async () => {
			const dto = new TestCreateDto();
			dto.category = SpaceZoneCategory.OUTDOOR_GARDEN;

			const errors = await validate(dto);
			expect(errors.length).toBe(0);
		});

		it('should accept legacy outdoor value when type is not provided', async () => {
			const dto = new TestCreateDto();
			dto.category = LEGACY_OUTDOOR_CATEGORY;

			const errors = await validate(dto);
			expect(errors.length).toBe(0);
		});

		it('should accept null category when type is not provided', async () => {
			const dto = new TestCreateDto();
			dto.category = null;

			const errors = await validate(dto);
			expect(errors.length).toBe(0);
		});

		it('should reject invalid category when type is not provided', async () => {
			const dto = new TestCreateDto();
			dto.category = 'totally_invalid';

			const errors = await validate(dto);
			expect(errors.length).toBe(1);
			expect(errors[0].property).toBe('category');
		});
	});

	describe('all room categories', () => {
		const roomCategories = Object.values(SpaceRoomCategory);

		it.each(roomCategories)('should accept ROOM with %s', async (category) => {
			const dto = new TestCreateDto();
			dto.type = SpaceType.ROOM;
			dto.category = category;

			const errors = await validate(dto);
			expect(errors.length).toBe(0);
		});
	});

	describe('all zone categories', () => {
		const zoneCategories = Object.values(SpaceZoneCategory);

		it.each(zoneCategories)('should accept ZONE with %s', async (category) => {
			const dto = new TestCreateDto();
			dto.type = SpaceType.ZONE;
			dto.category = category;

			const errors = await validate(dto);
			expect(errors.length).toBe(0);
		});
	});
});
