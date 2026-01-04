import 'dart:async';

import 'package:event_bus/event_bus.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/features/deck/mappers/deck_item.dart';
import 'package:fastybird_smart_panel/features/deck/presentation/config_error.dart';
import 'package:fastybird_smart_panel/modules/dashboard/events/navigate_to_page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/export.dart';
import 'package:fastybird_smart_panel/plugins/pages-device-detail/views/view.dart';
import 'package:fastybird_smart_panel/modules/deck/export.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:provider/provider.dart';

/// Dashboard screen that uses the new Deck navigation system.
///
/// The deck consists of:
/// - One system view at index 0 (Room/Master/Entry based on display role)
/// - Dashboard pages at index 1+ (user-configured pages)
///
/// Navigation starts at the deck's startIndex which is determined by:
/// - homeMode=auto → system view (index 0)
/// - homeMode=explicit → the specified homePageId
class DeckDashboardScreen extends StatefulWidget {
  const DeckDashboardScreen({super.key});

  @override
  State<DeckDashboardScreen> createState() => _DeckDashboardScreenState();
}

class _DeckDashboardScreenState extends State<DeckDashboardScreen> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();
  final DashboardService _dashboardService = locator<DashboardService>();
  final EventBus _eventBus = locator<EventBus>();

  PageController? _pageController;
  int _currentIndex = 0;
  bool _initialized = false;

  StreamSubscription<NavigateToPageEvent>? _pageNavigateSubscription;
  StreamSubscription<NavigateToDeckItemEvent>? _deckNavigateSubscription;

  @override
  void initState() {
    super.initState();
    // Listen for legacy page navigation events (backwards compatibility)
    _pageNavigateSubscription =
        _eventBus.on<NavigateToPageEvent>().listen(_onNavigateToPage);
    // Listen for new deck navigation events
    _deckNavigateSubscription =
        _eventBus.on<NavigateToDeckItemEvent>().listen(_onNavigateToDeckItem);
  }

  @override
  void dispose() {
    _pageNavigateSubscription?.cancel();
    _deckNavigateSubscription?.cancel();
    _pageController?.dispose();
    super.dispose();
  }

  void _onNavigateToPage(NavigateToPageEvent event) {
    if (!mounted) return;

    final deckService = context.read<DeckService>();
    final index = deckService.indexOfItem(event.pageId);

    if (index >= 0 && _pageController?.hasClients == true) {
      _pageController?.animateToPage(
        index,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
    }
  }

  void _onNavigateToDeckItem(NavigateToDeckItemEvent event) {
    if (!mounted) return;

    final deckService = context.read<DeckService>();
    final index = deckService.indexOfItem(event.itemId);

    if (index >= 0 && _pageController?.hasClients == true) {
      _pageController?.animateToPage(
        index,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
    }
  }

  void _updateTrackedItem(DeckService deckService, int index) {
    final items = deckService.items;
    if (index >= 0 && index < items.length) {
      final item = items[index];
      // Track page ID for space-aware idle mode
      if (item is DashboardPageItem) {
        _dashboardService.setCurrentPageId(item.id);
      } else if (item is SystemViewItem) {
        // For system views, track using the view's ID
        _dashboardService.setCurrentPageId(item.id);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<DeckService>(
      builder: (context, deckService, _) {
        // Show configuration error if present
        // Note: No retry button shown because configuration errors (e.g., room
        // display without roomId) require Admin configuration, not a retry.
        if (deckService.hasConfigError) {
          return ConfigErrorScreen(
            errorMessage: deckService.configError!,
          );
        }

        // Show loading while deck is being built
        if (!deckService.isInitialized) {
          return Scaffold(
            body: Center(
              child: CircularProgressIndicator(
                color: Theme.of(context).colorScheme.primary,
              ),
            ),
          );
        }

        // Show empty state if no items
        if (deckService.items.isEmpty) {
          return _buildEmptyState(context);
        }

        // Initialize PageController on first build
        if (!_initialized) {
          final startIndex = deckService.startIndex;
          _pageController = PageController(initialPage: startIndex);
          _currentIndex = startIndex;
          _initialized = true;
          _updateTrackedItem(deckService, startIndex);
        }

        // Build widgets for each deck item
        final widgets = deckService.items
            .map((item) => buildDeckItemWidget(item))
            .toList();

        // Clamp current index to valid range (handles both negative and overflow)
        final maxIndex = widgets.length - 1;
        final clampedIndex = _currentIndex.clamp(0, maxIndex);
        if (_currentIndex != clampedIndex) {
          _currentIndex = clampedIndex;
          _updateTrackedItem(deckService, _currentIndex);
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (_pageController?.hasClients == true) {
              _pageController?.jumpToPage(_currentIndex);
            }
          });
        }

        final currentItem = deckService.items[_currentIndex];

        return Scaffold(
          body: Stack(
            children: [
              PageView.builder(
                controller: _pageController,
                onPageChanged: (index) {
                  setState(() {
                    _currentIndex = index;
                  });
                  _updateTrackedItem(deckService, index);
                },
                itemCount: widgets.length,
                itemBuilder: (context, index) => widgets[index % widgets.length],
              ),
              if (_shouldShowPageIndicator(currentItem))
                _buildPageIndicator(context, deckService),
            ],
          ),
        );
      },
    );
  }

  Widget _buildEmptyState(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Padding(
          padding: AppSpacings.paddingMd,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                MdiIcons.alert,
                color: Theme.of(context).brightness == Brightness.light
                    ? AppColorsLight.warning
                    : AppColorsDark.warning,
                size: _screenService.scale(
                  64,
                  density: _visualDensityService.density,
                ),
              ),
              AppSpacings.spacingMdVertical,
              const Text(
                'No pages configured',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                ),
              ),
              AppSpacings.spacingSmVertical,
              const Text(
                'Please configure your dashboard in Admin.',
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPageIndicator(BuildContext context, DeckService deckService) {
    final items = deckService.items;

    return Positioned(
      bottom: _screenService.scale(
        4,
        density: _visualDensityService.density,
      ),
      left: 0,
      right: 0,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: List.generate(
          items.length,
          (index) => _buildDot(context, index, items[index]),
        ),
      ),
    );
  }

  Widget _buildDot(BuildContext context, int index, DeckItem item) {
    final isActive = _currentIndex == index;
    final isSystemView = item is SystemViewItem;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      margin: EdgeInsets.symmetric(
        horizontal: _screenService.scale(
          4,
          density: _visualDensityService.density,
        ),
      ),
      height: _screenService.scale(
        6,
        density: _visualDensityService.density,
      ),
      width: isActive
          ? _screenService.scale(
              16,
              density: _visualDensityService.density,
            )
          : _screenService.scale(
              6,
              density: _visualDensityService.density,
            ),
      decoration: BoxDecoration(
        color: isActive
            ? (Theme.of(context).brightness == Brightness.light
                ? AppTextColorLight.primary
                : AppTextColorDark.primary)
            : (isSystemView
                ? (Theme.of(context).brightness == Brightness.light
                    ? Theme.of(context).colorScheme.primary.withValues(alpha: 0.4)
                    : Theme.of(context).colorScheme.primary.withValues(alpha: 0.4))
                : (Theme.of(context).brightness == Brightness.light
                    ? AppTextColorLight.disabled
                    : AppTextColorDark.disabled)),
        borderRadius: BorderRadius.circular(
          _screenService.scale(
            4,
            density: _visualDensityService.density,
          ),
        ),
      ),
    );
  }

  bool _shouldShowPageIndicator(DeckItem item) {
    // Hide indicator for device detail pages
    if (item is DashboardPageItem && item.pageView is DeviceDetailPageView) {
      return false;
    }
    return true;
  }
}
