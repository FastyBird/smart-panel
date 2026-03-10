import { SpaceRoomCategory, SpaceType, SpaceZoneCategory, isValidCategoryForType } from './spaces.constants';

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
});
