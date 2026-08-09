import { getMetadataStorage } from 'class-validator';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * `@ValidatorConstraint({ async })` has to agree with what `validate()` actually is.
 *
 * Today the two disagreeing is survivable: class-validator 0.15 dispatches on whether the returned
 * value is a promise, not on the flag, so an `async validate()` declared `async: false` is still
 * awaited (`ValidationExecutor.customValidations`, the `isPromise(validatedValue)` branch).
 *
 * It is survivable and not safe. The flag is read in one place that matters —
 * `if (customConstraintMetadata.async && this.ignoreAsyncValidations) return;` — which is how
 * `validateSync()` skips async constraints. A constraint that lies about being sync is *not* skipped
 * there: it runs, its promise goes on a queue `validateSync()` never awaits, and whatever it would
 * have rejected passes instead. Nothing reached by `validateSync()` uses one of these today — it
 * validates configuration, and these validate device, channel, user and scene references — so this
 * is a trap rather than a defect, and one nobody would think to look for after wiring a validator
 * into a config DTO.
 *
 * Asserted by asking each class rather than by listing the ones known to be wrong, so a validator
 * added later cannot join them quietly.
 */
describe('validator constraints declare what they are', () => {
	const validatorFiles = (directory: string): string[] =>
		readdirSync(directory).flatMap((entry) => {
			const path = join(directory, entry);

			if (statSync(path).isDirectory()) {
				return validatorFiles(path);
			}

			return path.endsWith('.validator.ts') && !path.endsWith('.spec.ts') ? [path] : [];
		});

	it('declares every asynchronous constraint async, and every synchronous one not', async () => {
		const mismatched: string[] = [];
		let checked = 0;

		for (const file of validatorFiles(join(__dirname, '..', '..'))) {
			const module = (await import(file)) as Record<string, unknown>;

			for (const exported of Object.values(module)) {
				if (typeof exported !== 'function') {
					continue;
				}

				// One entry when the class carries `@ValidatorConstraint`, none when it is anything else
				// this file happens to export.
				const [constraint] = getMetadataStorage().getTargetValidatorConstraints(exported);

				const validate = (exported as { prototype?: { validate?: (...args: unknown[]) => unknown } }).prototype
					?.validate;

				if (!constraint || !validate) {
					continue;
				}

				checked++;

				// The only honest question available statically, and the one that matters: a method declared
				// `async` always returns a promise, whatever it does inside.
				const isAsync = validate.constructor.name === 'AsyncFunction';

				if (isAsync !== constraint.async) {
					mismatched.push(
						`${exported.name} validates ${isAsync ? 'asynchronously' : 'synchronously'} but declares async: ${String(constraint.async)}`,
					);
				}
			}
		}

		expect(mismatched).toEqual([]);
		// The sweep is only worth anything if it found the validators at all.
		expect(checked).toBeGreaterThan(20);
	});
});
