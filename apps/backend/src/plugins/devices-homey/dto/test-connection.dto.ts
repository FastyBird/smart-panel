import { Expose, Transform, Type } from 'class-transformer';
import { IsDefined, IsEnum, IsIn, IsNotEmpty, IsObject, IsString, Matches, ValidateNested } from 'class-validator';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { IsSafeHomeyUrl, MAX_HOMEY_URL_LENGTH } from '../validators/homey-url.validator';

export enum HomeyTestConnectionMode {
	SAVED = 'saved',
	CANDIDATE = 'candidate',
}

@ApiSchema({ name: 'DevicesHomeyPluginTestConnection' })
export class HomeyTestConnectionDto {
	@ApiProperty({
		description: 'Selects whether to test the fully saved configuration or a complete unsaved candidate',
		enum: HomeyTestConnectionMode,
	})
	@Expose()
	@IsEnum(HomeyTestConnectionMode, {
		message: '[{"field":"mode","reason":"Mode must be either saved or candidate."}]',
	})
	mode: HomeyTestConnectionMode;
}

@ApiSchema({ name: 'DevicesHomeyPluginTestSavedConnection' })
export class HomeyTestSavedConnectionDto {
	@ApiProperty({
		description: 'Tests the persisted URL, API key, and bounded timeout without accepting overrides',
		enum: [HomeyTestConnectionMode.SAVED],
		example: HomeyTestConnectionMode.SAVED,
	})
	@Expose()
	@IsIn([HomeyTestConnectionMode.SAVED], {
		message: '[{"field":"mode","reason":"Saved connection mode is required."}]',
	})
	mode: HomeyTestConnectionMode.SAVED;
}

@ApiSchema({ name: 'DevicesHomeyPluginTestCandidateConnection' })
export class HomeyTestCandidateConnectionDto {
	@ApiProperty({
		description: 'Tests only the supplied unsaved URL and new API key',
		enum: [HomeyTestConnectionMode.CANDIDATE],
		example: HomeyTestConnectionMode.CANDIDATE,
	})
	@Expose()
	@IsIn([HomeyTestConnectionMode.CANDIDATE], {
		message: '[{"field":"mode","reason":"Candidate connection mode is required."}]',
	})
	mode: HomeyTestConnectionMode.CANDIDATE;

	@ApiProperty({
		description: 'Complete unsaved Homey local API URL',
		example: 'http://homey.local:4859',
		maxLength: MAX_HOMEY_URL_LENGTH,
	})
	@Expose()
	@IsDefined({ message: '[{"field":"url","reason":"Candidate URL is required."}]' })
	@IsNotEmpty({ message: '[{"field":"url","reason":"Candidate URL is required."}]' })
	@IsSafeHomeyUrl({
		message: `[{"field":"url","reason":"URL must be at most ${MAX_HOMEY_URL_LENGTH} characters and use HTTP or HTTPS without embedded credentials."}]`,
	})
	url: string;

	@ApiProperty({
		description: 'New API key for this candidate only. The persisted key is never used in candidate mode.',
		writeOnly: true,
		name: 'api_key',
	})
	@Expose({ name: 'api_key' })
	@Transform(
		({ obj }: { obj: Record<string, unknown> }) => (Object.hasOwn(obj, 'api_key') ? obj.api_key : obj.apiKey),
		{ toClassOnly: true },
	)
	@IsDefined({ message: '[{"field":"api_key","reason":"A new candidate API key is required."}]' })
	@IsString({ message: '[{"field":"api_key","reason":"API key must be a valid string."}]' })
	@Matches(/\S/, { message: '[{"field":"api_key","reason":"API key must contain a non-whitespace character."}]' })
	apiKey: string;
}

const determineTestConnectionDto = (object: unknown): new () => HomeyTestConnectionDto => {
	if (typeof object !== 'object' || object === null || !('data' in object)) {
		return HomeyTestConnectionDto;
	}

	const data = object.data;

	if (typeof data !== 'object' || data === null || !('mode' in data)) {
		return HomeyTestConnectionDto;
	}

	if (data.mode === HomeyTestConnectionMode.SAVED) {
		return HomeyTestSavedConnectionDto;
	}

	if (data.mode === HomeyTestConnectionMode.CANDIDATE) {
		return HomeyTestCandidateConnectionDto;
	}

	return HomeyTestConnectionDto;
};

@ApiSchema({ name: 'DevicesHomeyPluginReqTestConnection' })
export class HomeyTestConnectionRequestDto {
	@ApiProperty({
		description: 'Saved or candidate Homey connection test data',
		oneOf: [
			{ $ref: getSchemaPath(HomeyTestSavedConnectionDto) },
			{ $ref: getSchemaPath(HomeyTestCandidateConnectionDto) },
		],
		discriminator: {
			propertyName: 'mode',
			mapping: {
				saved: getSchemaPath(HomeyTestSavedConnectionDto),
				candidate: getSchemaPath(HomeyTestCandidateConnectionDto),
			},
		},
	})
	@Expose()
	@IsDefined({ message: '[{"field":"data","reason":"Connection test data is required."}]' })
	@IsObject({ message: '[{"field":"data","reason":"Connection test data must be an object."}]' })
	@ValidateNested()
	@Type((options) => determineTestConnectionDto(options?.object))
	data: HomeyTestSavedConnectionDto | HomeyTestCandidateConnectionDto;
}
