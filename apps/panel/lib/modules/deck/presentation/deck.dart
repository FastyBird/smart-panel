import 'dart:async';

import 'package:event_bus/event_bus.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/modules/dashboard/export.dart';
import 'package:fastybird_smart_panel/modules/deck/export.dart';
import 'package:fastybird_smart_panel/modules/security/services/security_overlay_controller.dart';
import 'package:fastybird_smart_panel/modules/deck/types/swipe_event.dart';
import 'package:fastybird_smart_panel/plugins/pages-device-detail/views/view.dart';
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

class _DeckDashboardScreenState extends State<DeckDashboardScreen>
    with SingleTickerProviderStateMixin {
  final DashboardService _dashboardService = locator<DashboardService>();
  final EventBus _eventBus = locator<EventBus>();

  PageController? _pageController;
  int _currentIndex = 0;
  bool _initialized = false;
  bool _swipeBlocked = false;
  bool _isCrossfading = false;

  late final AnimationController _fadeController;

  StreamSubscription<NavigateToDeckItemEvent>? _deckNavigateSubscription;
  StreamSubscription<PageSwipeBlockEvent>? _swipeBlockSubscription;

  @override
  void initState() {
    super.initState();
    _fadeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 150),
      value: 1.0,
    );
    // Listen for deck navigation events
    _deckNavigateSubscription =
        _eventBus.on<NavigateToDeckItemEvent>().listen(_onNavigateToDeckItem);
    // Listen for swipe block events (from interactive widgets like dials)
    _swipeBlockSubscription =
        _eventBus.on<PageSwipeBlockEvent>().listen(_onSwipeBlockEvent);
  }

  void _onSwipeBlockEvent(PageSwipeBlockEvent event) {
    if (!mounted) return;
    setState(() {
      _swipeBlocked = event.blocked;
    });
  }

  @override
  void dispose() {
    _deckNavigateSubscription?.cancel();
    _swipeBlockSubscription?.cancel();
    _fadeController.dispose();
    _pageController?.dispose();
    super.dispose();
  }

  void _onNavigateToDeckItem(NavigateToDeckItemEvent event) {
    if (!mounted) return;

    final deckService = context.read<DeckService>();
    final index = deckService.indexOfItem(event.itemId);

    if (index >= 0 && _pageController?.hasClients == true) {
      _navigateToIndex(index);
    }
  }

  void _updateTrackedItem(DeckService deckService, int index) {
    final items = deckService.items;
    if (index >= 0 && index < items.length) {
      final item = items[index];
      _dashboardService.setCurrentPageId(item.id);
    }
  }

  /// Navigates to [index] using crossfade for distant jumps (> 1 page)
  /// and slide animation for adjacent pages.
  void _navigateToIndex(int index) {
    if (_pageController?.hasClients != true || _isCrossfading) return;

    final distance = (index - _currentIndex).abs();

    if (distance <= 1) {
      // Adjacent page: use normal slide animation
      _pageController?.animateToPage(
        index,
        duration: const Duration(milliseconds: DeckConstants.pageAnimationMs),
        curve: Curves.easeInOut,
      );
    } else {
      // Distant jump: crossfade (fade out → jump → fade in)
      _crossfadeToPage(index);
    }
  }

  Future<void> _crossfadeToPage(int index) async {
    if (_isCrossfading) return;
    _isCrossfading = true;

    // Fade out
    await _fadeController.reverse();

    if (!mounted) {
      _isCrossfading = false;
      return;
    }

    // Jump instantly (no intermediate onPageChanged events)
    _pageController?.jumpToPage(index);

    // Fade in
    await _fadeController.forward();

    _isCrossfading = false;
  }

  void _fireDeckPageActivatedEvent(DeckService deckService, int index) {
    final items = deckService.items;
    if (index >= 0 && index < items.length) {
      final item = items[index];

      // Clear mode notifier before firing event if the active item is not a
      // domain view. This ensures the UI updates synchronously while domain
      // views handle their own registration via the event.
      if (item is! DomainViewItem) {
        try {
          locator<BottomNavModeNotifier>().clear();
        } catch (_) {}
      }

      // Update security overlay: suppress when viewing the security page
      try {
        locator<SecurityOverlayController>()
            .setOnSecurityScreen(item is SecurityViewItem);
      } catch (_) {}

      _eventBus.fire(DeckPageActivatedEvent(itemId: item.id, item: item));
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
          // Fire initial page activation event after first frame
          WidgetsBinding.instance.addPostFrameCallback((_) {
            _fireDeckPageActivatedEvent(deckService, startIndex);
          });
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
          body: OrientationBuilder(
            builder: (context, orientation) {
              final isPortrait = orientation == Orientation.portrait;

              final pageView = FadeTransition(
                opacity: _fadeController,
                child: PageView.builder(
                  controller: _pageController,
                  physics: _swipeBlocked || _isCrossfading
                      ? const NeverScrollableScrollPhysics()
                      : null,
                  onPageChanged: (index) {
                    setState(() {
                      _currentIndex = index;
                    });
                    _updateTrackedItem(deckService, index);
                    // Delay event firing to after the frame is rendered,
                    // so domain view listeners are fully ready to receive it
                    WidgetsBinding.instance.addPostFrameCallback((_) {
                      if (mounted) {
                        _fireDeckPageActivatedEvent(deckService, index);
                      }
                    });
                  },
                  itemCount: widgets.length,
                  itemBuilder: (context, index) => widgets[index % widgets.length],
                ),
              );

              if (isPortrait) {
                // Portrait: Column with PageView + Bottom Nav Bar
                return Column(
                  children: [
                    Expanded(child: pageView),
                    DeckBottomNavBar(
                      currentIndex: _currentIndex,
                      onNavigateToIndex: _navigateToIndex,
                      onMoreTapped: () => showMoreSheet(
                        context,
                        currentIndex: _currentIndex,
                        onNavigateToIndex: _navigateToIndex,
                      ),
                      onModeTapped: () {
                        final notifier = context.read<BottomNavModeNotifier>();
                        if (notifier.hasConfig) {
                          showModePopup(context, notifier.config!);
                        }
                      },
                    ),
                  ],
                );
              } else {
                // Landscape: Page dots overlay (existing behavior)
                return Stack(
                  children: [
                    pageView,
                    if (_shouldShowPageIndicator(currentItem))
                      _buildPageIndicator(context, deckService),
                  ],
                );
              }
            },
          ),
        );
      },
    );
  }

  Widget _buildEmptyState(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final warningColor = isDark ? AppColorsDark.warning : AppColorsLight.warning;
    final warningBgColor =
        isDark ? AppColorsDark.warningLight9 : AppColorsLight.warningLight9;

    return Scaffold(
      body: Center(
        child: Padding(
          padding: AppSpacings.paddingXl,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            spacing: AppSpacings.pMd,
            children: [
              Container(
                width: AppSpacings.scale(80),
                height: AppSpacings.scale(80),
                decoration: BoxDecoration(
                  color: warningBgColor,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  MdiIcons.alertCircleOutline,
                  size: AppSpacings.scale(48),
                  color: warningColor,
                ),
              ),
              Text(
                'No pages configured',
                style: TextStyle(
                  fontSize: AppFontSize.large,
                  fontWeight: FontWeight.w600,
                  color:
                      isDark ? AppTextColorDark.primary : AppTextColorLight.primary,
                ),
                textAlign: TextAlign.center,
              ),
              Text(
                'Please configure your dashboard in Admin.',
                style: TextStyle(
                  fontSize: AppFontSize.base,
                  color: isDark
                      ? AppTextColorDark.secondary
                      : AppTextColorLight.secondary,
                ),
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
      bottom: AppSpacings.scale(4),
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
      duration: const Duration(milliseconds: DeckConstants.dotAnimationMs),
      margin: EdgeInsets.symmetric(
        horizontal: AppSpacings.scale(4),
      ),
      height: AppSpacings.scale(6),
      width: isActive
          ? AppSpacings.scale(16)
          : AppSpacings.scale(6),
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
          AppSpacings.scale(4),
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
