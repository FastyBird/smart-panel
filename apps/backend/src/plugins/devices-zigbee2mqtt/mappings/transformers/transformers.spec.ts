import { FormulaTransformer } from './transformers';

describe('FormulaTransformer', () => {
	describe('security validation', () => {
		it('should allow valid mathematical formulas', () => {
			// Simple arithmetic
			expect(() => new FormulaTransformer({ type: 'formula', read: 'value * 2' })).not.toThrow();
			expect(() => new FormulaTransformer({ type: 'formula', read: 'value / 100' })).not.toThrow();
			expect(() => new FormulaTransformer({ type: 'formula', read: 'value + 10' })).not.toThrow();
			expect(() => new FormulaTransformer({ type: 'formula', read: 'value - 5' })).not.toThrow();

			// Math functions
			expect(() => new FormulaTransformer({ type: 'formula', read: 'Math.round(value)' })).not.toThrow();
			expect(() => new FormulaTransformer({ type: 'formula', read: 'Math.floor(value / 2.54)' })).not.toThrow();
			expect(() => new FormulaTransformer({ type: 'formula', read: 'Math.abs(value)' })).not.toThrow();
			expect(() => new FormulaTransformer({ type: 'formula', read: 'Math.min(value, 100)' })).not.toThrow();
			expect(() => new FormulaTransformer({ type: 'formula', read: 'Math.max(0, value)' })).not.toThrow();

			// Complex expressions
			expect(() => new FormulaTransformer({ type: 'formula', read: 'Math.round(value * 100) / 100' })).not.toThrow();
		});

		it('should reject process access attempts', () => {
			expect(() => new FormulaTransformer({ type: 'formula', read: 'process.exit(1)' })).toThrow(/forbidden pattern/);
			expect(() => new FormulaTransformer({ type: 'formula', read: 'process.env.SECRET' })).toThrow(
				/forbidden pattern/,
			);
			expect(() => new FormulaTransformer({ type: 'formula', read: 'PROCESS.exit(1)' })).toThrow(/forbidden pattern/);
		});

		it('should reject require/import attempts', () => {
			expect(() => new FormulaTransformer({ type: 'formula', read: "require('fs')" })).toThrow(/forbidden pattern/);
			expect(() => new FormulaTransformer({ type: 'formula', read: "import('fs')" })).toThrow(/forbidden pattern/);
		});

		it('should reject global/eval access', () => {
			expect(() => new FormulaTransformer({ type: 'formula', read: 'global.process' })).toThrow(/forbidden pattern/);
			expect(() => new FormulaTransformer({ type: 'formula', read: "eval('1+1')" })).toThrow(/forbidden pattern/);
		});

		it('should reject infinite loop attempts (DoS)', () => {
			expect(() => new FormulaTransformer({ type: 'formula', read: 'while(true){}' })).toThrow(/forbidden pattern/);
			expect(() => new FormulaTransformer({ type: 'formula', read: 'for(;;){}' })).toThrow(/forbidden pattern/);
		});

		it('should reject function creation attempts', () => {
			expect(() => new FormulaTransformer({ type: 'formula', read: 'new Function("return 1")' })).toThrow(
				/forbidden pattern/,
			);
			expect(() => new FormulaTransformer({ type: 'formula', read: 'function f(){}' })).toThrow(/forbidden pattern/);
			expect(() => new FormulaTransformer({ type: 'formula', read: '(() => 1)()' })).toThrow(/forbidden pattern/);
		});

		it('should reject constructor/prototype access', () => {
			expect(() => new FormulaTransformer({ type: 'formula', read: 'value.constructor' })).toThrow(/forbidden pattern/);
			expect(() => new FormulaTransformer({ type: 'formula', read: 'value.__proto__' })).toThrow(/forbidden pattern/);
			expect(() => new FormulaTransformer({ type: 'formula', read: 'Object.prototype' })).toThrow(/forbidden pattern/);
		});

		it('should reject multiple statements', () => {
			expect(() => new FormulaTransformer({ type: 'formula', read: 'value; process.exit(1)' })).toThrow(
				/forbidden pattern/,
			);
		});

		it('should reject property access on non-Math objects', () => {
			expect(() => new FormulaTransformer({ type: 'formula', read: 'value.toString()' })).toThrow(
				/property access on 'value'/,
			);
			expect(() => new FormulaTransformer({ type: 'formula', read: 'Object.keys({})' })).toThrow(
				/property access on 'Object'/,
			);
		});

		it('should reject disallowed Math functions', () => {
			expect(() => new FormulaTransformer({ type: 'formula', read: 'Math.random()' })).toThrow(
				/Math.random is not an allowed/,
			);
		});

		it('should reject standalone function calls', () => {
			expect(() => new FormulaTransformer({ type: 'formula', read: 'parseInt(value)' })).toThrow(
				/function call 'parseInt\(\)' is not allowed/,
			);
			expect(() => new FormulaTransformer({ type: 'formula', read: 'alert(1)' })).toThrow(
				/function call 'alert\(\)' is not allowed/,
			);
		});
	});

	describe('formula execution', () => {
		it('should correctly transform values with read formula', () => {
			const transformer = new FormulaTransformer({
				type: 'formula',
				read: 'value * 2',
			});

			expect(transformer.read(50)).toBe(100);
			expect(transformer.read(0)).toBe(0);
			expect(transformer.read(-10)).toBe(-20);
		});

		it('should correctly transform values with write formula', () => {
			const transformer = new FormulaTransformer({
				type: 'formula',
				write: 'value / 2',
			});

			expect(transformer.write(100)).toBe(50);
			expect(transformer.write(0)).toBe(0);
		});

		it('should correctly use Math functions', () => {
			const transformer = new FormulaTransformer({
				type: 'formula',
				read: 'Math.round(value / 2.54)',
			});

			expect(transformer.read(254)).toBe(100);
			expect(transformer.read(127)).toBe(50);
		});

		it('should handle bidirectional formulas', () => {
			const transformer = new FormulaTransformer({
				type: 'formula',
				read: 'value * 100',
				write: 'value / 100',
			});

			expect(transformer.read(0.5)).toBe(50);
			expect(transformer.write(50)).toBe(0.5);
		});

		it('should return original value for non-numeric input', () => {
			const transformer = new FormulaTransformer({
				type: 'formula',
				read: 'value * 2',
			});

			expect(transformer.read('not a number')).toBe('not a number');
			expect(transformer.read(null)).toBe(null);
			expect(transformer.read(undefined)).toBe(undefined);
		});

		it('should pass through value if no formula defined', () => {
			const transformer = new FormulaTransformer({
				type: 'formula',
			});

			expect(transformer.read(42)).toBe(42);
			expect(transformer.write(42)).toBe(42);
		});
	});
});
