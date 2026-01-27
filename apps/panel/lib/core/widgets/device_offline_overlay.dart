import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/material.dart';

// Offline status colors
const Color _offlineColor = Color(0xFF78909C);

/// Combined widget that shows both the backdrop and banner for offline devices.
///
/// Use this as a single widget in a Stack to show the offline state.
///
/// Example usage:
/// ```dart
/// Stack(
///   children: [
///     // Main content
///     DeviceDetailPortraitLayout(...),
///     // Offline state
///     if (!device.isOnline)
///       DeviceOfflineState(
///         isDark: isDark,
///         lastSeenText: lastSeenText,
///       ),
///   ],
/// )
/// ```
class DeviceOfflineState extends StatelessWidget {
  final bool isDark;
  final String? lastSeenText;

  const DeviceOfflineState({
    super.key,
    required this.isDark,
    this.lastSeenText,
  });

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        _DeviceOfflineBackdrop(isDark: isDark),
        Positioned(
          top: 0,
          left: 0,
          right: 0,
          child: _DeviceOfflineBanner(
            isDark: isDark,
            lastSeenText: lastSeenText,
          ),
        ),
      ],
    );
  }
}

/// Semi-transparent backdrop that covers the content area when device is offline.
class _DeviceOfflineBackdrop extends StatelessWidget {
  final bool isDark;

  const _DeviceOfflineBackdrop({
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      color: isDark
          ? AppBgColorDark.pageOverlay50
          : AppBgColorLight.pageOverlay50,
    );
  }
}

/// Banner shown at the top of device detail content when device is offline.
class _DeviceOfflineBanner extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();

  final bool isDark;
  final String? lastSeenText;

  _DeviceOfflineBanner({
    required this.isDark,
    this.lastSeenText,
  });

  double _scale(double size) => _screenService.scale(size);

  Color _textMuted() =>
      isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;

  Color _cardBg() =>
      isDark ? AppColorsDark.infoLight9 : AppColorsLight.infoLight9;

  Color _borderColor() =>
      isDark ? AppColorsDark.infoLight7 : AppColorsLight.infoLight7;

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    return Container(
      margin: EdgeInsets.all(_scale(AppSpacings.pLg)),
      padding: EdgeInsets.all(_scale(16)),
      decoration: BoxDecoration(
        color: _cardBg(),
        borderRadius: BorderRadius.circular(_scale(16)),
        border: Border.all(
          color: _borderColor(),
          width: 1,
        ),
      ),
      child: Row(
        children: [
          // Icon
          Container(
            width: _scale(40),
            height: _scale(40),
            decoration: BoxDecoration(
              color: _offlineColor.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(_scale(10)),
            ),
            child: Icon(
              Icons.wifi_off,
              color: _offlineColor,
              size: _scale(22),
            ),
          ),
          SizedBox(width: _scale(12)),
          // Content
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    Text(
                      localizations.device_offline_title,
                      style: TextStyle(
                        color: _offlineColor,
                        fontSize: _scale(14),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    if (lastSeenText != null) ...[
                      const Spacer(),
                      Text(
                        lastSeenText!,
                        style: TextStyle(
                          color: _textMuted(),
                          fontSize: _scale(12),
                        ),
                      ),
                    ],
                  ],
                ),
                SizedBox(height: _scale(2)),
                Text(
                  localizations.device_offline_description,
                  style: TextStyle(
                    color: _textMuted(),
                    fontSize: _scale(12),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
