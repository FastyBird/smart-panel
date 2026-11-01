import { captureCreation } from './creation-capture';

// Original #1473 cases 255–260, bound to the current shared capture API. These
// are descriptor controls, not native SQL/transport or installed-device evidence.
describe('original method currentness through function-valued prototypes', () => {
	it('accepts the original inherited Date.parse on a local Date subclass', () => {
		class LocalDate extends Date {}
		const original = Date.parse;
		const captured = captureCreation(LocalDate, ['parse']);
		expect(captured.values.parse).toBe(original);
		expect(captured.current()).toBe(true);
	});

	it('preserves original identity through multiple function-valued parents', () => {
		class Original {
			static read = (value: number): number => value;
		}
		class Middle extends Original {}
		class Leaf extends Middle {}
		const captured = captureCreation(Leaf, ['read']);
		expect(captured.values.read).toBe(Original.read);
		expect(captured.current()).toBe(true);
	});

	it('refuses an own static replacement without recapturing the original', () => {
		class Original {
			static read = (): string => 'original';
		}
		class Leaf extends Original {}
		const original = Original.read;
		const captured = captureCreation(Leaf, ['read']);
		Leaf.read = (): string => 'replacement';
		expect(captured.current()).toBe(false);
		expect(captured.values.read).toBe(original);
	});

	it('refuses a nearer inherited static replacement', () => {
		class Original {
			static read = (): string => 'original';
		}
		class Middle extends Original {}
		class Leaf extends Middle {}
		const original = Original.read;
		const captured = captureCreation(Leaf, ['read']);
		Middle.read = (): string => 'replacement';
		expect(captured.current()).toBe(false);
		expect(captured.values.read).toBe(original);
	});

	it('refuses an own accessor returning the original without invoking its getter', () => {
		class Original {
			static read = (): string => 'original';
		}
		class Leaf extends Original {}
		const original = Original.read;
		const captured = captureCreation(Leaf, ['read']);
		let getterCalls = 0;
		Object.defineProperty(Leaf, 'read', {
			get: () => {
				getterCalls++;
				return original;
			},
		});
		expect(captured.current()).toBe(false);
		expect(getterCalls).toBe(0);
		expect(captured.values.read).toBe(original);
	});

	it('refuses a nearer inherited accessor without invoking it or falling through', () => {
		class Original {
			static read = (): string => 'original';
		}
		class Middle extends Original {}
		class Leaf extends Middle {}
		const original = Original.read;
		const captured = captureCreation(Leaf, ['read']);
		let getterCalls = 0;
		Object.defineProperty(Middle, 'read', {
			get: () => {
				getterCalls++;
				return original;
			},
		});
		expect(captured.current()).toBe(false);
		expect(getterCalls).toBe(0);
		expect(captured.values.read).toBe(original);
	});

	it('refuses a captured property whose enumerable flag changes without changing its function', () => {
		class Original {
			static read = (): string => 'original';
		}
		class Leaf extends Original {}
		const original = Original.read;
		const captured = captureCreation(Leaf, ['read']);
		Object.defineProperty(Original, 'read', { enumerable: false });
		expect(captured.current()).toBe(false);
		expect(captured.values.read).toBe(original);
		expect(Original.read).toBe(original);
	});

	it('refuses an own shadow holding the original function without recapturing it', () => {
		class Original {
			static read = (): string => 'original';
		}
		class Leaf extends Original {}
		const original = Original.read;
		const captured = captureCreation(Leaf, ['read']);
		Leaf.read = original;
		expect(captured.current()).toBe(false);
		expect(captured.values.read).toBe(original);
		expect(Leaf.read).toBe(original);
	});
});
