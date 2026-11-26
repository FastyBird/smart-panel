import { type InjectionKey, inject, provide } from 'vue';

import type { IUseBuddyChat } from './useBuddyChat';

// The chat view owns the chats and the open conversation; the conversation route, in its pane or as its own page,
// reads the same state
const BUDDY_CHAT: InjectionKey<IUseBuddyChat> = Symbol('buddy-chat');

export const provideBuddyChat = (chat: IUseBuddyChat): void => {
	provide(BUDDY_CHAT, chat);
};

export const injectBuddyChat = (): IUseBuddyChat => {
	const chat = inject(BUDDY_CHAT);

	if (!chat) {
		throw new Error('The Buddy conversation opens inside the Buddy chat view');
	}

	return chat;
};
