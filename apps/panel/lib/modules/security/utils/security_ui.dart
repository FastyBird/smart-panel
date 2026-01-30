import 'package:fastybird_smart_panel/core/widgets/system_pages/export.dart';
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
		Severity.critical => SystemPagesTheme.error(isDark),
		Severity.warning => SystemPagesTheme.warning(isDark),
		Severity.info => SystemPagesTheme.info(isDark),
	};
}

Color severityBgColor(Severity severity, bool isDark) {
	return switch (severity) {
		Severity.critical => SystemPagesTheme.errorLight(isDark),
		Severity.warning => SystemPagesTheme.warningLight(isDark),
		Severity.info => SystemPagesTheme.infoLight(isDark),
	};
}
