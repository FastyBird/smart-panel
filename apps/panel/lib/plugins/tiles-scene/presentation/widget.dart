import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/plugins/tiles-scene/views/view.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class SceneTileWidget extends StatelessWidget {
  final SceneTileView _tile;

  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  SceneTileWidget(this._tile, {super.key});

  @override
  Widget build(BuildContext context) {
    final iconSize = _screenService.scale(
      32,
      density: _visualDensityService.density,
    );

    return Card(
      elevation: _tile.isOn ? 4 : 1,
      color: _tile.isOn
          ? (Theme.of(context).brightness == Brightness.light
              ? AppColorsLight.primaryLight8
              : AppColorsDark.primaryLight8)
          : null,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        side: BorderSide(
          color: _tile.isOn
              ? (Theme.of(context).brightness == Brightness.light
                  ? AppColorsLight.primary
                  : AppColorsDark.primary)
              : (Theme.of(context).brightness == Brightness.light
                  ? AppBorderColorLight.base
                  : AppBorderColorDark.base),
          width: _tile.isOn ? 2 : 1,
        ),
      ),
      child: Padding(
        padding: AppSpacings.paddingSm,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              _tile.icon ?? MdiIcons.movieOpen,
              size: iconSize,
              color: _tile.isOn
                  ? (Theme.of(context).brightness == Brightness.light
                      ? AppColorsLight.primary
                      : AppColorsDark.primary)
                  : (Theme.of(context).brightness == Brightness.light
                      ? AppTextColorLight.regular
                      : AppTextColorDark.regular),
            ),
            AppSpacings.spacingSmVertical,
            Text(
              _tile.label,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    fontWeight: _tile.isOn ? FontWeight.bold : FontWeight.normal,
                  ),
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            AppSpacings.spacingXsVertical,
            Text(
              _tile.status,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).hintColor,
                  ),
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}
