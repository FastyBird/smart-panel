import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen_scaler.dart';
import 'package:fastybird_smart_panel/core/utils/datetime.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/flip_clock.dart';
import 'package:flutter/material.dart';

class ScreenSaverScreen extends StatelessWidget {
  final ScreenScalerService scaler = locator<ScreenScalerService>();

  ScreenSaverScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: (_) {
          Navigator.of(context).pop();
        },
        child: Center(
          child: StreamBuilder<DateTime>(
              stream: DatetimeUtils.getTimeStream(),
              builder: (context, snapshot) {
                final now = snapshot.data ?? DateTime.now();

                return Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    FlipClock(
                      startTime: now,
                      digitColor:
                          Theme.of(context).brightness == Brightness.light
                              ? AppTextColorLight.primary
                              : AppTextColorDark.primary,
                      backgroundColor:
                          Theme.of(context).brightness == Brightness.light
                              ? AppFillColorLight.darker
                              : AppFillColorDark.extraLight,
                      borderColor:
                          Theme.of(context).brightness == Brightness.light
                              ? AppBorderColorLight.darker
                              : AppBorderColorDark.extraLight,
                      digitSize: scaler.scale(44.0),
                      spacing: scaler.scale(1),
                      borderRadius: BorderRadius.all(
                        Radius.circular(scaler.scale(4.0)),
                      ),
                      separator: SizedBox(width: scaler.scale(4)),
                    ),
                    AppSpacings.spacingMdVertical,
                    Text(
                      DatetimeUtils.getFormattedDate(now),
                      style: TextStyle(
                        fontSize: AppFontSize.base,
                        color: Theme.of(context).brightness == Brightness.light
                            ? AppTextColorLight.placeholder
                            : AppTextColorDark.placeholder,
                      ),
                    ),
                  ],
                );
              }),
        ),
      ),
    );
  }
}