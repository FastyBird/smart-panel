import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// Service for controlling the physical device hardware:
/// screen brightness, speaker volume, and microphone volume.
///
/// Supports multiple platforms:
/// - **Linux/DRM-KMS** (flutter-pi, eLinux): Backlight sysfs for brightness,
///   ALSA (amixer) for audio
/// - **Linux/X11** (kiosk): xrandr for brightness, ALSA (amixer) for audio
/// - **Android**: MethodChannel to native WindowManager and AudioManager APIs
class DeviceControlService {
	static const _channel = MethodChannel('com.fastybird.smartpanel/device_control');
	static const _tag = '[DEVICE CONTROL]';

	// Cached backlight info for Linux
	String? _backlightPath;
	int? _maxBrightness;

	// ---- Brightness ----

	/// Set screen brightness as a percentage (0-100).
	Future<bool> setBrightness(int percent) async {
		final clamped = percent.clamp(0, 100);

		try {
			if (Platform.isLinux) {
				return await _linuxSetBrightness(clamped);
			} else if (Platform.isAndroid) {
				return await _androidSetBrightness(clamped);
			}

			return false;
		} catch (e) {
			if (kDebugMode) {
				debugPrint('$_tag Failed to set brightness to $clamped%: $e');
			}
			return false;
		}
	}

	// ---- Speaker ----

	/// Set speaker volume as a percentage (0-100).
	Future<bool> setSpeakerVolume(int percent) async {
		final clamped = percent.clamp(0, 100);

		try {
			if (Platform.isLinux) {
				return await _linuxSetSpeakerVolume(clamped);
			} else if (Platform.isAndroid) {
				return await _androidSetSpeakerVolume(clamped);
			}

			return false;
		} catch (e) {
			if (kDebugMode) {
				debugPrint('$_tag Failed to set speaker volume to $clamped%: $e');
			}
			return false;
		}
	}

	/// Mute or unmute the speaker.
	Future<bool> setSpeakerMute(bool mute) async {
		try {
			if (Platform.isLinux) {
				return await _linuxSetSpeakerMute(mute);
			} else if (Platform.isAndroid) {
				return await _androidSetSpeakerMute(mute);
			}

			return false;
		} catch (e) {
			if (kDebugMode) {
				debugPrint('$_tag Failed to ${mute ? 'mute' : 'unmute'} speaker: $e');
			}
			return false;
		}
	}

	// ---- Microphone ----

	/// Set microphone volume as a percentage (0-100).
	Future<bool> setMicrophoneVolume(int percent) async {
		final clamped = percent.clamp(0, 100);

		try {
			if (Platform.isLinux) {
				return await _linuxSetMicrophoneVolume(clamped);
			} else if (Platform.isAndroid) {
				return await _androidSetMicrophoneVolume(clamped);
			}

			return false;
		} catch (e) {
			if (kDebugMode) {
				debugPrint('$_tag Failed to set microphone volume to $clamped%: $e');
			}
			return false;
		}
	}

	/// Mute or unmute the microphone.
	Future<bool> setMicrophoneMute(bool mute) async {
		try {
			if (Platform.isLinux) {
				return await _linuxSetMicrophoneMute(mute);
			} else if (Platform.isAndroid) {
				return await _androidSetMicrophoneMute(mute);
			}

			return false;
		} catch (e) {
			if (kDebugMode) {
				debugPrint('$_tag Failed to ${mute ? 'mute' : 'unmute'} microphone: $e');
			}
			return false;
		}
	}

	// ---- Linux: Brightness ----

	Future<bool> _linuxSetBrightness(int percent) async {
		// Strategy 1: Backlight sysfs (Raspberry Pi, eLinux, flutter-pi)
		if (await _linuxSetBacklightBrightness(percent)) {
			return true;
		}

		// Strategy 2: xrandr (X11 kiosk sessions)
		if (await _linuxSetXrandrBrightness(percent)) {
			return true;
		}

		if (kDebugMode) {
			debugPrint('$_tag No supported Linux brightness method found');
		}

		return false;
	}

	Future<bool> _linuxSetBacklightBrightness(int percent) async {
		try {
			// Discover backlight path if not cached
			if (_backlightPath == null) {
				final backlightDir = Directory('/sys/class/backlight');

				if (!await backlightDir.exists()) return false;

				final entries = await backlightDir.list().toList();

				if (entries.isEmpty) return false;

				_backlightPath = entries.first.path;
			}

			// Read max brightness if not cached
			if (_maxBrightness == null) {
				final maxFile = File('$_backlightPath/max_brightness');

				if (!await maxFile.exists()) return false;

				final content = await maxFile.readAsString();
				_maxBrightness = int.tryParse(content.trim());

				if (_maxBrightness == null || _maxBrightness! <= 0) {
					_backlightPath = null;
					_maxBrightness = null;
					return false;
				}
			}

			// Map 0-100% to 1-maxBrightness (minimum 1 to avoid turning off the backlight
			// completely, which would leave the user unable to interact with the UI)
			final raw = (percent * _maxBrightness! / 100).round();
			final value = raw < 1 ? 1 : raw;

			final result = await Process.run('sh', ['-c', 'echo $value > $_backlightPath/brightness']);

			if (result.exitCode == 0) {
				if (kDebugMode) {
					debugPrint('$_tag Backlight set to $value ($percent%) at $_backlightPath');
				}
				return true;
			}

			return false;
		} catch (e) {
			if (kDebugMode) {
				debugPrint('$_tag Backlight brightness failed: $e');
			}
			return false;
		}
	}

	Future<bool> _linuxSetXrandrBrightness(int percent) async {
		try {
			final display = Platform.environment['DISPLAY'];

			if (display == null || display.isEmpty) return false;

			// Get connected output name
			final queryResult = await Process.run(
				'xrandr',
				['--query'],
				environment: {'DISPLAY': display},
			);

			if (queryResult.exitCode != 0) return false;

			final outputMatch = RegExp(r'^(\S+)\s+connected', multiLine: true)
					.firstMatch(queryResult.stdout as String);

			if (outputMatch == null) return false;

			final outputName = outputMatch.group(1)!;
			final brightnessValue = (percent / 100.0).clamp(0.1, 1.0);

			final result = await Process.run(
				'xrandr',
				['--output', outputName, '--brightness', brightnessValue.toStringAsFixed(2)],
				environment: {'DISPLAY': display},
			);

			if (result.exitCode == 0) {
				if (kDebugMode) {
					debugPrint('$_tag xrandr brightness set to $brightnessValue on $outputName');
				}
				return true;
			}

			return false;
		} catch (e) {
			if (kDebugMode) {
				debugPrint('$_tag xrandr brightness failed: $e');
			}
			return false;
		}
	}

	// ---- Linux: Speaker ----

	Future<bool> _linuxSetSpeakerVolume(int percent) async {
		return _linuxRunAmixer(['set', 'Master', '$percent%']);
	}

	Future<bool> _linuxSetSpeakerMute(bool mute) async {
		return _linuxRunAmixer(['set', 'Master', mute ? 'mute' : 'unmute']);
	}

	// ---- Linux: Microphone ----

	Future<bool> _linuxSetMicrophoneVolume(int percent) async {
		return _linuxRunAmixer(['set', 'Capture', '$percent%']);
	}

	Future<bool> _linuxSetMicrophoneMute(bool mute) async {
		return _linuxRunAmixer(['set', 'Capture', mute ? 'nocap' : 'cap']);
	}

	/// Run an amixer command and return true on success.
	Future<bool> _linuxRunAmixer(List<String> args) async {
		try {
			final result = await Process.run('amixer', args);

			if (result.exitCode == 0) {
				if (kDebugMode) {
					debugPrint('$_tag amixer ${args.join(' ')} succeeded');
				}
				return true;
			}

			if (kDebugMode) {
				debugPrint('$_tag amixer ${args.join(' ')} failed: ${result.stderr}');
			}

			return false;
		} catch (e) {
			if (kDebugMode) {
				debugPrint('$_tag amixer failed: $e');
			}
			return false;
		}
	}

	// ---- Android implementations ----

	Future<bool> _androidSetBrightness(int percent) async {
		try {
			final result = await _channel.invokeMethod<bool>(
				'setBrightness',
				{'percent': percent},
			);
			return result ?? false;
		} on MissingPluginException {
			if (kDebugMode) {
				debugPrint('$_tag Android device control channel not available');
			}
			return false;
		}
	}

	Future<bool> _androidSetSpeakerVolume(int percent) async {
		try {
			final result = await _channel.invokeMethod<bool>(
				'setSpeakerVolume',
				{'percent': percent},
			);
			return result ?? false;
		} on MissingPluginException {
			if (kDebugMode) {
				debugPrint('$_tag Android device control channel not available');
			}
			return false;
		}
	}

	Future<bool> _androidSetSpeakerMute(bool mute) async {
		try {
			final result = await _channel.invokeMethod<bool>(
				'setSpeakerMute',
				{'mute': mute},
			);
			return result ?? false;
		} on MissingPluginException {
			if (kDebugMode) {
				debugPrint('$_tag Android device control channel not available');
			}
			return false;
		}
	}

	Future<bool> _androidSetMicrophoneVolume(int percent) async {
		try {
			final result = await _channel.invokeMethod<bool>(
				'setMicrophoneVolume',
				{'percent': percent},
			);
			return result ?? false;
		} on MissingPluginException {
			if (kDebugMode) {
				debugPrint('$_tag Android device control channel not available');
			}
			return false;
		}
	}

	Future<bool> _androidSetMicrophoneMute(bool mute) async {
		try {
			final result = await _channel.invokeMethod<bool>(
				'setMicrophoneMute',
				{'mute': mute},
			);
			return result ?? false;
		} on MissingPluginException {
			if (kDebugMode) {
				debugPrint('$_tag Android device control channel not available');
			}
			return false;
		}
	}
}
