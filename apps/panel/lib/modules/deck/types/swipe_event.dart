/// Event fired to block or allow page swipe gestures.
///
/// Used by interactive widgets (like dials) that need to prevent
/// the parent PageView from intercepting drag gestures.
class PageSwipeBlockEvent {
  /// Whether page swiping should be blocked.
  final bool blocked;

  PageSwipeBlockEvent({required this.blocked});
}
