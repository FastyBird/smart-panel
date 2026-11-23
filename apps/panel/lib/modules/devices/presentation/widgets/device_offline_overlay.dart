import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/base_card.dart';
import 'package:fastybird_smart_panel/core/widgets/offline_note.dart';
import 'package:flutter/material.dart';

/// The offline treatment of a device detail (docs/display-ui-design-spec.md
/// §7): the controls underneath are dimmed and do not react, and the
/// [OfflineNote] ("Offline · last seen 21:10. Controls are paused until the
/// device is back") sits at the top, in the page padding.
///
/// Use it as the last child of a [Stack] over the detail's content:
/// ```dart
/// Stack(
///   children: [
///     DevicePortraitLayout(...),
///     if (!device.isOnline)
///       DeviceOfflineState(isDark: isDark, lastSeenText: lastSeenText),
///   ],
/// )
/// ```
class DeviceOfflineState extends StatelessWidget {
  /// Kept for existing callers; the colours follow the theme.
  final bool isDark;

  /// When the device was last heard from, already formatted ("5 min ago").
  final String? lastSeenText;

  /// The class to render at; defaults to the screen's.
  final ScreenSizeClass? sizeClass;

  const DeviceOfflineState({
    super.key,
    required this.isDark,
    this.lastSeenText,
    this.sizeClass,
  });

  /// How much of the page surface covers the paused controls.
  static const double backdropOpacity = 0.6;

  @override
  Widget build(BuildContext context) {
    final resolvedClass = sizeClass ?? locator<ScreenService>().sizeClass;
    final padding = AppSpacings.scale(BaseCard.paddingFor(resolvedClass));

    return Stack(
      children: [
        // Absorbs taps so the paused controls do not react.
        Positioned.fill(
          child: AbsorbPointer(
            child: ColoredBox(
              color: Theme.of(
                context,
              ).neutrals.surfacePage.withValues(alpha: backdropOpacity),
            ),
          ),
        ),
        Positioned(
          top: padding,
          left: padding,
          right: padding,
          child: OfflineNote(
            lastSeenText: lastSeenText,
            sizeClass: resolvedClass,
          ),
        ),
      ],
    );
  }
}
