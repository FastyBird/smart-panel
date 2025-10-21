import { logger } from '../../../common';
import { AuthValidationException } from '../auth.exceptions';

import { SessionLoginReqSchema, TokenPairSchema } from './session.store.schemas';
import type { IAuthTokenPairRes, ISessionCreateActionPayload, ISessionLoginReq, ITokenPair } from './session.store.types';

export const transformTokenPairResponse = (response: IAuthTokenPairRes): ITokenPair => {
	const parsedTokenPair = TokenPairSchema.safeParse({
		accessToken: response.access_token,
		refreshToken: response.refresh_token,
		expiration: response.expiration,
		type: response.type,
	});

	if (!parsedTokenPair.success) {
		logger.error('Schema validation failed with:', parsedTokenPair.error);

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
		logger.error('Schema validation failed with:', parsedRequest.error);

		throw new AuthValidationException('Failed to validate login credentials request.');
	}

	return parsedRequest.data;
};
