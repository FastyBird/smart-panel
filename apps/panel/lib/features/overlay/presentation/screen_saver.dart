import 'package:fastybird_smart_panel/core/utils/datetime.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/flip_clock.dart';
import 'package:flutter/material.dart';

class ScreenSaverScreen extends StatelessWidget {
  const ScreenSaverScreen({super.key});

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
                  spacing: AppSpacings.pMd,
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
                      digitSize: AppSpacings.scale(44),
                      spacing: AppSpacings.scale(1),
                      borderRadius: BorderRadius.all(
                        Radius.circular(AppSpacings.scale(4)),
                      ),
                      separator: SizedBox(
                          width: AppSpacings.scale(4)),
                    ),
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
