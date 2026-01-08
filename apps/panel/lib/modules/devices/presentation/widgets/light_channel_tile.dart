import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/button_tile.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/light.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// A tile representing a single light channel in a multi-channel device.
///
/// Uses the same ButtonTileBox pattern as role tiles in the domain view:
/// - Icon tap toggles the channel ON/OFF
/// - Tile tap (outside icon) opens channel detail
///
/// Uses horizontal Row layout (same as "other" tiles in domain view).
class LightChannelTile extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  /// The light channel to display
  final LightChannelView channel;

  /// Display name for the channel
  final String name;

  /// Whether this is the current/active channel (for visual highlighting)
  final bool isActive;

  /// Whether the device is online
  final bool isOnline;

  /// Whether the channel is currently being toggled
  final bool isToggling;

  /// Whether to show the brightness percentage
  final bool showBrightness;

  /// Callback when the icon is tapped (toggle ON/OFF)
  final VoidCallback? onIconTap;

  /// Callback when the tile is tapped (open detail)
  final VoidCallback? onTileTap;

  /// Optional: override the displayed on state (for optimistic UI)
  final bool? overrideIsOn;

  LightChannelTile({
    super.key,
    required this.channel,
    required this.name,
    this.isActive = false,
    this.isOnline = true,
    this.isToggling = false,
    this.showBrightness = true,
    this.onIconTap,
    this.onTileTap,
    this.overrideIsOn,
  });

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    final isOn = overrideIsOn ?? channel.on;
    final hasBrightness = channel.hasBrightness;
    final brightness = hasBrightness ? channel.brightness : null;

    return ButtonTileBox(
      onTap: isToggling ? null : onTileTap,
      isOn: isOn,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Icon with optional offline badge
          Stack(
            clipBehavior: Clip.none,
            children: [
              ButtonTileIcon(
                icon: isOn ? MdiIcons.lightbulbOn : MdiIcons.lightbulbOutline,
                onTap: isToggling ? null : onIconTap,
                isOn: isOn,
                isLoading: isToggling,
              ),
              // Offline indicator badge
              if (!isOnline)
                Positioned(
                  right: -_screenService.scale(
                    2,
                    density: _visualDensityService.density,
                  ),
                  bottom: -_screenService.scale(
                    2,
                    density: _visualDensityService.density,
                  ),
                  child: Container(
                    padding: EdgeInsets.all(
                      _screenService.scale(
                        2,
                        density: _visualDensityService.density,
                      ),
                    ),
                    decoration: BoxDecoration(
                      color: Theme.of(context).scaffoldBackgroundColor,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      MdiIcons.alert,
                      size: AppFontSize.extraSmall,
                      color: Theme.of(context).brightness == Brightness.light
                          ? AppColorsLight.warning
                          : AppColorsDark.warning,
                    ),
                  ),
                ),
            ],
          ),
          AppSpacings.spacingMdHorizontal,
          // Channel info
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ButtonTileTitle(
                  title: name,
                  isOn: isOn,
                ),
                AppSpacings.spacingXsVertical,
                ButtonTileSubTitle(
                  subTitle: _buildSubtitle(
                    context,
                    localizations,
                    isOn,
                    hasBrightness,
                    brightness,
                  ),
                  isOn: isOn,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSubtitle(
    BuildContext context,
    AppLocalizations localizations,
    bool isOn,
    bool hasBrightness,
    int? brightness,
  ) {
    final stateText =
        isOn ? localizations.light_state_on : localizations.light_state_off;
    final showBrightnessValue =
        showBrightness && hasBrightness && isOn && brightness != null;

    return Row(
      children: [
        Text(stateText),
        if (showBrightnessValue) ...[
          AppSpacings.spacingSmHorizontal,
          Icon(
            MdiIcons.weatherSunny,
            size: AppFontSize.extraSmall,
          ),
          SizedBox(
            width: _screenService.scale(
              2,
              density: _visualDensityService.density,
            ),
          ),
          Text('$brightness%'),
        ],
      ],
    );
  }
}
