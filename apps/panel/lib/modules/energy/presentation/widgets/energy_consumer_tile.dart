import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

import 'package:fastybird_smart_panel/core/utils/number_format.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/base_card.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/energy/models/energy_breakdown.dart';
import 'package:fastybird_smart_panel/modules/energy/utils/energy_format.dart';

/// Single device tile with name, consumption value, and progress bar.
///
/// Used in the top consumers sheet/drawer by both the standalone energy
/// screen and the domain view.
class EnergyConsumerTile extends StatelessWidget {
  final EnergyBreakdownDevice device;
  final double maxConsumption;

  const EnergyConsumerTile({
    super.key,
    required this.device,
    required this.maxConsumption,
  });

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final infoFamily = ThemeColorFamily.get(
      isDark ? Brightness.dark : Brightness.light,
      ThemeColors.info,
    );

    final ratio =
        maxConsumption > 0 ? device.consumption / maxConsumption : 0.0;

    return BaseCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        spacing: AppSpacings.pSm,
        children: [
          Row(
            spacing: AppSpacings.pSm,
            children: [
              Container(
                width: AppSpacings.scale(32),
                height: AppSpacings.scale(32),
                decoration: BoxDecoration(
                  color: infoFamily.light8,
                  borderRadius: BorderRadius.circular(AppBorderRadius.base),
                ),
                child: Icon(
                  MdiIcons.flashOutline,
                  size: AppSpacings.scale(24),
                  color: infoFamily.base,
                ),
              ),
              Expanded(
                child: Text(
                  device.roomName != null &&
                          device.deviceName.startsWith(device.roomName!)
                      ? device.deviceName
                          .substring(device.roomName!.length)
                          .trimLeft()
                      : device.deviceName,
                  style: TextStyle(
                    fontSize: AppFontSize.base,
                    fontWeight: FontWeight.w500,
                    color: isDark
                        ? AppTextColorDark.primary
                        : AppTextColorLight.primary,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Text(
                '${NumberFormatUtils.defaultFormat.formatDecimal(device.consumption, decimalPlaces: energyDecimals(device.consumption))} ${localizations.energy_unit_kwh}',
                style: TextStyle(
                  fontSize: AppFontSize.base,
                  fontWeight: FontWeight.w600,
                  color: infoFamily.base,
                ),
              ),
            ],
          ),
          ClipRRect(
            borderRadius: BorderRadius.circular(AppSpacings.scale(2)),
            child: LinearProgressIndicator(
              value: ratio,
              minHeight: AppSpacings.scale(4),
              backgroundColor:
                  isDark ? AppFillColorDark.darker : AppBorderColorLight.base,
              valueColor: AlwaysStoppedAnimation<Color>(
                infoFamily.light3,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
