import 'package:event_bus/event_bus.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/modules/dashboard/export.dart';
import 'package:fastybird_smart_panel/modules/deck/services/deck_service.dart';
import 'package:fastybird_smart_panel/modules/deck/services/intents_service.dart';
import 'package:fastybird_smart_panel/modules/devices/export.dart';
import 'package:fastybird_smart_panel/modules/scenes/export.dart';
import 'package:flutter/foundation.dart';

/// Deck module service responsible for registering deck-related services.
///
/// The deck module provides the main app navigation interface including:
/// - System views (Room, Master, Entry)
/// - Domain views (Lights, Climate, Media, Sensors)
/// - Dashboard pages
class DeckModuleService {
  late final IntentsService _intentsService;
  late final DeckService _deckService;

  DeckModuleService({
    required EventBus eventBus,
    required DashboardService dashboardService,
    required DevicesService devicesService,
    ScenesService? scenesService,
    ChannelPropertiesRepository? channelPropertiesRepository,
  }) {
    // Note: IntentsService must be created before DeckService since DeckService
    // needs to synchronize the deck with IntentsService after building it
    _intentsService = IntentsService(
      eventBus: eventBus,
      scenesService: scenesService,
      channelPropertiesRepository: channelPropertiesRepository,
    );

    _deckService = DeckService(
      dashboardService: dashboardService,
      intentsService: _intentsService,
      devicesService: devicesService,
    );

    locator.registerSingleton<IntentsService>(_intentsService);
    locator.registerSingleton<DeckService>(_deckService);

    if (kDebugMode) {
      debugPrint('[DECK MODULE] Services registered successfully');
    }
  }

  /// Gets the IntentsService instance.
  IntentsService get intentsService => _intentsService;

  /// Gets the DeckService instance.
  DeckService get deckService => _deckService;

  /// Disposes the module services.
  void dispose() {
    if (kDebugMode) {
      debugPrint('[DECK MODULE] Module disposed');
    }
  }
}
