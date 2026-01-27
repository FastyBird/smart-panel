import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/top_bar.dart';
import 'package:fastybird_smart_panel/modules/deck/export.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Domain view page - shows devices of a specific domain in a room.
///
/// This is a placeholder implementation that will be enhanced to show
/// actual device controls for the domain (lights, climate, media, sensors).
class DomainViewPage extends StatefulWidget {
  final DomainViewItem viewItem;

  const DomainViewPage({super.key, required this.viewItem});

  @override
  State<DomainViewPage> createState() => _DomainViewPageState();
}

class _DomainViewPageState extends State<DomainViewPage> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  @override
  Widget build(BuildContext context) {
    final domain = widget.viewItem.domainType;

    return Scaffold(
      appBar: AppTopBar(
        title: widget.viewItem.title,
        icon: domain.icon,
      ),
      body: SafeArea(
        child: Padding(
          padding: AppSpacings.paddingMd,
          child: _buildContent(context),
        ),
      ),
    );
  }

  Widget _buildContent(BuildContext context) {
    final domain = widget.viewItem.domainType;
    final deviceCount = widget.viewItem.deviceCount;

    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            domain.icon,
            size: _screenService.scale(
              80,
              density: _visualDensityService.density,
            ),
            color: Theme.of(context).colorScheme.primary,
          ),
          AppSpacings.spacingLgVertical,
          Text(
            widget.viewItem.title,
            style: TextStyle(
              fontSize: AppFontSize.extraLarge,
              fontWeight: FontWeight.bold,
            ),
          ),
          AppSpacings.spacingSmVertical,
          Text(
            '$deviceCount ${deviceCount == 1 ? 'device' : 'devices'}',
            style: TextStyle(
              fontSize: AppFontSize.base,
              color: Theme.of(context).brightness == Brightness.light
                  ? AppTextColorLight.regular
                  : AppTextColorDark.regular,
            ),
          ),
          AppSpacings.spacingLgVertical,
          _buildDomainHint(context, domain),
        ],
      ),
    );
  }

  Widget _buildDomainHint(BuildContext context, DomainType domain) {
    String hint;
    IconData hintIcon;

    switch (domain) {
      case DomainType.lights:
        hint = 'Control your lighting devices';
        hintIcon = MdiIcons.lightbulbGroup;
        break;
      case DomainType.climate:
        hint = 'Manage temperature and climate';
        hintIcon = MdiIcons.thermometerLines;
        break;
      case DomainType.shading:
        hint = 'Control your window coverings';
        hintIcon = MdiIcons.blindsHorizontal;
        break;
      case DomainType.media:
        hint = 'Control your entertainment';
        hintIcon = MdiIcons.speaker;
        break;
      case DomainType.sensors:
        hint = 'View sensor readings';
        hintIcon = MdiIcons.gaugeEmpty;
        break;
    }

    return Container(
      padding: AppSpacings.paddingMd,
      decoration: BoxDecoration(
        color: Theme.of(context).brightness == Brightness.light
            ? AppBgColorLight.pageOverlay50
            : AppBgColorDark.pageOverlay50,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            hintIcon,
            size: _screenService.scale(
              24,
              density: _visualDensityService.density,
            ),
            color: Theme.of(context).colorScheme.primary,
          ),
          AppSpacings.spacingSmHorizontal,
          Text(
            hint,
            style: TextStyle(
              fontSize: AppFontSize.small,
              color: Theme.of(context).brightness == Brightness.light
                  ? AppTextColorLight.regular
                  : AppTextColorDark.regular,
            ),
          ),
        ],
      ),
    );
  }
}
