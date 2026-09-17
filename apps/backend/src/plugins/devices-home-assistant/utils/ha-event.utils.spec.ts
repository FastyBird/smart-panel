import { mapHaEventTypesToFormat, normalizeHaEventType } from './ha-event.utils';

describe('ha-event.utils', () => {
	describe('normalizeHaEventType', () => {
		it('normalizes single press event variations', () => {
			expect(normalizeHaEventType('press')).toBe('press');
			expect(normalizeHaEventType('single')).toBe('press');
			expect(normalizeHaEventType('single_press')).toBe('press');
			expect(normalizeHaEventType('click')).toBe('press');
			expect(normalizeHaEventType('short_press')).toBe('press');
			expect(normalizeHaEventType('button_press')).toBe('press');
		});

		it('normalizes double press event variations', () => {
			expect(normalizeHaEventType('double')).toBe('double_press');
			expect(normalizeHaEventType('double_press')).toBe('double_press');
			expect(normalizeHaEventType('double_click')).toBe('double_press');
		});

		it('normalizes triple press event variations', () => {
			expect(normalizeHaEventType('triple')).toBe('triple_press');
			expect(normalizeHaEventType('triple_press')).toBe('triple_press');
			expect(normalizeHaEventType('triple_click')).toBe('triple_press');
		});

		it('normalizes hold and long press event variations', () => {
			expect(normalizeHaEventType('hold')).toBe('long_press');
			expect(normalizeHaEventType('long_press')).toBe('long_press');
			expect(normalizeHaEventType('long_click')).toBe('long_press');
			expect(normalizeHaEventType('press_hold')).toBe('long_press');
		});

		it('normalizes release and directional event variations', () => {
			expect(normalizeHaEventType('release')).toBe('release');
			expect(normalizeHaEventType('release_hold')).toBe('release');
			expect(normalizeHaEventType('up')).toBe('up');
			expect(normalizeHaEventType('arrow_up')).toBe('up');
			expect(normalizeHaEventType('down')).toBe('down');
			expect(normalizeHaEventType('arrow_down')).toBe('down');
		});

		it('preserves trimmed unknown custom event types', () => {
			expect(normalizeHaEventType('  custom_action  ')).toBe('custom_action');
		});
	});

	describe('mapHaEventTypesToFormat', () => {
		it('normalizes, deduplicates, and strips empty entries', () => {
			const input = ['press', 'single', 'double_press', 'hold', ''];
			const result = mapHaEventTypesToFormat(input);

			expect(result).toEqual(['press', 'double_press', 'long_press']);
		});
	});
});
