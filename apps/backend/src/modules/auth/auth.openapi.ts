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
	LoginResponseModel,
	ProfileResponseModel,
	RefreshResponseModel,
	TokenPairResponseModel,
	TokenResponseModel,
	TokensResponseModel,
} from './models/auth-response.model';
import { CheckModel, LoggedInModel, RefreshTokenModel, TokenPairModel } from './models/auth.model';
import { AuthConfigModel } from './models/config.model';

export const AUTH_SWAGGER_EXTRA_MODELS = [
	// Module configuration
	AuthConfigModel,
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
	CheckResponseModel,
	CheckEmailResponseModel,
	CheckUsernameResponseModel,
	TokenPairResponseModel,
	TokenResponseModel,
	TokensResponseModel,
	// Data models
	LoggedInModel,
	RefreshTokenModel,
	CheckModel,
	TokenPairModel,
	// Entities
	AccessTokenEntity,
	RefreshTokenEntity,
	LongLiveTokenEntity,
];
