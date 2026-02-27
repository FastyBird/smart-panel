import { Expose, Type } from 'class-transformer';
import { IsEnum, ValidateNested } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { SuggestionFeedback } from '../services/suggestion-engine.service';

@ApiSchema({ name: 'BuddyModuleSuggestionFeedback' })
export class SuggestionFeedbackDto {
	@ApiProperty({
		description: 'Feedback action for the suggestion',
		enum: SuggestionFeedback,
		example: SuggestionFeedback.APPLIED,
	})
	@Expose()
	@IsEnum(SuggestionFeedback, {
		message: '[{"field":"feedback","reason":"Feedback must be either applied or dismissed."}]',
	})
	feedback: SuggestionFeedback;
}

@ApiSchema({ name: 'BuddyModuleReqSuggestionFeedback' })
export class ReqSuggestionFeedbackDto {
	@ApiProperty({ description: 'Feedback data', type: () => SuggestionFeedbackDto })
	@Expose()
	@ValidateNested()
	@Type(() => SuggestionFeedbackDto)
	data: SuggestionFeedbackDto;
}
