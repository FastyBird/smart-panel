export const PAGES_CARDS_PLUGIN_PREFIX = 'pages-cards';

export const PAGES_CARDS_PLUGIN_NAME = 'pages-cards-plugin';

export const PAGES_CARDS_TYPE = 'pages-cards';

export const PAGES_CARDS_PLUGIN_API_TAG_NAME = 'Pages cards plugin';

export const PAGES_CARDS_PLUGIN_API_TAG_DESCRIPTION =
	'A collection of endpoints that provide cards pages-related functionalities, acting as a central card plugin for handling tile interactions.';

export enum EventType {
	CARD_CREATED = 'PagesCardsPlugin.Card.Created',
	CARD_UPDATED = 'PagesCardsPlugin.Card.Updated',
	CARD_DELETED = 'PagesCardsPlugin.Card.Deleted',
	CARD_RESET = 'PagesCardsPlugin.Card.Reset',
	PLUGIN_RESET = 'PagesCardsPlugin.All.Reset',
}
