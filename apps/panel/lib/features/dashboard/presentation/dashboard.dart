import 'dart:async';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen_scaler.dart';
import 'package:fastybird_smart_panel/core/state/interaction_manager.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/features/dashboard/mappers/page.dart';
import 'package:fastybird_smart_panel/features/dashboard/repositories/ui/pages.dart';
import 'package:fastybird_smart_panel/features/screen_saver/presentation/screen_saver.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final ScreenScalerService scaler = locator<ScreenScalerService>();
  final PageController _pageController = PageController(initialPage: 0);

  Timer? _inactivityTimer;

  Offset? _swipeStartPosition;
  bool _isSwipingVertically = false;

  int _currentPage = 0;

  @override
  void initState() {
    super.initState();

    _resetInactivityTimer();
  }

  @override
  void dispose() {
    _inactivityTimer?.cancel();

    super.dispose();
  }

  void _resetInactivityTimer() {
    _inactivityTimer?.cancel();

    _inactivityTimer = Timer(const Duration(minutes: 5), () {
      // After configured time of inactivity, navigate to the screen saver
      Navigator.of(context)
          .push(
        MaterialPageRoute(
          builder: (context) => ScreenSaverScreen(),
        ),
      )
          .then((_) {
        // Reset inactivity timer or perform necessary actions
        _resetInactivityTimer();
      });
    });
  }

  void _onUserInteraction() {
    _resetInactivityTimer();
  }

  @override
  Widget build(BuildContext context) {
    final interactionManager = Provider.of<InteractionManager>(context);

    return Consumer<PagesRepository>(builder: (
      context,
      pagesRepository,
      _,
    ) {
      if (pagesRepository.isLoading) {
        return Scaffold(
          body: Center(
            child: SizedBox(
              width: scaler.scale(50),
              height: scaler.scale(50),
              child: const CircularProgressIndicator(),
            ),
          ),
        );
      }

      if (pagesRepository.getAll().isEmpty) {
        return Scaffold(
          body: Center(
            child: Padding(
              padding: AppSpacings.paddingMd,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.warning,
                    color: Theme.of(context).warning,
                    size: scaler.scale(64),
                  ),
                  AppSpacings.spacingMdVertical,
                  const Text(
                    'No pages configured!',
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

      List<Widget> pages = pagesRepository
          .getAll()
          .map((model) => buildPageWidget(model))
          .toList();

      return GestureDetector(
        behavior: HitTestBehavior.deferToChild,
        onTap: () => _onUserInteraction(),
        onPanDown: (DragDownDetails details) => _onUserInteraction(),
        onPanStart: (details) {
          _swipeStartPosition = details.globalPosition;
        },
        onPanUpdate: (details) {
          if (_swipeStartPosition == null) return;

          final delta = details.globalPosition - _swipeStartPosition!;
          // Check if the swipe is vertical enough
          if (!_isSwipingVertically && delta.dy.abs() > delta.dx.abs()) {
            _isSwipingVertically = true;
          }

          // Once confirmed vertical, decide swipe direction
          if (_isSwipingVertically) {
            if (delta.dy > 20) {
              // Swipe down detected
              Navigator.pushNamed(context, '/settings');
            } else if (delta.dy < -20) {
              // Swipe up detected
            }
          }
        },
        onPanEnd: (_) {
          _swipeStartPosition = null;
          _isSwipingVertically = false;
        },
        child: Scaffold(
          body: Stack(
            children: [
              Padding(
                padding: EdgeInsets.only(bottom: 0),
                child: PageView.builder(
                  controller: _pageController,
                  physics: interactionManager.isInteracting
                      ? const NeverScrollableScrollPhysics()
                      : const BouncingScrollPhysics(),
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

              // Dots Indicator
              Positioned(
                bottom: scaler.scale(4.0),
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
                        horizontal: scaler.scale(4.0),
                      ),
                      height: scaler.scale(6.0),
                      width: _currentPage == index % pages.length
                          ? scaler.scale(16.0)
                          : scaler.scale(6.0),
                      decoration: BoxDecoration(
                        color: _currentPage == index
                            ? Theme.of(context).brightness == Brightness.light
                                ? AppTextColorLight.primary
                                : AppTextColorDark.primary
                            : Theme.of(context).brightness == Brightness.light
                                ? AppTextColorLight.disabled
                                : AppTextColorDark.disabled,
                        borderRadius: BorderRadius.circular(scaler.scale(4.0)),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    });
  }
}
