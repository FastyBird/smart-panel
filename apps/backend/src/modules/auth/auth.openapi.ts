/**
 * OpenAPI extra models for Auth module
 */
import {
	CreateAccessTokenDto,
	CreateLongLiveTokenDto,
	CreateRefreshTokenDto,
	ReqCreateTokenDto,
} from './dto/create-token.dto';
import {
	ReqUpdateTokenDto,
	UpdateAccessTokenDto,
	UpdateLongLiveTokenDto,
	UpdateRefreshTokenDto,
} from './dto/update-token.dto';
import { AccessTokenEntity, LongLiveTokenEntity, RefreshTokenEntity } from './entities/auth.entity';
import {
	CheckEmailResponseModel,
	CheckResponseModel,
	CheckUsernameResponseModel,
	DisplaySecretResponseModel,
	LoginResponseModel,
	ProfileResponseModel,
	RefreshResponseModel,
	RegisterDisplayResponseModel,
	TokenPairResponseModel,
	TokenResponseModel,
	TokensResponseModel,
} from './models/auth-response.model';
import {
	CheckModel,
	DisplaySecretModel,
	LoggedInModel,
	RefreshTokenModel,
	RegisteredDisplayModel,
	TokenPairModel,
} from './models/auth.model';

export const AUTH_SWAGGER_EXTRA_MODELS = [
	// DTOs
	CreateAccessTokenDto,
	CreateRefreshTokenDto,
	CreateLongLiveTokenDto,
	ReqCreateTokenDto,
	UpdateAccessTokenDto,
	UpdateRefreshTokenDto,
	UpdateLongLiveTokenDto,
	ReqUpdateTokenDto,
	// Response models
	ProfileResponseModel,
	LoginResponseModel,
	RefreshResponseModel,
	RegisterDisplayResponseModel,
	CheckResponseModel,
	CheckEmailResponseModel,
	CheckUsernameResponseModel,
	DisplaySecretResponseModel,
	TokenPairResponseModel,
	TokenResponseModel,
	TokensResponseModel,
	// Data models
	LoggedInModel,
	RefreshTokenModel,
	RegisteredDisplayModel,
	CheckModel,
	DisplaySecretModel,
	TokenPairModel,
	// Entities
	AccessTokenEntity,
	RefreshTokenEntity,
	LongLiveTokenEntity,
];
