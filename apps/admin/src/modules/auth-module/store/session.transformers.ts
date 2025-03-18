import { AuthValidationException } from '../auth.exceptions';

import {
	type IAuthTokenPairRes,
	type ISessionCreateActionPayload,
	type ISessionLoginReq,
	type ITokenPair,
	SessionLoginReqSchema,
	TokenPairSchema,
} from './session.store.types';

export const transformTokenPairResponse = (response: IAuthTokenPairRes): ITokenPair => {
	const parsedTokenPair = TokenPairSchema.safeParse({
		accessToken: response.access_token,
		refreshToken: response.refresh_token,
		expiration: response.expiration,
		type: response.type,
	});

	if (!parsedTokenPair.success) {
		throw new AuthValidationException('Failed to validate received token pair data.');
	}

	return parsedTokenPair.data;
};

export const transformLoginRequest = (credentials: ISessionCreateActionPayload['data']): ISessionLoginReq => {
	const parsedRequest = SessionLoginReqSchema.safeParse({
		username: credentials.username,
		password: credentials.password,
	});

	if (!parsedRequest.success) {
		throw new AuthValidationException('Failed to validate login credentials request.');
	}

	return parsedRequest.data;
};
