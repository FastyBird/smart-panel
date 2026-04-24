import { ValidationOptions, registerDecorator } from 'class-validator';

export const USERS_MODULE_PREFIX = 'users';

export const USERS_MODULE_NAME = 'users-module';

export const USERS_MODULE_API_TAG_NAME = 'Users module';

export const USERS_MODULE_API_TAG_DESCRIPTION =
	'Endpoints for managing users, including user roles, permissions, and profile details.';

const DEFAULT_PASSWORD_MIN_LENGTH = 8;

// Resolved on every validation call rather than at module load, because
// `NestConfigModule.forRoot()` populates `process.env` from `.env` files
// AFTER all DTO modules have already been imported and their decorators
// evaluated. An eager read here would silently ignore values set in `.env`.
// Operators may lower this for deployments behind VPN/proxy where weak
// passwords are an accepted tradeoff. Floor of 1; invalid values fall back
// to the default.
export const getUsersPasswordMinLength = (): number => {
	const raw = process.env.FB_USERS_PASSWORD_MIN_LENGTH;

	if (typeof raw !== 'string' || raw.trim() === '') {
		return DEFAULT_PASSWORD_MIN_LENGTH;
	}

	const parsed = Number(raw);

	// Reject non-integers (e.g. "7.9") rather than rounding down — silently
	// floor-ing would weaken the policy below what the operator wrote.
	if (!Number.isInteger(parsed) || parsed < 1) {
		return DEFAULT_PASSWORD_MIN_LENGTH;
	}

	return parsed;
};

export function MinUsersPasswordLength(validationOptions?: ValidationOptions): PropertyDecorator {
	return (object: object, propertyName: string | symbol): void => {
		registerDecorator({
			name: 'minUsersPasswordLength',
			target: object.constructor,
			propertyName: propertyName as string,
			options: validationOptions,
			constraints: [],
			validator: {
				validate(value: unknown): boolean {
					return typeof value === 'string' && value.length >= getUsersPasswordMinLength();
				},
				defaultMessage(): string {
					return `[{"field":"password","reason":"Password must be at least ${getUsersPasswordMinLength()} characters long."}]`;
				},
			},
		});
	};
}

export enum EventType {
	USER_CREATED = 'UsersModule.User.Created',
	USER_UPDATED = 'UsersModule.User.Updated',
	USER_DELETED = 'UsersModule.User.Deleted',
	USER_RESET = 'UsersModule.User.Reset',
	MODULE_RESET = 'UsersModule.All.Reset',
}

export enum UserRole {
	OWNER = 'owner',
	ADMIN = 'admin',
	USER = 'user',
}

export enum UserLanguage {
	EN = 'en',
	CS = 'cs',
	DE = 'de',
	ES = 'es',
	PL = 'pl',
	SK = 'sk',
}
