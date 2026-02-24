import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/modules/security/types/security.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

IconData alertTypeIcon(SecurityAlertType type) {
	return switch (type) {
		SecurityAlertType.smoke => MdiIcons.smokingOff,
		SecurityAlertType.co => MdiIcons.moleculeCo,
		SecurityAlertType.waterLeak => MdiIcons.waterAlert,
		SecurityAlertType.intrusion => MdiIcons.doorOpen,
		SecurityAlertType.entryOpen => MdiIcons.doorOpen,
		SecurityAlertType.gas => MdiIcons.gasCylinder,
		SecurityAlertType.tamper => MdiIcons.alertCircle,
		SecurityAlertType.fault => MdiIcons.alertOctagon,
		SecurityAlertType.deviceOffline => MdiIcons.lanDisconnect,
	};
}

Color severityColor(Severity severity, bool isDark) {
	return switch (severity) {
		Severity.critical => isDark ? AppColorsDark.error : AppColorsLight.error,
		Severity.warning => isDark ? AppColorsDark.warning : AppColorsLight.warning,
		Severity.info => isDark ? AppColorsDark.info : AppColorsLight.info,
	};
}

Color severityBgColor(Severity severity, bool isDark) {
	return switch (severity) {
		Severity.critical => isDark ? AppColorsDark.errorLight9 : AppColorsLight.errorLight9,
		Severity.warning => isDark ? AppColorsDark.warningLight9 : AppColorsLight.warningLight9,
		Severity.info => isDark ? AppColorsDark.infoLight9 : AppColorsLight.infoLight9,
	};
}
