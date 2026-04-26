export const USERS_MODULE_PREFIX = 'users';

export const USERS_MODULE_NAME = 'users-module';

export const USERS_MODULE_API_TAG_NAME = 'Users module';

export const USERS_MODULE_API_TAG_DESCRIPTION =
	'Endpoints for managing users, including user roles, permissions, and profile details.';

const DEFAULT_PASSWORD_MIN_LENGTH = 8;

const parsePasswordMinLength = (raw: string | undefined): number => {
	if (raw === undefined || raw.trim() === '') {
		return DEFAULT_PASSWORD_MIN_LENGTH;
	}

	const parsed = Number(raw);

	if (!Number.isFinite(parsed) || parsed < 1) {
		return DEFAULT_PASSWORD_MIN_LENGTH;
	}

	return Math.floor(parsed);
};

// Resolved at module load so it can be used in class-validator decorators.
// Operators may lower this for deployments behind VPN/proxy where weak passwords
// are an accepted tradeoff. Floor of 1; invalid values fall back to the default.
export const USERS_PASSWORD_MIN_LENGTH = parsePasswordMinLength(process.env.FB_USERS_PASSWORD_MIN_LENGTH);

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
