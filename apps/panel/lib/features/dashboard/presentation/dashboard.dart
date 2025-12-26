import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/features/dashboard/mappers/page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/export.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/pages/device_detail.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/pages/view.dart';
import 'package:fastybird_smart_panel/modules/displays/repositories/display.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:provider/provider.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();
  final DisplayRepository _displayRepository = locator<DisplayRepository>();
  final DashboardService _dashboardService = locator<DashboardService>();

  PageController? _pageController;
  int _currentPage = 0;
  bool _initialized = false;

  /// Gets the initial page index based on tracked current page or resolved home page.
  /// For space-aware idle mode, this prioritizes:
  /// 1. The page the user was viewing before idle (tracked in DashboardService)
  /// 2. Falls back to the resolved home page from display settings
  int _getInitialPageIndex(Map<String, DashboardPageView> pages) {
    if (pages.isEmpty) {
      return 0;
    }

    final pageIds = pages.keys.toList();

    // First, check if there's a tracked current page from before idle
    final trackedPageId = _dashboardService.currentPageId;
    if (trackedPageId != null) {
      final trackedIndex = pageIds.indexOf(trackedPageId);
      if (trackedIndex >= 0) {
        return trackedIndex;
      }
    }

    // Fall back to resolved home page from display settings
    final resolvedHomePageId = _displayRepository.resolvedHomePageId;
    if (resolvedHomePageId != null) {
      final index = pageIds.indexOf(resolvedHomePageId);
      if (index >= 0) {
        return index;
      }
    }

    return 0;
  }

  /// Updates the tracked page ID in DashboardService for space-aware idle mode
  void _updateTrackedPage(Map<String, DashboardPageView> pages, int pageIndex) {
    if (pages.isEmpty) return;

    final pageIds = pages.keys.toList();
    if (pageIndex >= 0 && pageIndex < pageIds.length) {
      _dashboardService.setCurrentPageId(pageIds[pageIndex]);
    }
  }

  @override
  void dispose() {
    _pageController?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<DashboardService>(builder: (
      context,
      dashboardService,
      _,
    ) {
      if (dashboardService.pages.isEmpty) {
        return Scaffold(
          body: Center(
            child: Padding(
              padding: AppSpacings.paddingMd,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    MdiIcons.alert,
                    color: Theme.of(context).warning,
                    size: _screenService.scale(
                      64,
                      density: _visualDensityService.density,
                    ),
                  ),
                  AppSpacings.spacingMdVertical,
                  const Text(
                    'No pages configured!?',
                    textAlign: TextAlign.center,
                  ),
                  AppSpacings.spacingSmVertical,
                  const Text(
                    'Please configure at least one page for your dashboard.',
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ),
        );
      }

      // Initialize PageController with tracked page or resolved home page on first build
      if (!_initialized) {
        final initialPage = _getInitialPageIndex(dashboardService.pages);
        _pageController = PageController(initialPage: initialPage);
        _currentPage = initialPage;
        _initialized = true;
        // Track the initial page for space-aware idle mode
        _updateTrackedPage(dashboardService.pages, initialPage);
      }

      List<Widget> pages = dashboardService.pages.entries
          .map((entry) => buildPageWidget(entry.value))
          .toList();

      // Clamp _currentPage to valid range in case pages were removed
      final maxPageIndex = dashboardService.pages.length - 1;
      if (_currentPage > maxPageIndex) {
        _currentPage = maxPageIndex.clamp(0, maxPageIndex);
        // Update the tracked page for space-aware idle mode
        _updateTrackedPage(dashboardService.pages, _currentPage);
        // Update the PageController to match the clamped page
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (_pageController?.hasClients == true) {
            _pageController?.jumpToPage(_currentPage);
          }
        });
      }

      final DashboardPageView currentView =
          dashboardService.pages.entries.toList()[_currentPage].value;

      return Scaffold(
        body: Stack(
          children: [
            Padding(
              padding: EdgeInsets.only(bottom: 0),
              child: PageView.builder(
                controller: _pageController,
                onPageChanged: (index) {
                  setState(() {
                    _currentPage = index;
                  });
                  // Track the current page for space-aware idle mode
                  _updateTrackedPage(dashboardService.pages, index);
                },
                itemCount: pages.length,
                itemBuilder: (context, index) {
                  final int pageIndex = index % pages.length;

                  return pages[pageIndex];
                },
              ),
            ),
            if (_shouldShowPageIndicator(currentView))
              // Dots Indicator
              Positioned(
                bottom: _screenService.scale(
                  4,
                  density: _visualDensityService.density,
                ),
                left: 0,
                right: 0,
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: List.generate(
                    pages.length,
                    (index) => AnimatedContainer(
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
                      width: _currentPage == index % pages.length
                          ? _screenService.scale(
                              16,
                              density: _visualDensityService.density,
                            )
                          : _screenService.scale(
                              6,
                              density: _visualDensityService.density,
                            ),
                      decoration: BoxDecoration(
                        color: _currentPage == index
                            ? Theme.of(context).brightness == Brightness.light
                                ? AppTextColorLight.primary
                                : AppTextColorDark.primary
                            : Theme.of(context).brightness == Brightness.light
                                ? AppTextColorLight.disabled
                                : AppTextColorDark.disabled,
                        borderRadius: BorderRadius.circular(
                          _screenService.scale(
                            4,
                            density: _visualDensityService.density,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      );
    });
  }

  bool _shouldShowPageIndicator(DashboardPageView view) {
    return view is! DeviceDetailPageView;
  }
}
