import { ButtonSynthesizer } from './button-synthesizer';

describe('ButtonSynthesizer', () => {
	it('first level sets the baseline without events', () => {
		const s = new ButtonSynthesizer(800);

		expect(s.observe(false, 0)).toEqual([]);
	});

	it('emits down, then up and press for a short press', () => {
		const s = new ButtonSynthesizer(800);

		s.observe(false, 0);

		expect(s.observe(true, 100)).toEqual(['down']);
		expect(s.observe(false, 300)).toEqual(['up', 'press']);
	});

	it('emits long_press once while held', () => {
		const s = new ButtonSynthesizer(800);

		s.observe(false, 0);

		expect(s.observe(true, 100)).toEqual(['down']);
		expect(s.observe(true, 500)).toEqual([]);
		expect(s.observe(true, 900)).toEqual(['long_press']);
		expect(s.observe(true, 1200)).toEqual([]);
		expect(s.observe(false, 1300)).toEqual(['up']);
	});

	it('emits long_press and up when the release is seen after an unseen threshold', () => {
		const s = new ButtonSynthesizer(800);

		s.observe(false, 0);
		s.observe(true, 100);

		expect(s.observe(false, 1000)).toEqual(['long_press', 'up']);
	});

	it('emits only up when the baseline level is already pressed', () => {
		const s = new ButtonSynthesizer(800);

		expect(s.observe(true, 0)).toEqual([]);
		expect(s.observe(true, 2000)).toEqual([]);
		expect(s.observe(false, 2100)).toEqual(['up']);
	});

	it('resets on an unknown level', () => {
		const s = new ButtonSynthesizer(800);

		s.observe(false, 0);
		s.observe(true, 100);

		expect(s.observe(null, 200)).toEqual([]);
		expect(s.observe(true, 300)).toEqual([]);
		expect(s.observe(false, 400)).toEqual(['up']);
	});

	it('resets via reset()', () => {
		const s = new ButtonSynthesizer(800);

		s.observe(false, 0);
		s.observe(true, 100);
		s.reset();

		expect(s.observe(true, 200)).toEqual([]);
	});

	it('uses a configurable threshold', () => {
		const s = new ButtonSynthesizer(200);

		s.observe(false, 0);

		expect(s.observe(true, 0)).toEqual(['down']);
		expect(s.observe(true, 200)).toEqual(['long_press']);
	});
});
