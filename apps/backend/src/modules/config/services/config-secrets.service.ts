import { instanceToPlain } from 'class-transformer';

import { Injectable } from '@nestjs/common';

import { toSnakeCaseKeys } from '../../../common/utils/transform.utils';
import { ConfigSecretField } from '../interfaces/config-secret.interface';

const REDACTED_VALUE = '[REDACTED]';

type PlainConfig = Record<string, unknown>;

@Injectable()
export class ConfigSecretsService {
	toPublic<TConfig>(config: TConfig, fields: readonly ConfigSecretField[] = []): TConfig {
		const projected = this.toPlainConfig(config);

		for (const field of fields) {
			const configured = this.isConfigured(this.getPath(projected, field.path));

			this.deletePath(projected, field.path);
			this.setPath(projected, field.configuredPath, configured);
		}

		return projected as TConfig;
	}

	resolveUpdate<TUpdate>(
		existing: unknown,
		update: TUpdate,
		submitted: Record<string, unknown>,
		fields: readonly ConfigSecretField[] = [],
	): TUpdate {
		const existingPlain = this.toPlainConfig(existing);
		const updatePlain = this.toPlainConfig(update);
		const normalizedSubmitted = toSnakeCaseKeys<PlainConfig, PlainConfig>(this.toPlainConfig(submitted));

		for (const field of fields) {
			const inputPaths = [field.path, ...(field.inputPaths ?? [])];
			const rawSubmittedPath = inputPaths.find((inputPath) => this.hasPath(submitted, inputPath));
			const normalizedSubmittedPath = inputPaths.find((inputPath) => this.hasPath(normalizedSubmitted, inputPath));
			const submittedSecret = rawSubmittedPath
				? this.getPath(submitted, rawSubmittedPath)
				: normalizedSubmittedPath
					? this.getPath(normalizedSubmitted, normalizedSubmittedPath)
					: undefined;
			const preserveStoredSecret =
				(rawSubmittedPath === undefined && normalizedSubmittedPath === undefined) ||
				(typeof submittedSecret === 'string' && submittedSecret.trim().length === 0);

			if (preserveStoredSecret) {
				if (this.hasPath(existingPlain, field.path)) {
					this.setPath(updatePlain, field.path, this.getPath(existingPlain, field.path));
				}
			} else if (!this.hasPath(updatePlain, field.path)) {
				this.setPath(updatePlain, field.path, submittedSecret);
			}

			this.deletePath(updatePlain, field.configuredPath);
		}

		return updatePlain as TUpdate;
	}

	merge<TConfig>(existing: unknown, update: unknown): TConfig {
		return this.mergePlain(this.toPlainConfig(existing), this.toPlainConfig(update)) as TConfig;
	}

	redactForLogging<TValue>(
		value: TValue,
		fields: readonly ConfigSecretField[] = [],
		secretSource: unknown = value,
	): TValue {
		const redacted = this.toPlainValue(value);
		const source = this.toPlainConfig(secretSource);
		const secretValues: string[] = [];

		for (const field of fields) {
			const secretValue = this.getPath(source, field.path);

			if (typeof secretValue === 'string' && secretValue.length > 0) {
				secretValues.push(secretValue);
			}

			if (this.isPlainConfig(redacted) && this.hasPath(redacted, field.path)) {
				this.setPath(redacted, field.path, REDACTED_VALUE);
			}
		}

		return this.replaceSecretStrings(redacted, secretValues) as TValue;
	}

	private toPlainConfig(value: unknown): PlainConfig {
		const plain = this.toPlainValue(value);

		return this.isPlainConfig(plain) ? plain : {};
	}

	private toPlainValue(value: unknown): unknown {
		return instanceToPlain(value, {
			enableCircularCheck: true,
			exposeUnsetFields: false,
		});
	}

	private isPlainConfig(value: unknown): value is PlainConfig {
		return value !== null && typeof value === 'object' && !Array.isArray(value);
	}

	private splitPath(path: string): string[] {
		return path.split('.').filter((segment) => segment.length > 0);
	}

	private hasPath(value: PlainConfig, path: string): boolean {
		const segments = this.splitPath(path);
		let current: unknown = value;

		for (const segment of segments) {
			if (!this.isPlainConfig(current) || !Object.prototype.hasOwnProperty.call(current, segment)) {
				return false;
			}

			current = current[segment];
		}

		return segments.length > 0;
	}

	private getPath(value: PlainConfig, path: string): unknown {
		let current: unknown = value;

		for (const segment of this.splitPath(path)) {
			if (!this.isPlainConfig(current)) {
				return undefined;
			}

			current = current[segment];
		}

		return current;
	}

	private setPath(value: PlainConfig, path: string, nextValue: unknown): void {
		const segments = this.splitPath(path);
		const leaf = segments.pop();

		if (!leaf) {
			return;
		}

		let current = value;

		for (const segment of segments) {
			if (!this.isPlainConfig(current[segment])) {
				current[segment] = {};
			}

			current = current[segment] as PlainConfig;
		}

		current[leaf] = nextValue;
	}

	private deletePath(value: PlainConfig, path: string): void {
		const segments = this.splitPath(path);
		const leaf = segments.pop();

		if (!leaf) {
			return;
		}

		let current: unknown = value;

		for (const segment of segments) {
			if (!this.isPlainConfig(current)) {
				return;
			}

			current = current[segment];
		}

		if (this.isPlainConfig(current)) {
			delete current[leaf];
		}
	}

	private isConfigured(value: unknown): boolean {
		return value !== null && value !== undefined && (typeof value !== 'string' || value.trim().length > 0);
	}

	private replaceSecretStrings(value: unknown, secretValues: readonly string[]): unknown {
		if (typeof value === 'string') {
			return secretValues.reduce((redacted, secret) => redacted.split(secret).join(REDACTED_VALUE), value);
		}

		if (Array.isArray(value)) {
			return value.map((item) => this.replaceSecretStrings(item, secretValues));
		}

		if (this.isPlainConfig(value)) {
			return Object.fromEntries(
				Object.entries(value).map(([key, item]) => [key, this.replaceSecretStrings(item, secretValues)]),
			);
		}

		return value;
	}

	private mergePlain(existing: PlainConfig, update: PlainConfig): PlainConfig {
		const merged: PlainConfig = { ...existing };

		for (const [key, value] of Object.entries(update)) {
			const existingValue = merged[key];

			merged[key] =
				this.isPlainConfig(existingValue) && this.isPlainConfig(value) ? this.mergePlain(existingValue, value) : value;
		}

		return merged;
	}
}
