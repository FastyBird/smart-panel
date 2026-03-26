import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// Which Linux screen-off strategy succeeded, so [screenOn] only
/// invokes the matching restore method.
enum _LinuxScreenOffMethod {
	backlight,
	dpms,
	framebuffer,
}

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

	// Which Linux strategy was used to turn the screen off
	_LinuxScreenOffMethod? _linuxMethod;

	bool get isScreenOff => _isScreenOff;

	/// Turn the screen off (display power save).
	///
	/// No-op if the screen is already off, to avoid overwriting the saved
	/// brightness with the dimmed value.
	Future<bool> screenOff() async {
		if (_isScreenOff) return true;

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
		if (await _linuxBacklightOff()) {
			_linuxMethod = _LinuxScreenOffMethod.backlight;
			return true;
		}

		// Strategy 2: DPMS via xset (X11 sessions)
		if (await _linuxDpmsOff()) {
			_linuxMethod = _LinuxScreenOffMethod.dpms;
			return true;
		}

		// Strategy 3: Framebuffer blanking (DRM/KMS without backlight sysfs)
		if (await _linuxFbBlankOff()) {
			_linuxMethod = _LinuxScreenOffMethod.framebuffer;
			return true;
		}

		if (kDebugMode) {
			debugPrint('$_tag No supported Linux screen power method found');
		}
		return false;
	}

	Future<bool> _linuxScreenOn() async {
		final method = _linuxMethod;
		_linuxMethod = null;

		switch (method) {
			case _LinuxScreenOffMethod.backlight:
				return _linuxBacklightOn();
			case _LinuxScreenOffMethod.dpms:
				return _linuxDpmsOn();
			case _LinuxScreenOffMethod.framebuffer:
				return _linuxFbBlankOn();
			case null:
				// No method recorded — try all as a fallback
				if (await _linuxBacklightOn()) return true;
				if (await _linuxDpmsOn()) return true;
				if (await _linuxFbBlankOn()) return true;
				return false;
		}
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

			if (!await brightnessFile.exists()) return false;

			// Save current brightness for restore (even if 0)
			final current = await brightnessFile.readAsString();
			final parsedBrightness = int.tryParse(current.trim());

			if (parsedBrightness == null) {
				if (kDebugMode) {
					debugPrint('$_tag Could not parse backlight brightness: "$current"');
				}
				return false;
			}

			_savedBacklightBrightness = parsedBrightness;
			_backlightPath = path;

			// Try direct write first (flutter-pi runs as root)
			try {
				await brightnessFile.writeAsString('0');

				if (kDebugMode) {
					debugPrint('$_tag Backlight set to 0 at $path');
				}
				return true;
			} catch (_) {
				// Direct write failed — try sudo tee as fallback
			}

			final quotedPath = path.replaceAll("'", r"'\''");
			final writeResult = await Process.run(
				'bash',
				['-c', "echo 0 | sudo tee '$quotedPath/brightness'"],
			);

			if (writeResult.exitCode == 0) {
				if (kDebugMode) {
					debugPrint('$_tag Backlight set to 0 (sudo) at $path');
				}
				return true;
			}

			return false;
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

			// Try direct write first (flutter-pi runs as root)
			try {
				await File('$path/brightness').writeAsString('$brightness');

				if (kDebugMode) {
					debugPrint('$_tag Backlight restored to $brightness at $path');
				}
				_savedBacklightBrightness = null;
				_backlightPath = null;
				return true;
			} catch (_) {
				// Direct write failed — try sudo tee as fallback
			}

			final quotedPath = path.replaceAll("'", r"'\''");
			final result = await Process.run(
				'bash',
				['-c', "echo $brightness | sudo tee '$quotedPath/brightness'"],
			);

			if (result.exitCode == 0) {
				if (kDebugMode) {
					debugPrint('$_tag Backlight restored to $brightness (sudo) at $path');
				}
				_savedBacklightBrightness = null;
				_backlightPath = null;
				return true;
			}

			return false;
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
