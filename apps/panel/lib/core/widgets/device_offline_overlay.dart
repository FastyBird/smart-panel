import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/material.dart';

/// Full overlay that blocks interaction with device controls when offline.
///
/// Covers the main content area with a semi-transparent background
/// and displays a centered message with an optional retry button.
///
/// Example usage:
/// ```dart
/// Stack(
///   children: [
///     // Main content
///     DeviceDetailPortraitLayout(...),
///     // Offline overlay
///     if (!device.isOnline)
///       DeviceOfflineOverlay(
///         isDark: isDark,
///         onRetry: () => _refreshDevice(),
///       ),
///   ],
/// )
/// ```
class DeviceOfflineOverlay extends StatelessWidget {
  final bool isDark;
  final String? lastSeenText;
  final VoidCallback? onRetry;

  const DeviceOfflineOverlay({
    super.key,
    required this.isDark,
    this.lastSeenText,
    this.onRetry,
  });

  // Offline status color
  static const Color _offlineColor = Color(0xFF78909C);
  static const Color _offlineColorLight = Color(0x2678909C);

  Color _background() =>
      isDark ? AppBgColorDark.base : AppBgColorLight.page;

  Color _card() =>
      isDark ? AppBgColorDark.overlay : AppBgColorLight.overlay;

  Color _border() =>
      isDark ? AppBorderColorDark.base : AppBorderColorLight.base;

  Color _textPrimary() =>
      isDark ? AppTextColorDark.primary : AppTextColorLight.primary;

  Color _textMuted() =>
      isDark ? AppTextColorDark.disabled : AppTextColorLight.disabled;

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    return Container(
      color: _background().withValues(alpha: 0.95),
      child: Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 40),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Icon
              Container(
                width: 80,
                height: 80,
                decoration: const BoxDecoration(
                  color: _offlineColorLight,
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.wifi_off,
                  color: _offlineColor,
                  size: 40,
                ),
              ),
              const SizedBox(height: 20),
              // Title
              Text(
                localizations.device_offline_title,
                style: TextStyle(
                  color: _textPrimary(),
                  fontSize: 20,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 8),
              // Message
              Text(
                localizations.device_offline_description,
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: _textMuted(),
                  fontSize: 14,
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 24),
              // Retry button
              if (onRetry != null)
                GestureDetector(
                  onTap: onRetry,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 28,
                      vertical: 14,
                    ),
                    decoration: BoxDecoration(
                      color: _card(),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: _border()),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.refresh,
                          color: _textPrimary(),
                          size: 18,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          localizations.device_offline_retry,
                          style: TextStyle(
                            color: _textPrimary(),
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              // Last seen
              if (lastSeenText != null) ...[
                const SizedBox(height: 16),
                Text(
                  localizations.device_offline_last_seen(lastSeenText!),
                  style: TextStyle(
                    color: _textMuted(),
                    fontSize: 12,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
