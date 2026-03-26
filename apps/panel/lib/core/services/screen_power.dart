import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// Service for controlling the physical display power state.
///
/// Supports turning the screen on/off across multiple platforms:
/// - **Linux/X11** (kiosk): Uses `xset dpms force off/on`
/// - **Linux/DRM-KMS** (flutter-pi, eLinux): Uses backlight sysfs interface
/// - **Linux fallback**: Uses framebuffer blanking (`/sys/class/graphics/fb0/blank`)
/// - **Android**: Uses a MethodChannel to control screen brightness via WindowManager
class ScreenPowerService {
	static const _channel = MethodChannel('com.fastybird.smartpanel/screen_power');
	static const _tag = '[SCREEN POWER]';

	bool _isScreenOff = false;

	// Saved backlight brightness for restore on Linux/DRM
	int? _savedBacklightBrightness;
	String? _backlightPath;

	bool get isScreenOff => _isScreenOff;

	/// Turn the screen off (display power save).
	///
	/// Safe to call multiple times — the platform calls are idempotent.
	Future<bool> screenOff() async {
		try {
			bool success = false;

			if (Platform.isLinux) {
				success = await _linuxScreenOff();
			} else if (Platform.isAndroid) {
				success = await _androidScreenOff();
			}

			if (success) {
				_isScreenOff = true;

				if (kDebugMode) {
					debugPrint('$_tag Screen powered off');
				}
			}

			return success;
		} catch (e) {
			if (kDebugMode) {
				debugPrint('$_tag Failed to power off screen: $e');
			}
			return false;
		}
	}

	/// Turn the screen back on.
	///
	/// Always issues the platform call regardless of [_isScreenOff].
	/// A concurrent [screenOff] may still be in flight when this is
	/// called, so skipping based on the flag could leave the display
	/// permanently dark.
	Future<bool> screenOn() async {
		try {
			bool success = false;

			if (Platform.isLinux) {
				success = await _linuxScreenOn();
			} else if (Platform.isAndroid) {
				success = await _androidScreenOn();
			}

			_isScreenOff = false;

			if (success && kDebugMode) {
				debugPrint('$_tag Screen powered on');
			}

			return success;
		} catch (e) {
			if (kDebugMode) {
				debugPrint('$_tag Failed to power on screen: $e');
			}
			return false;
		}
	}

	// ---- Linux implementations ----

	Future<bool> _linuxScreenOff() async {
		// Strategy 1: Backlight sysfs (Raspberry Pi official display, etc.)
		if (await _linuxBacklightOff()) return true;

		// Strategy 2: DPMS via xset (X11 sessions)
		if (await _linuxDpmsOff()) return true;

		// Strategy 3: Framebuffer blanking (DRM/KMS without backlight sysfs)
		if (await _linuxFbBlankOff()) return true;

		if (kDebugMode) {
			debugPrint('$_tag No supported Linux screen power method found');
		}
		return false;
	}

	Future<bool> _linuxScreenOn() async {
		// Try all methods - at least one should work if screenOff succeeded
		bool success = false;

		if (await _linuxBacklightOn()) success = true;
		if (await _linuxDpmsOn()) success = true;
		if (await _linuxFbBlankOn()) success = true;

		return success;
	}

	/// Backlight sysfs: `/sys/class/backlight/*/brightness`
	Future<bool> _linuxBacklightOff() async {
		try {
			final backlightDir = Directory('/sys/class/backlight');
			if (!await backlightDir.exists()) return false;

			final entries = await backlightDir.list().toList();
			if (entries.isEmpty) return false;

			final path = entries.first.path;
			final brightnessFile = File('$path/brightness');
			final maxBrightnessFile = File('$path/max_brightness');

			if (!await brightnessFile.exists()) return false;

			// Save current brightness for restore
			final current = await brightnessFile.readAsString();
			_savedBacklightBrightness = int.tryParse(current.trim());
			_backlightPath = path;

			// If max_brightness exists, verify we have a valid saved value
			if (await maxBrightnessFile.exists() && _savedBacklightBrightness == 0) {
				final max = await maxBrightnessFile.readAsString();
				_savedBacklightBrightness = int.tryParse(max.trim()) ?? 255;
			}

			// Write '0' to brightness file
			final writeResult = await Process.run(
				'bash',
				['-c', 'echo 0 | sudo tee $path/brightness'],
			);

			if (writeResult.exitCode == 0) {
				if (kDebugMode) {
					debugPrint('$_tag Backlight set to 0 at $path');
				}
				return true;
			}

			// Fallback: try without sudo (some systems allow direct write)
			try {
				await brightnessFile.writeAsString('0');

				if (kDebugMode) {
					debugPrint('$_tag Backlight set to 0 (direct write) at $path');
				}
				return true;
			} catch (_) {
				return false;
			}
		} catch (e) {
			if (kDebugMode) {
				debugPrint('$_tag Backlight off failed: $e');
			}
			return false;
		}
	}

	Future<bool> _linuxBacklightOn() async {
		if (_backlightPath == null || _savedBacklightBrightness == null) return false;

		try {
			final brightness = _savedBacklightBrightness!;
			final path = _backlightPath!;

			final result = await Process.run(
				'bash',
				['-c', 'echo $brightness | sudo tee $path/brightness'],
			);

			if (result.exitCode == 0) {
				if (kDebugMode) {
					debugPrint('$_tag Backlight restored to $brightness at $path');
				}
				_savedBacklightBrightness = null;
				_backlightPath = null;
				return true;
			}

			// Fallback: try direct write
			try {
				await File('$path/brightness').writeAsString('$brightness');

				if (kDebugMode) {
					debugPrint('$_tag Backlight restored (direct write) to $brightness');
				}
				_savedBacklightBrightness = null;
				_backlightPath = null;
				return true;
			} catch (_) {
				return false;
			}
		} catch (e) {
			if (kDebugMode) {
				debugPrint('$_tag Backlight on failed: $e');
			}
			return false;
		}
	}

	/// DPMS via xset (X11 only)
	Future<bool> _linuxDpmsOff() async {
		try {
			// Check if DISPLAY is set (X11 session)
			final display = Platform.environment['DISPLAY'];
			if (display == null || display.isEmpty) return false;

			final result = await Process.run('xset', ['dpms', 'force', 'off'],
				environment: {'DISPLAY': display},
			);

			if (result.exitCode == 0) {
				if (kDebugMode) {
					debugPrint('$_tag DPMS force off succeeded');
				}
				return true;
			}

			return false;
		} catch (e) {
			if (kDebugMode) {
				debugPrint('$_tag DPMS off failed: $e');
			}
			return false;
		}
	}

	Future<bool> _linuxDpmsOn() async {
		try {
			final display = Platform.environment['DISPLAY'];
			if (display == null || display.isEmpty) return false;

			final result = await Process.run('xset', ['dpms', 'force', 'on'],
				environment: {'DISPLAY': display},
			);

			if (result.exitCode == 0) {
				if (kDebugMode) {
					debugPrint('$_tag DPMS force on succeeded');
				}
				return true;
			}

			return false;
		} catch (e) {
			if (kDebugMode) {
				debugPrint('$_tag DPMS on failed: $e');
			}
			return false;
		}
	}

	/// Framebuffer blanking: `/sys/class/graphics/fb0/blank`
	Future<bool> _linuxFbBlankOff() async {
		try {
			final result = await Process.run(
				'bash',
				['-c', 'echo 1 | sudo tee /sys/class/graphics/fb0/blank'],
			);

			if (result.exitCode == 0) {
				if (kDebugMode) {
					debugPrint('$_tag Framebuffer blank succeeded');
				}
				return true;
			}

			return false;
		} catch (e) {
			if (kDebugMode) {
				debugPrint('$_tag Framebuffer blank failed: $e');
			}
			return false;
		}
	}

	Future<bool> _linuxFbBlankOn() async {
		try {
			final result = await Process.run(
				'bash',
				['-c', 'echo 0 | sudo tee /sys/class/graphics/fb0/blank'],
			);

			if (result.exitCode == 0) {
				if (kDebugMode) {
					debugPrint('$_tag Framebuffer unblank succeeded');
				}
				return true;
			}

			return false;
		} catch (e) {
			if (kDebugMode) {
				debugPrint('$_tag Framebuffer unblank failed: $e');
			}
			return false;
		}
	}

	// ---- Android implementations ----

	Future<bool> _androidScreenOff() async {
		try {
			final result = await _channel.invokeMethod<bool>('screenOff');
			return result ?? false;
		} on MissingPluginException {
			if (kDebugMode) {
				debugPrint('$_tag Android screen power channel not available');
			}
			return false;
		}
	}

	Future<bool> _androidScreenOn() async {
		try {
			final result = await _channel.invokeMethod<bool>('screenOn');
			return result ?? false;
		} on MissingPluginException {
			if (kDebugMode) {
				debugPrint('$_tag Android screen power channel not available');
			}
			return false;
		}
	}
}
