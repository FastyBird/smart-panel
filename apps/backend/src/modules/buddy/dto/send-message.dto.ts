import { Expose, Transform, Type } from 'class-transformer';
import { IsDefined, IsNotEmpty, IsObject, IsString, MaxLength, ValidateNested } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'BuddyModuleSendMessage' })
export class SendMessageDto {
	@ApiProperty({
		description: 'The message content to send to the buddy',
		type: 'string',
		example: "What's the temperature in the bedroom?",
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
	@IsNotEmpty({ message: '[{"field":"content","reason":"Message content cannot be empty."}]' })
	@IsString({ message: '[{"field":"content","reason":"Message content must be a valid string."}]' })
	@MaxLength(10000, { message: '[{"field":"content","reason":"Message content must not exceed 10000 characters."}]' })
	content: string;
}

@ApiSchema({ name: 'BuddyModuleReqSendMessage' })
export class ReqSendMessageDto {
	@ApiProperty({ description: 'Message data', type: () => SendMessageDto })
	@Expose()
	@IsDefined({ message: '[{"field":"data","reason":"Message data is required."}]' })
	@IsObject({ message: '[{"field":"data","reason":"Message data must be an object."}]' })
	@ValidateNested()
	@Type(() => SendMessageDto)
	data: SendMessageDto;
}
