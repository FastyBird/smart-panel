import 'package:fastybird_smart_panel/modules/deck/models/deck_item.dart';

/// Event fired when the deck page changes (via swipe or tap navigation).
///
/// Domain views subscribe to this event to know when they become the active
/// page. When active in portrait mode, they register their mode config
/// with [BottomNavModeNotifier]. When they lose focus, they clear it.
class DeckPageActivatedEvent {
  /// The ID of the newly active deck item.
  final String itemId;

  /// The deck item that was activated.
  final DeckItem item;

  DeckPageActivatedEvent({required this.itemId, required this.item});
}
