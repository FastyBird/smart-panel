/// Event fired when navigation to a specific deck item is requested.
///
/// The deck navigation UI listens for this event and navigates to the item.
class NavigateToDeckItemEvent {
  /// The ID of the deck item to navigate to.
  final String itemId;

  NavigateToDeckItemEvent(this.itemId);
}
