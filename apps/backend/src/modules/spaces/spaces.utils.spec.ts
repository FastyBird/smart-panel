import { areSpaceNamesEquivalent, canonicalizeSpaceName } from './spaces.utils';

describe('spaces.utils', () => {
	describe('canonicalizeSpaceName', () => {
		it('should convert to lowercase', () => {
			expect(canonicalizeSpaceName('Living Room')).toBe('living room');
			expect(canonicalizeSpaceName('KITCHEN')).toBe('kitchen');
			expect(canonicalizeSpaceName('BedrOOM')).toBe('bedroom');
		});

		it('should trim whitespace', () => {
			expect(canonicalizeSpaceName('  Living Room  ')).toBe('living room');
			expect(canonicalizeSpaceName('\t Kitchen \n')).toBe('kitchen');
		});

		it('should collapse multiple spaces', () => {
			expect(canonicalizeSpaceName('Living  Room')).toBe('living room');
			expect(canonicalizeSpaceName('Living   Room   Area')).toBe('living room area');
		});

		it('should normalize underscores to spaces', () => {
			expect(canonicalizeSpaceName('living_room')).toBe('living room');
			expect(canonicalizeSpaceName('Living_Room')).toBe('living room');
		});

		it('should normalize hyphens to spaces', () => {
			expect(canonicalizeSpaceName('living-room')).toBe('living room');
			expect(canonicalizeSpaceName('Living-Room')).toBe('living room');
		});

		it('should remove diacritics', () => {
			expect(canonicalizeSpaceName('Café')).toBe('cafe');
			expect(canonicalizeSpaceName('Küche')).toBe('kuche');
			expect(canonicalizeSpaceName('Pokój')).toBe('pokoj');
			expect(canonicalizeSpaceName('Habitación')).toBe('habitacion');
		});

		it('should handle combined transformations', () => {
			expect(canonicalizeSpaceName('  Living_Room  ')).toBe('living room');
			expect(canonicalizeSpaceName('LIVING-ROOM')).toBe('living room');
			expect(canonicalizeSpaceName('  Küche_Zimmer  ')).toBe('kuche zimmer');
		});

		it('should handle empty string', () => {
			expect(canonicalizeSpaceName('')).toBe('');
			expect(canonicalizeSpaceName('   ')).toBe('');
		});

		it('should produce same result for equivalent names', () => {
			const canonical = 'living room';
			expect(canonicalizeSpaceName('Living Room')).toBe(canonical);
			expect(canonicalizeSpaceName('living room')).toBe(canonical);
			expect(canonicalizeSpaceName('living_room')).toBe(canonical);
			expect(canonicalizeSpaceName('LIVING_ROOM')).toBe(canonical);
			expect(canonicalizeSpaceName('Living-Room')).toBe(canonical);
			expect(canonicalizeSpaceName('  Living  Room  ')).toBe(canonical);
		});
	});

	describe('areSpaceNamesEquivalent', () => {
		it('should return true for equivalent names', () => {
			expect(areSpaceNamesEquivalent('Living Room', 'living room')).toBe(true);
			expect(areSpaceNamesEquivalent('Living Room', 'living_room')).toBe(true);
			expect(areSpaceNamesEquivalent('Living Room', 'LIVING-ROOM')).toBe(true);
			expect(areSpaceNamesEquivalent('Café', 'cafe')).toBe(true);
		});

		it('should return false for different names', () => {
			expect(areSpaceNamesEquivalent('Living Room', 'Bedroom')).toBe(false);
			expect(areSpaceNamesEquivalent('Kitchen', 'Küche')).toBe(false);
		});

		it('should handle edge cases', () => {
			expect(areSpaceNamesEquivalent('', '')).toBe(true);
			expect(areSpaceNamesEquivalent('   ', '')).toBe(true);
			expect(areSpaceNamesEquivalent('Room', 'room')).toBe(true);
		});
	});
});
