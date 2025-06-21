import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

class AppBottomNavigationItem {
  final Widget icon;

  final String label;

  AppBottomNavigationItem({
    required this.icon,
    required this.label,
  });
}

class AppBottomNavigation extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  AppBottomNavigation({
    super.key,
    required this.items,
    required this.currentIndex,
    required this.curve,
    required this.duration,
    required this.onTap,
  });

  final List<AppBottomNavigationItem> items;

  final int currentIndex;

  final Curve curve;

  final Duration duration;

  final Function(int index) onTap;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: items.asMap().entries.map((entry) {
        final item = entry.value;

        return Expanded(
          child: TweenAnimationBuilder<double>(
            tween: Tween(
              end: items.indexOf(item) == currentIndex ? 1.0 : 0.0,
            ),
            curve: curve,
            duration: duration,
            builder: (context, t, _) {
              final selectedColor =
                  Theme.of(context).brightness == Brightness.light
                      ? AppColorsLight.primary
                      : AppColorsDark.primary;

              final unselectedColor =
                  Theme.of(context).brightness == Brightness.light
                      ? AppTextColorLight.regular
                      : AppTextColorDark.regular;

              return Material(
                color: Color.lerp(Colors.transparent, Colors.transparent, t),
                clipBehavior: Clip.antiAlias,
                child: InkWell(
                  onTap: () => onTap.call(items.indexOf(item)),
                  focusColor: selectedColor.withAlpha(25),
                  highlightColor: selectedColor.withAlpha(25),
                  splashColor: selectedColor.withAlpha(25),
                  hoverColor: selectedColor.withAlpha(25),
                  child: Padding(
                    padding: AppSpacings.paddingMd,
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        IconTheme(
                          data: IconThemeData(
                            color: Color.lerp(
                              unselectedColor,
                              selectedColor,
                              t,
                            ),
                            size: _screenService.scale(
                              20,
                              density: _visualDensityService.density,
                            ),
                          ),
                          child: item.icon,
                        ),
                        Text(
                          item.label,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: Color.lerp(
                              unselectedColor,
                              selectedColor,
                              t,
                            ),
                            fontSize: _screenService.scale(
                              10,
                              density: _visualDensityService.density,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        );
      }).toList(),
    );
  }
}

class AppBottomNavigationBar extends StatelessWidget {
  const AppBottomNavigationBar({
    super.key,
    required this.items,
    this.currentIndex = 0,
    this.onTap,
    this.duration = const Duration(milliseconds: 500),
    this.curve = Curves.easeOutQuint,
    this.enableFloatingNavBar = true,
  });

  final List<AppBottomNavigationItem> items;

  final int currentIndex;

  final Function(int)? onTap;

  final Duration duration;

  final Curve curve;

  final bool enableFloatingNavBar;

  @override
  Widget build(BuildContext context) {
    return enableFloatingNavBar
        ? BottomAppBar(
            color: Colors.transparent,
            elevation: 0,
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(AppBorderRadius.round),
                color: Theme.of(context).brightness == Brightness.light
                    ? AppBgColorLight.base
                    : AppBgColorDark.base,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.1),
                    blurRadius: 4,
                    spreadRadius: 1,
                    offset: const Offset(0, 2),
                  )
                ],
              ),
              width: double.infinity,
              child: AppBottomNavigation(
                items: items,
                currentIndex: currentIndex,
                curve: curve,
                duration: duration,
                onTap: onTap!,
              ),
            ),
          )
        : Container(
            decoration: BoxDecoration(
              color: Theme.of(context).brightness == Brightness.light
                  ? AppBgColorLight.base
                  : AppBgColorDark.base,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.1),
                  blurRadius: 4,
                  spreadRadius: 1,
                  offset: const Offset(0, -2),
                ),
              ],
            ),
            child: AppBottomNavigation(
              items: items,
              currentIndex: currentIndex,
              curve: curve,
              duration: duration,
              onTap: onTap!,
            ),
          );
  }
}
