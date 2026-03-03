export interface IConversation {
	id: string;
	title: string | null;
	space_id: string | null;
	created_at: string;
	updated_at: string;
}

export interface IMessage {
	id: string;
	conversation_id: string;
	role: 'user' | 'assistant';
	content: string;
	created_at: string;
}
