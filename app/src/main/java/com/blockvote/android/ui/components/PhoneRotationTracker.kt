package com.blockvote.android.ui.components

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import kotlin.math.abs

/**
 * Tracks phone yaw rotation. Locks to the first turn direction (left or right);
 * reversing direction is ignored (progress never goes down). Pausing when the
 * user leaves the frame does not reset the angle reference.
 */
class PhoneRotationTracker(
    context: Context,
    val targetDegrees: Float = 240f
) : SensorEventListener {

    private val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    private val rotationSensor =
        sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)
            ?: sensorManager.getDefaultSensor(Sensor.TYPE_GAME_ROTATION_VECTOR)

    private val rotationMatrix = FloatArray(9)
    private val orientation = FloatArray(3)

    private var lastYawRad: Float? = null
    private var accumulatedDegrees = 0f
    private var completed = false
    /** +1 = count only clockwise yaw, -1 = only counter-clockwise. Set on first move. */
    private var lockedDirection: Int? = null

    var onProgress: (progress: Float, degrees: Float) -> Unit = { _, _ -> }
    var onComplete: () -> Unit = {}

    /** When false, progress is frozen but yaw reference is kept (no jump on resume). */
    var canAccumulate: Boolean = true

    val isSensorAvailable: Boolean get() = rotationSensor != null

    val progress: Float get() = (accumulatedDegrees / targetDegrees).coerceIn(0f, 1f)

    val degrees: Float get() = accumulatedDegrees

    val isComplete: Boolean get() = completed || accumulatedDegrees >= targetDegrees

    fun start() {
        completed = false
        rotationSensor?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME)
        }
    }

    fun stop() {
        sensorManager.unregisterListener(this)
    }

    fun reset() {
        lastYawRad = null
        accumulatedDegrees = 0f
        completed = false
        lockedDirection = null
        onProgress(0f, 0f)
    }

    override fun onSensorChanged(event: SensorEvent?) {
        if (event == null || completed) return

        SensorManager.getRotationMatrixFromVector(rotationMatrix, event.values)
        SensorManager.getOrientation(rotationMatrix, orientation)
        val yawRad = orientation[0]

        lastYawRad?.let { prev ->
            var deltaDeg = Math.toDegrees((yawRad - prev).toDouble()).toFloat()
            while (deltaDeg > 180f) deltaDeg -= 360f
            while (deltaDeg < -180f) deltaDeg += 360f

            if (canAccumulate && abs(deltaDeg) >= 0.35f) {
                val moveDir = if (deltaDeg > 0f) 1 else -1
                if (lockedDirection == null && abs(deltaDeg) >= 1.5f) {
                    lockedDirection = moveDir
                }
                // Ignore reverse direction — keep progress, do not reset.
                if (lockedDirection == null || moveDir == lockedDirection) {
                    accumulatedDegrees += abs(deltaDeg)
                    onProgress(progress, accumulatedDegrees)
                    if (accumulatedDegrees >= targetDegrees) {
                        completed = true
                        onComplete()
                    }
                }
            }
        }
        lastYawRad = yawRad
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
}
