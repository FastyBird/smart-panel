package com.fastybird.smartpanel

import android.content.Context
import android.media.AudioManager
import android.os.Build
import android.view.WindowManager
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
	private val SCREEN_POWER_CHANNEL = "com.fastybird.smartpanel/screen_power"
	private val DEVICE_CONTROL_CHANNEL = "com.fastybird.smartpanel/device_control"
	private var savedBrightness: Float = -1f

	override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
		super.configureFlutterEngine(flutterEngine)

		MethodChannel(flutterEngine.dartExecutor.binaryMessenger, SCREEN_POWER_CHANNEL).setMethodCallHandler { call, result ->
			when (call.method) {
				"screenOff" -> {
					result.success(setScreenOff())
				}
				"screenOn" -> {
					result.success(setScreenOn())
				}
				else -> {
					result.notImplemented()
				}
			}
		}

		MethodChannel(flutterEngine.dartExecutor.binaryMessenger, DEVICE_CONTROL_CHANNEL).setMethodCallHandler { call, result ->
			when (call.method) {
				"setBrightness" -> {
					val percent = call.argument<Int>("percent") ?: 100
					result.success(setBrightness(percent))
				}
				"setSpeakerVolume" -> {
					val percent = call.argument<Int>("percent") ?: 50
					result.success(setSpeakerVolume(percent))
				}
				"setSpeakerMute" -> {
					val mute = call.argument<Boolean>("mute") ?: false
					result.success(setSpeakerMute(mute))
				}
				"setMicrophoneVolume" -> {
					val percent = call.argument<Int>("percent") ?: 50
					result.success(setMicrophoneVolume(percent))
				}
				"setMicrophoneMute" -> {
					val mute = call.argument<Boolean>("mute") ?: false
					result.success(setMicrophoneMute(mute))
				}
				else -> {
					result.notImplemented()
				}
			}
		}
	}

	private fun setScreenOff(): Boolean {
		return try {
			val window = window ?: return false
			val params = window.attributes

			// Save current brightness for restore
			savedBrightness = params.screenBrightness

			// Set brightness to minimum (effectively black screen)
			params.screenBrightness = 0f
			window.attributes = params

			// Add flag to keep screen on but dim
			window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

			true
		} catch (e: Exception) {
			false
		}
	}

	private fun setScreenOn(): Boolean {
		return try {
			val window = window ?: return false
			val params = window.attributes

			// Restore saved brightness (-1 means use system default)
			params.screenBrightness = if (savedBrightness >= 0f) savedBrightness else -1f
			window.attributes = params

			// Remove the keep-screen-on flag added by setScreenOff
			window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

			// Ensure screen wakes up
			if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
				setTurnScreenOn(true)
				// Reset after a short delay
				window.decorView.postDelayed({
					setTurnScreenOn(false)
				}, 1000)
			}

			true
		} catch (e: Exception) {
			false
		}
	}

	private fun setBrightness(percent: Int): Boolean {
		return try {
			val window = window ?: return false
			val params = window.attributes

			// Map 0-100 to 0.01-1.0 (avoid 0.0 which turns off the screen)
			params.screenBrightness = if (percent <= 0) 0.01f else percent / 100.0f
			window.attributes = params

			true
		} catch (e: Exception) {
			false
		}
	}

	private fun setSpeakerVolume(percent: Int): Boolean {
		return try {
			val audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
			val maxVolume = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
			val volume = (percent * maxVolume / 100).coerceIn(0, maxVolume)

			audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, volume, 0)

			true
		} catch (e: Exception) {
			false
		}
	}

	private fun setSpeakerMute(mute: Boolean): Boolean {
		return try {
			val audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager

			if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
				audioManager.adjustStreamVolume(
					AudioManager.STREAM_MUSIC,
					if (mute) AudioManager.ADJUST_MUTE else AudioManager.ADJUST_UNMUTE,
					0
				)
			} else {
				@Suppress("DEPRECATION")
				audioManager.setStreamMute(AudioManager.STREAM_MUSIC, mute)
			}

			true
		} catch (e: Exception) {
			false
		}
	}

	private fun setMicrophoneVolume(percent: Int): Boolean {
		return try {
			val audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
			val maxVolume = audioManager.getStreamMaxVolume(AudioManager.STREAM_VOICE_CALL)
			val volume = (percent * maxVolume / 100).coerceIn(0, maxVolume)

			audioManager.setStreamVolume(AudioManager.STREAM_VOICE_CALL, volume, 0)

			true
		} catch (e: Exception) {
			false
		}
	}

	private fun setMicrophoneMute(mute: Boolean): Boolean {
		return try {
			val audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
			audioManager.isMicrophoneMute = mute

			true
		} catch (e: Exception) {
			false
		}
	}
}
