import { captureCreation } from './creation-capture';

// Original #1473 cases 255–261. Row 261 also needs the real required-method
// callsite controls in virtual-thermostat-authoring.integration.spec.ts;
// optional absence alone is not required-method admission or transport evidence.
describe('original method currentness through function-valued prototypes', () => {
	it('preserves ordinary prototype identity checks and refuses changed or missing captured methods', () => {
		const original = (): string => 'original';
		const prototype: { read?: () => string } = { read: original };
		const receiver: { read?: () => string } = {};
		Object.setPrototypeOf(receiver, prototype);
		const captured = captureCreation(receiver, ['read']);

		expect(captured.values.read).toBe(original);
		expect(captured.current()).toBe(true);
		prototype.read = (): string => 'replacement';
		expect(captured.current()).toBe(false);
		expect(captured.values.read).toBe(original);
		delete prototype.read;
		expect(captured.current()).toBe(false);
		expect(captured.values.read).toBe(original);
	});

	it('retains optional absence without treating it as required-callsite admission', () => {
		const receiver: { optional?: () => void } = {};
		const captured = captureCreation(receiver, ['optional']);
		expect(captured.values.optional).toBeUndefined();
		expect(captured.current()).toBe(true);
		receiver.optional = (): void => undefined;
		expect(captured.current()).toBe(false);
	});

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

	it.each(['enumerable', 'writable', 'configurable'] as const)(
		'refuses a captured property whose %s flag changes without changing its function',
		(flag) => {
			class Original {
				static read = (): string => 'original';
			}
			class Leaf extends Original {}
			const original = Original.read;
			const captured = captureCreation(Leaf, ['read']);
			Object.defineProperty(Original, 'read', { [flag]: false });
			expect(captured.current()).toBe(false);
			expect(captured.values.read).toBe(original);
			expect(Original.read).toBe(original);
		},
	);

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
