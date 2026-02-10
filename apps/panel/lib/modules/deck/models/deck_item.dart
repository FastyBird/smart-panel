import 'package:fastybird_smart_panel/modules/dashboard/views/pages/view.dart';
import 'package:fastybird_smart_panel/modules/deck/types/deck_item_type.dart';
import 'package:fastybird_smart_panel/modules/deck/types/domain_type.dart';
import 'package:fastybird_smart_panel/modules/deck/types/system_view_type.dart';

/// Base class for items in the navigation deck.
///
/// The deck is the ordered list of views the user can swipe through.
/// It consists of exactly one system view followed by dashboard pages.
sealed class DeckItem {
  /// Unique identifier for this deck item.
  final String id;

  /// The type of this deck item.
  DeckItemType get type;

  const DeckItem({required this.id});

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is DeckItem && other.id == id && other.type == type;
  }

  @override
  int get hashCode => Object.hash(id, type);
}

/// A system-generated overview view based on display role.
///
/// System views are automatically determined based on the display's role:
/// - Room displays show a room-centric overview
/// - Master displays show a whole-house overview
/// - Entry displays show house modes and security status
class SystemViewItem extends DeckItem {
  /// The type of system view to render.
  final SystemViewType viewType;

  /// The room ID for room views (required for room type, null for others).
  final String? roomId;

  /// Human-readable title for this view.
  final String title;

  const SystemViewItem({
    required super.id,
    required this.viewType,
    this.roomId,
    required this.title,
  });

  @override
  DeckItemType get type => DeckItemType.systemView;

  /// Factory to create a system view ID based on type and optional room.
  static String generateId(SystemViewType type, [String? roomId]) {
    final base = 'system-view-${type.name}';
    if (roomId != null) {
      return '$base-$roomId';
    }
    return base;
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is SystemViewItem &&
        other.id == id &&
        other.viewType == viewType &&
        other.roomId == roomId;
  }

  @override
  int get hashCode => Object.hash(id, viewType, roomId);
}

/// A domain-specific view for a room (lights, climate, media, sensors).
///
/// Domain views are generated based on which device categories are present
/// in the room. Only domains with count > 0 are added to the deck.
class DomainViewItem extends DeckItem {
  /// The domain type (lights, climate, media, sensors).
  final DomainType domainType;

  /// The room ID this domain view belongs to.
  final String roomId;

  /// Human-readable title for this view.
  final String title;

  /// Number of devices in this domain.
  final int deviceCount;

  const DomainViewItem({
    required super.id,
    required this.domainType,
    required this.roomId,
    required this.title,
    required this.deviceCount,
  });

  @override
  DeckItemType get type => DeckItemType.domainView;

  /// Factory to create a domain view ID.
  static String generateId(DomainType domain, String roomId) {
    return 'domain-${domain.name}-$roomId';
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is DomainViewItem &&
        other.id == id &&
        other.domainType == domainType &&
        other.roomId == roomId;
  }

  @override
  int get hashCode => Object.hash(id, domainType, roomId);
}

/// The security view showing entry points, alerts, and events.
class SecurityViewItem extends DeckItem {
  /// Human-readable title for this view.
  final String title;

  const SecurityViewItem({
    required super.id,
    required this.title,
  });

  @override
  DeckItemType get type => DeckItemType.securityView;

  /// Standard ID for the security view.
  static String generateId() => 'security-view';

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is SecurityViewItem && other.id == id;
  }

  @override
  int get hashCode => id.hashCode;
}

/// The energy view showing consumption, production, and breakdown.
class EnergyViewItem extends DeckItem {
  /// Human-readable title for this view.
  final String title;

  const EnergyViewItem({
    required super.id,
    required this.title,
  });

  @override
  DeckItemType get type => DeckItemType.energyView;

  /// Standard ID for the energy view.
  static String generateId() => 'energy-view';

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is EnergyViewItem && other.id == id;
  }

  @override
  int get hashCode => id.hashCode;
}

/// A user-configured dashboard page.
///
/// Dashboard pages are created and managed through the Admin interface.
/// They include tiles pages, cards pages, device detail pages, etc.
class DashboardPageItem extends DeckItem {
  /// The underlying page view model.
  final DashboardPageView pageView;

  const DashboardPageItem({
    required super.id,
    required this.pageView,
  });

  @override
  DeckItemType get type => DeckItemType.dashboardPage;

  /// The page title.
  String get title => pageView.title;

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is DashboardPageItem && other.id == id;
  }

  @override
  int get hashCode => id.hashCode;
}
