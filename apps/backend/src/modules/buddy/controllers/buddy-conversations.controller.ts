import { FastifyRequest as Request, FastifyReply as Response } from 'fastify';

import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req, Res } from '@nestjs/common';
import { ApiBody, ApiNoContentResponse, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';

import { createExtensionLogger } from '../../../common/logger';
import { setLocationHeader } from '../../api/utils/location-header.utils';
import {
	ApiBadRequestResponse,
	ApiCreatedSuccessResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiServiceUnavailableResponse,
	ApiSuccessResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import { BUDDY_MODULE_API_TAG_NAME, BUDDY_MODULE_NAME, BUDDY_MODULE_PREFIX } from '../buddy.constants';
import { CreateConversationDto, ReqCreateConversationDto } from '../dto/create-conversation.dto';
import { ReqSendMessageDto } from '../dto/send-message.dto';
import { ConversationResponseModel, ConversationsResponseModel } from '../models/conversation-response.model';
import { MessageResponseModel, MessagesResponseModel } from '../models/message-response.model';
import { BuddyConversationService } from '../services/buddy-conversation.service';

@ApiTags(BUDDY_MODULE_API_TAG_NAME)
@Controller('conversations')
export class BuddyConversationsController {
	private readonly logger = createExtensionLogger(BUDDY_MODULE_NAME, 'BuddyConversationsController');

	constructor(private readonly conversationService: BuddyConversationService) {}

	@ApiOperation({
		tags: [BUDDY_MODULE_API_TAG_NAME],
		summary: 'List all conversations',
		description:
			'Retrieves a list of all buddy conversations, ordered by most recent first. Each conversation includes its metadata (ID, title, space, timestamps).',
		operationId: 'get-buddy-module-conversations',
	})
	@ApiSuccessResponse(ConversationsResponseModel, 'A list of conversations successfully retrieved.')
	@ApiQuery({
		name: 'space_id',
		required: false,
		type: 'string',
		description: 'Filter conversations by space ID',
	})
	@ApiBadRequestResponse('Invalid request parameters')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get()
	async findAll(@Query('space_id') spaceId?: string): Promise<ConversationsResponseModel> {
		this.logger.debug('Fetching all conversations');

		const conversations = await this.conversationService.findAll(spaceId);

		this.logger.debug(`Retrieved ${conversations.length} conversations`);

		const response = new ConversationsResponseModel();

		response.data = conversations;

		return response;
	}

	@ApiOperation({
		tags: [BUDDY_MODULE_API_TAG_NAME],
		summary: 'Get a conversation',
		description:
			'Retrieves the metadata of a specific conversation by its unique ID (title, space, timestamps). Use GET /conversations/:id/messages to retrieve the messages.',
		operationId: 'get-buddy-module-conversation',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Conversation ID' })
	@ApiSuccessResponse(ConversationResponseModel, 'The conversation details were successfully retrieved.')
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Conversation not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get(':id')
	async findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<ConversationResponseModel> {
		this.logger.debug(`Fetching conversation id=${id}`);

		const conversation = await this.conversationService.findOneOrThrow(id);

		this.logger.debug(`Found conversation id=${conversation.id}`);

		const response = new ConversationResponseModel();

		response.data = conversation;

		return response;
	}

	@ApiOperation({
		tags: [BUDDY_MODULE_API_TAG_NAME],
		summary: 'Get messages for a conversation',
		description: 'Retrieves all messages for a specific conversation in chronological order.',
		operationId: 'get-buddy-module-conversation-messages',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Conversation ID' })
	@ApiSuccessResponse(MessagesResponseModel, 'The conversation messages were successfully retrieved.')
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Conversation not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get(':id/messages')
	async getMessages(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<MessagesResponseModel> {
		this.logger.debug(`Fetching messages for conversation id=${id}`);

		await this.conversationService.findOneOrThrow(id);

		const messages = await this.conversationService.getMessages(id);

		this.logger.debug(`Retrieved ${messages.length} messages for conversation id=${id}`);

		const response = new MessagesResponseModel();

		response.data = messages;

		return response;
	}

	@ApiOperation({
		tags: [BUDDY_MODULE_API_TAG_NAME],
		summary: 'Start a new conversation',
		description:
			'Creates a new buddy conversation. Optionally provide a title and a space ID to scope the context. A Location header is provided with the URI of the newly created resource.',
		operationId: 'create-buddy-module-conversation',
	})
	@ApiBody({ type: ReqCreateConversationDto, description: 'The data required to create a new conversation' })
	@ApiCreatedSuccessResponse(
		ConversationResponseModel,
		'The conversation was successfully created.',
		'/api/v1/modules/buddy/conversations/123e4567-e89b-12d3-a456-426614174000',
	)
	@ApiBadRequestResponse('Invalid request data')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post()
	async create(
		@Body() body: ReqCreateConversationDto,
		@Res({ passthrough: true }) res: Response,
		@Req() req: Request,
	): Promise<ConversationResponseModel> {
		this.logger.debug('Incoming request to create a new conversation');

		const dto: CreateConversationDto = body.data ?? {};

		const conversation = await this.conversationService.create(dto.title, dto.spaceId);

		this.logger.debug(`Successfully created conversation id=${conversation.id}`);

		setLocationHeader(req, res, BUDDY_MODULE_PREFIX, 'conversations', conversation.id);

		const response = new ConversationResponseModel();

		response.data = conversation;

		return response;
	}

	@ApiOperation({
		tags: [BUDDY_MODULE_API_TAG_NAME],
		summary: 'Send a message to the buddy',
		description:
			'Sends a user message to the buddy in a specific conversation. The buddy processes the message using the configured AI provider and returns a response. The user message and assistant response are both persisted.',
		operationId: 'send-buddy-module-conversation-message',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Conversation ID' })
	@ApiBody({ type: ReqSendMessageDto, description: 'The message to send to the buddy' })
	@ApiCreatedSuccessResponse(MessageResponseModel, 'The message was sent and the buddy responded successfully.')
	@ApiBadRequestResponse('Invalid request data')
	@ApiNotFoundResponse('Conversation not found')
	@ApiServiceUnavailableResponse('AI provider not configured')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post(':id/messages')
	async sendMessage(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() body: ReqSendMessageDto,
	): Promise<MessageResponseModel> {
		this.logger.debug(`Incoming message for conversation id=${id}`);

		const assistantMessage = await this.conversationService.sendMessage(id, body.data.content);

		this.logger.debug(`Buddy responded in conversation id=${id}, message id=${assistantMessage.id}`);

		const response = new MessageResponseModel();

		response.data = assistantMessage;

		return response;
	}

	@ApiOperation({
		tags: [BUDDY_MODULE_API_TAG_NAME],
		summary: 'Delete a conversation',
		description: 'Deletes a specific conversation and all associated messages. This action is irreversible.',
		operationId: 'delete-buddy-module-conversation',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Conversation ID' })
	@ApiNoContentResponse({ description: 'Conversation deleted successfully' })
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Conversation not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Delete(':id')
	@HttpCode(204)
	async remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<void> {
		this.logger.debug(`Incoming request to delete conversation id=${id}`);

		await this.conversationService.remove(id);

		this.logger.debug(`Successfully deleted conversation id=${id}`);
	}
}
