import {
	HomeyTransport,
	HomeyTransportEvent,
	HomeyTransportEventListener,
	HomeyTransportEventType,
	HomeyTransportUnsubscribe,
} from './homey-transport.interface';

/** Compatibility aliases retained for the local SDK adapter and live probes. */
export type HomeyLocalTransportEventType = HomeyTransportEventType;
export type HomeyLocalTransportEvent = HomeyTransportEvent;
export type HomeyLocalTransportEventListener = HomeyTransportEventListener;
export type HomeyLocalTransportUnsubscribe = HomeyTransportUnsubscribe;
export type HomeyLocalTransport = HomeyTransport;
