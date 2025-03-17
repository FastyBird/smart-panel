import { UsersValidationException } from '../users.exceptions';

import {
	type IUser,
	type IUserCreateReq,
	type IUserRes,
	type IUserUpdateReq,
	type IUsersAddActionPayload,
	type IUsersEditActionPayload,
	UserCreateReqSchema,
	UserSchema,
	UserUpdateReqSchema,
} from './users.store.types';

export function transformUserResponse(response: IUserRes): IUser {
	const parsedUser = UserSchema.safeParse({
		id: response.id,
		username: response.username,
		email: response.email,
		firstName: response.first_name,
		lastName: response.last_name,
		isHidden: response.is_hidden,
		role: response.role,
		createdAt: response.created_at,
		updatedAt: response.updated_at,
	});

	if (!parsedUser.success) {
		throw new UsersValidationException('Failed to validate received user data.');
	}

	return parsedUser.data;
}

export function transformUserCreateRequest(user: IUsersAddActionPayload['data'] & { id?: string }): IUserCreateReq {
	const parsedRequest = UserCreateReqSchema.safeParse({
		id: user.id,
		username: user.username,
		password: user.password,
		email: user.email,
		first_name: user.firstName,
		last_name: user.lastName,
		role: user.role,
	});

	if (!parsedRequest.success) {
		throw new UsersValidationException('Failed to validate create user request.');
	}

	return parsedRequest.data;
}

export function transformUserUpdateRequest(user: IUsersEditActionPayload['data']): IUserUpdateReq {
	const parsedRequest = UserUpdateReqSchema.safeParse({
		username: user.username,
		password: user.password,
		email: user.email,
		first_name: user.firstName,
		last_name: user.lastName,
		role: user.role,
	});

	if (!parsedRequest.success) {
		throw new UsersValidationException('Failed to validate update user request.');
	}

	return parsedRequest.data;
}
