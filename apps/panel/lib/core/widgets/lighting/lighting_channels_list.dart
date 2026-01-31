import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/horizontal_scroll_with_gradient.dart';
import 'package:fastybird_smart_panel/core/widgets/lighting/lighting_types.dart';
import 'package:fastybird_smart_panel/core/widgets/tile_wrappers.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Lighting channels list widget.
///
/// Displays a list of light channels with their status and selection state.
/// Supports both portrait (horizontal scroll) and landscape (grid/list) layouts.
class LightingChannelsList extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  /// List of channels to display
  final List<LightingChannelData> channels;

  /// Current state (synced, mixed, unsynced)
  final LightingState state;

  /// Whether to use landscape layout
  final bool isLandscape;

  /// Called when channel icon is tapped (toggle power)
  final ValueChanged<LightingChannelData>? onChannelIconTap;

  /// Called when channel tile is tapped (select channel)
  final ValueChanged<LightingChannelData>? onChannelTileTap;

  /// Called when sync button is pressed
  final VoidCallback? onSyncAll;

  LightingChannelsList({
    super.key,
    required this.channels,
    this.state = LightingState.synced,
    this.isLandscape = false,
    this.onChannelIconTap,
    this.onChannelTileTap,
    this.onSyncAll,
  });

  double _scale(double s) =>
      _screenService.scale(s, density: _visualDensityService.density);

  Color? _getStateColor(bool isDark) {
    switch (state) {
      case LightingState.synced:
        return null;
      case LightingState.mixed:
        return isDark ? AppColorsDark.info : AppColorsLight.info;
      case LightingState.unsynced:
        return isDark ? AppColorsDark.warning : AppColorsLight.warning;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (channels.isEmpty) return const SizedBox.shrink();

    final isDark = Theme.of(context).brightness == Brightness.dark;

    return isLandscape
        ? _buildLandscapeChannelsList(context, isDark)
        : _buildPortraitChannelsList(context, isDark);
  }

  // ============================================================================
  // LANDSCAPE LAYOUT
  // ============================================================================

  Widget _buildLandscapeChannelsList(BuildContext context, bool isDark) {
    final localizations = AppLocalizations.of(context)!;
    final primaryColor =
        isDark ? AppColorsDark.primary : AppColorsLight.primary;
    final isLargeScreen = _screenService.isLargeScreen;
    final stateColor = _getStateColor(isDark);

    // Determine icon based on state
    IconData sectionIcon = MdiIcons.lightbulbGroup;
    if (state == LightingState.mixed) {
      sectionIcon = MdiIcons.tune;
    } else if (state == LightingState.unsynced) {
      sectionIcon = MdiIcons.alert;
    }

    // Large screens: 2 vertical tiles per row (square)
    // Small/medium: 1 horizontal tile per row with fixed height
    if (isLargeScreen) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          _buildSectionHeader(isDark, sectionIcon, stateColor, localizations),
          AppSpacings.spacingSmVertical,
          GridView.count(
            crossAxisCount: 2,
            mainAxisSpacing: AppSpacings.pMd,
            crossAxisSpacing: AppSpacings.pMd,
            childAspectRatio: AppTileAspectRatio.square,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            children: channels.map((channel) {
              return VerticalTileLarge(
                icon: MdiIcons.lightbulbOutline,
                activeIcon: MdiIcons.lightbulb,
                name: channel.name,
                status: channel.getStatusText(localizations),
                isActive: channel.isOn && channel.isOnline,
                isOffline: !channel.isOnline,
                isSelected: channel.isSelected,
                activeColor: primaryColor,
                onTileTap: () => onChannelTileTap?.call(channel),
                onIconTap: channel.isOnline
                    ? () => onChannelIconTap?.call(channel)
                    : null,
                showSelectionIndicator: true,
                showWarningBadge: true,
              );
            }).toList(),
          ),
        ],
      );
    }

    // Small/medium: Column of fixed-height horizontal tiles
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        _buildSectionHeader(isDark, sectionIcon, stateColor, localizations),
        AppSpacings.spacingSmVertical,
        ...channels.asMap().entries.map((entry) {
          final index = entry.key;
          final channel = entry.value;
          final isLast = index == channels.length - 1;

          return Padding(
            padding: EdgeInsets.only(bottom: isLast ? 0 : AppSpacings.pMd),
            child: HorizontalTileStretched(
              icon: MdiIcons.lightbulbOutline,
              activeIcon: MdiIcons.lightbulb,
              name: channel.name,
              status: channel.getStatusText(localizations),
              isActive: channel.isOn && channel.isOnline,
              isOffline: !channel.isOnline,
              isSelected: channel.isSelected,
              activeColor: primaryColor,
              onTileTap: () => onChannelTileTap?.call(channel),
              onIconTap: channel.isOnline
                  ? () => onChannelIconTap?.call(channel)
                  : null,
              showSelectionIndicator: true,
              showWarningBadge: true,
            ),
          );
        }),
      ],
    );
  }

  // ============================================================================
  // PORTRAIT LAYOUT
  // ============================================================================

  Widget _buildPortraitChannelsList(BuildContext context, bool isDark) {
    final localizations = AppLocalizations.of(context)!;
    final primaryColor =
        isDark ? AppColorsDark.primary : AppColorsLight.primary;
    final stateColor = _getStateColor(isDark);
    final dividerColor =
        isDark ? AppBorderColorDark.light : AppBorderColorLight.base;

    // Determine icon based on state
    IconData sectionIcon = MdiIcons.lightbulbGroup;
    if (state == LightingState.mixed) {
      sectionIcon = MdiIcons.tune;
    } else if (state == LightingState.unsynced) {
      sectionIcon = MdiIcons.alert;
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: EdgeInsets.only(
            left: AppSpacings.pLg,
            right: AppSpacings.pLg,
            top: AppSpacings.pSm,
            bottom: AppSpacings.pSm,
          ),
          decoration: BoxDecoration(
            border: Border(
              bottom: BorderSide(
                color: dividerColor,
                width: 1,
              ),
            ),
          ),
          child: _buildSectionHeader(isDark, sectionIcon, stateColor, localizations),
        ),
        AppSpacings.spacingMdVertical,
        Padding(
          padding: EdgeInsets.only(
            left: AppSpacings.pLg,
            right: AppSpacings.pLg,
            bottom: AppSpacings.pMd,
          ),
          child: HorizontalScrollWithGradient(
            height: _scale(80),
            layoutPadding: AppSpacings.pLg,
            itemCount: channels.length,
            separatorWidth: AppSpacings.pMd,
            itemBuilder: (context, index) {
              final channel = channels[index];

              return VerticalTileCompact(
                icon: MdiIcons.lightbulbOutline,
                activeIcon: MdiIcons.lightbulb,
                name: channel.name,
                status: channel.getStatusText(localizations),
                isActive: channel.isOn && channel.isOnline,
                isOffline: !channel.isOnline,
                isSelected: channel.isSelected,
                activeColor: primaryColor,
                onTileTap: () => onChannelTileTap?.call(channel),
                onIconTap: channel.isOnline
                    ? () => onChannelIconTap?.call(channel)
                    : null,
                showSelectionIndicator: true,
                showWarningBadge: true,
              );
            },
          ),
        ),
      ],
    );
  }

  // ============================================================================
  // SECTION HEADER
  // ============================================================================

  Widget _buildSectionHeader(
    bool isDark,
    IconData icon,
    Color? stateColor,
    AppLocalizations localizations,
  ) {
    final secondaryColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
    final primaryTextColor =
        isDark ? AppTextColorDark.primary : AppTextColorLight.primary;

    return SizedBox(
      height: _scale(28),
      child: Row(
        children: [
          Icon(
            icon,
            color: stateColor ?? secondaryColor,
            size: _scale(16),
          ),
          SizedBox(width: AppSpacings.pSm),
          Text(
            localizations.domain_lights,
            style: TextStyle(
              color: stateColor ?? primaryTextColor,
              fontSize: AppFontSize.small,
              fontWeight: FontWeight.w600,
            ),
          ),
          SizedBox(width: AppSpacings.pSm),
          Container(
            padding: EdgeInsets.symmetric(
              horizontal: AppSpacings.pSm,
              vertical: _scale(2),
            ),
            decoration: BoxDecoration(
              color: stateColor?.withValues(alpha: 0.2) ??
                  (isDark ? AppFillColorDark.light : AppFillColorLight.light),
              borderRadius: BorderRadius.circular(AppBorderRadius.medium),
            ),
            child: Text(
              '${channels.length}',
              style: TextStyle(
                color: stateColor ?? secondaryColor,
                fontSize: AppFontSize.extraSmall,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          const Spacer(),
          if (state != LightingState.synced)
            GestureDetector(
              onTap: () {
                HapticFeedback.lightImpact();
                onSyncAll?.call();
              },
              child: Container(
                padding: EdgeInsets.symmetric(
                  horizontal: AppSpacings.pMd,
                  vertical: AppSpacings.pSm,
                ),
                decoration: BoxDecoration(
                  color: stateColor,
                  borderRadius: BorderRadius.circular(AppBorderRadius.medium),
                ),
                child: Text(
                  state == LightingState.mixed
                      ? localizations.button_sync_all
                      : localizations.button_retry,
                  style: TextStyle(
                    color: AppColors.white,
                    fontSize: AppFontSize.extraSmall,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
