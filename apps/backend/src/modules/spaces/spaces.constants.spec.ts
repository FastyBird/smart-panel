import {
	isValidCategoryForType,
	LEGACY_OUTDOOR_CATEGORY,
	normalizeCategoryValue,
	SpaceRoomCategory,
	SpaceType,
	SpaceZoneCategory,
} from './spaces.constants';

describe('spaces.constants helper functions', () => {
	describe('isValidCategoryForType', () => {
		describe('with ROOM type', () => {
			it('should accept room categories', () => {
				expect(isValidCategoryForType(SpaceRoomCategory.LIVING_ROOM, SpaceType.ROOM)).toBe(true);
				expect(isValidCategoryForType(SpaceRoomCategory.BEDROOM, SpaceType.ROOM)).toBe(true);
				expect(isValidCategoryForType(SpaceRoomCategory.KITCHEN, SpaceType.ROOM)).toBe(true);
			});

			it('should reject zone categories', () => {
				expect(isValidCategoryForType(SpaceZoneCategory.FLOOR_GROUND, SpaceType.ROOM)).toBe(false);
				expect(isValidCategoryForType(SpaceZoneCategory.OUTDOOR_GARDEN, SpaceType.ROOM)).toBe(false);
			});

			it('should reject legacy outdoor value', () => {
				expect(isValidCategoryForType(LEGACY_OUTDOOR_CATEGORY, SpaceType.ROOM)).toBe(false);
			});

			it('should accept null', () => {
				expect(isValidCategoryForType(null, SpaceType.ROOM)).toBe(true);
			});
		});

		describe('with ZONE type', () => {
			it('should accept zone categories', () => {
				expect(isValidCategoryForType(SpaceZoneCategory.FLOOR_GROUND, SpaceType.ZONE)).toBe(true);
				expect(isValidCategoryForType(SpaceZoneCategory.OUTDOOR_GARDEN, SpaceType.ZONE)).toBe(true);
				expect(isValidCategoryForType(SpaceZoneCategory.SECURITY_PERIMETER, SpaceType.ZONE)).toBe(true);
			});

			it('should reject room categories', () => {
				expect(isValidCategoryForType(SpaceRoomCategory.LIVING_ROOM, SpaceType.ZONE)).toBe(false);
				expect(isValidCategoryForType(SpaceRoomCategory.BEDROOM, SpaceType.ZONE)).toBe(false);
			});

			it('should accept legacy outdoor value', () => {
				expect(isValidCategoryForType(LEGACY_OUTDOOR_CATEGORY, SpaceType.ZONE)).toBe(true);
			});

			it('should accept null', () => {
				expect(isValidCategoryForType(null, SpaceType.ZONE)).toBe(true);
			});
		});

		describe('edge cases', () => {
			it('should reject completely invalid category values', () => {
				expect(isValidCategoryForType('invalid_category', SpaceType.ROOM)).toBe(false);
				expect(isValidCategoryForType('invalid_category', SpaceType.ZONE)).toBe(false);
			});
		});
	});

	describe('normalizeCategoryValue', () => {
		describe('with ROOM type', () => {
			it('should return room category unchanged', () => {
				expect(normalizeCategoryValue(SpaceRoomCategory.LIVING_ROOM, SpaceType.ROOM)).toBe(
					SpaceRoomCategory.LIVING_ROOM,
				);
				expect(normalizeCategoryValue(SpaceRoomCategory.BEDROOM, SpaceType.ROOM)).toBe(SpaceRoomCategory.BEDROOM);
			});

			it('should return null unchanged', () => {
				expect(normalizeCategoryValue(null, SpaceType.ROOM)).toBeNull();
			});

			it('should not normalize legacy outdoor for ROOM (not applicable)', () => {
				// Legacy outdoor is only valid for zones, so normalization shouldn't happen for rooms
				expect(normalizeCategoryValue(LEGACY_OUTDOOR_CATEGORY, SpaceType.ROOM)).toBe(LEGACY_OUTDOOR_CATEGORY);
			});
		});

		describe('with ZONE type', () => {
			it('should return zone category unchanged', () => {
				expect(normalizeCategoryValue(SpaceZoneCategory.FLOOR_GROUND, SpaceType.ZONE)).toBe(
					SpaceZoneCategory.FLOOR_GROUND,
				);
				expect(normalizeCategoryValue(SpaceZoneCategory.OUTDOOR_GARDEN, SpaceType.ZONE)).toBe(
					SpaceZoneCategory.OUTDOOR_GARDEN,
				);
			});

			it('should return null unchanged', () => {
				expect(normalizeCategoryValue(null, SpaceType.ZONE)).toBeNull();
			});

			it('should normalize legacy outdoor to outdoor_garden', () => {
				expect(normalizeCategoryValue(LEGACY_OUTDOOR_CATEGORY, SpaceType.ZONE)).toBe(
					SpaceZoneCategory.OUTDOOR_GARDEN,
				);
			});
		});
	});
});
