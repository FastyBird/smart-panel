import { Expose, Type } from 'class-transformer';
import { IsDefined, IsNotEmpty, IsObject, IsString, ValidateNested } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'BuddyModuleSendMessage' })
export class SendMessageDto {
	@ApiProperty({
		description: 'The message content to send to the buddy',
		type: 'string',
		example: "What's the temperature in the bedroom?",
	})
	@Expose()
	@IsNotEmpty({ message: '[{"field":"content","reason":"Message content must not be empty."}]' })
	@IsString({ message: '[{"field":"content","reason":"Message content must be a valid string."}]' })
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
