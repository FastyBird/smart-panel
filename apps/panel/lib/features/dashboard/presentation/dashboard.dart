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

  PageController? _pageController;
  int _currentPage = 0;
  bool _initialized = false;

  /// Gets the initial page index based on the resolved home page ID
  int _getInitialPageIndex(Map<String, DashboardPageView> pages) {
    final resolvedHomePageId = _displayRepository.resolvedHomePageId;

    if (resolvedHomePageId == null || pages.isEmpty) {
      return 0;
    }

    // Find the index of the resolved home page in the pages map
    final pageIds = pages.keys.toList();
    final index = pageIds.indexOf(resolvedHomePageId);

    // If the resolved home page is found, use it; otherwise, default to 0
    return index >= 0 ? index : 0;
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

      // Initialize PageController with resolved home page on first build
      if (!_initialized) {
        final initialPage = _getInitialPageIndex(dashboardService.pages);
        _pageController = PageController(initialPage: initialPage);
        _currentPage = initialPage;
        _initialized = true;
      }

      List<Widget> pages = dashboardService.pages.entries
          .map((entry) => buildPageWidget(entry.value))
          .toList();

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
