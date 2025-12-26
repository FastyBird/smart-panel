import { Expose, Transform, Type } from 'class-transformer';
import { IsEnum, ValidateNested } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { SuggestionFeedback, SuggestionType } from '../spaces.constants';

@ApiSchema({ name: 'SpacesModuleSuggestionFeedback' })
export class SuggestionFeedbackDto {
	@ApiProperty({
		name: 'suggestion_type',
		description: 'Type of the suggestion that was shown',
		enum: SuggestionType,
		example: SuggestionType.LIGHTING_RELAX,
	})
	@Expose({ name: 'suggestion_type' })
	@IsEnum(SuggestionType, { message: '[{"field":"suggestion_type","reason":"Suggestion type must be valid."}]' })
	@Transform(
		({ obj }: { obj: { suggestion_type?: SuggestionType; suggestionType?: SuggestionType } }) =>
			obj.suggestion_type ?? obj.suggestionType,
		{ toClassOnly: true },
	)
	suggestionType: SuggestionType;

	@ApiProperty({
		description: 'User feedback on the suggestion',
		enum: SuggestionFeedback,
		example: SuggestionFeedback.APPLIED,
	})
	@Expose()
	@IsEnum(SuggestionFeedback, { message: '[{"field":"feedback","reason":"Feedback must be valid."}]' })
	feedback: SuggestionFeedback;
}

@ApiSchema({ name: 'SpacesModuleReqSuggestionFeedback' })
export class ReqSuggestionFeedbackDto {
	@ApiProperty({
		description: 'Suggestion feedback data',
		type: () => SuggestionFeedbackDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => SuggestionFeedbackDto)
	data: SuggestionFeedbackDto;
}
