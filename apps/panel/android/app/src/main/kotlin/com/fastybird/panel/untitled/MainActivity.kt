package com.fastybird.smartpanel

import android.os.Build
import android.view.WindowManager
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
	private val CHANNEL = "com.fastybird.smartpanel/screen_power"
	private var savedBrightness: Float = -1f

	override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
		super.configureFlutterEngine(flutterEngine)

		MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler { call, result ->
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
}
