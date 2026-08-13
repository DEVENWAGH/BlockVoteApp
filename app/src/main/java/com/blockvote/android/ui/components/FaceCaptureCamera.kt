package com.blockvote.android.ui.components

import android.content.Context
import android.content.ContextWrapper
import android.graphics.BitmapFactory
import android.util.Base64
import android.util.Log
import android.view.ViewGroup
import androidx.activity.ComponentActivity
import androidx.annotation.OptIn
import androidx.camera.core.CameraSelector
import androidx.camera.core.ExperimentalGetImage
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Cameraswitch
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import com.blockvote.android.ui.theme.ElectricCyan
import com.blockvote.android.ui.theme.EmeraldGreen
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetector
import com.google.mlkit.vision.face.FaceDetectorOptions
import kotlinx.coroutines.delay
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.concurrent.Executor
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong

private const val TAG = "FaceCaptureCamera"

/** Faster frame analysis (was 250ms). */
private const val ANALYSIS_MIN_INTERVAL_MS = 90L

private const val AUTO_CAPTURE_DELAY_MS = 900L

/**
 * Face height / image height. Above this = too close (narrow room view).
 * User should hold at arm's length so more of the room is visible.
 */
private const val MAX_FACE_FILL_FOR_WIDE_SCAN = 0.38f

/** Below this the face is too small to track reliably. */
private const val MIN_FACE_FILL_FOR_SCAN = 0.10f

enum class CameraScanMode {
    /** Front camera: stay in frame, rotate phone ~320°, auto-capture if alone. */
    LIVENESS_ROTATE
}

private enum class LivenessPhase {
    ROTATING,
    READY,
    CAPTURING,
    /** Photo sent; waiting for AWS. Unlocks again via [retryToken]. */
    VERIFYING
}

@Composable
fun FaceCaptureCamera(
    mode: CameraScanMode,
    enabled: Boolean,
    /** Increment when AWS rejects so user can recapture without restarting the whole vote. */
    retryToken: Int = 0,
    onCaptured: (dataUrl: String) -> Unit,
    onError: (String) -> Unit,
    onScanWarning: (String) -> Unit = {},
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val activity = remember(context) { context.findComponentActivity() }
        ?: error("FaceCaptureCamera must be hosted in an Activity")
    val lifecycleOwner: LifecycleOwner = activity

    val mainExecutor = remember { ContextCompat.getMainExecutor(context) }
    val cameraExecutor = remember { Executors.newSingleThreadExecutor() }
    val analysisExecutor = remember { Executors.newSingleThreadExecutor() }
    val imageCapture = remember {
        ImageCapture.Builder()
            .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
            .build()
    }
    val bindStarted = remember { AtomicBoolean(false) }
    val lastAnalysisAt = remember { AtomicLong(0L) }
    val captureTriggered = remember { AtomicBoolean(false) }

    val detector = remember {
        FaceDetection.getClient(
            FaceDetectorOptions.Builder()
                .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
                .setMinFaceSize(0.08f)
                .enableTracking()
                .build()
        )
    }

    val rotationTracker = remember { PhoneRotationTracker(context) }
    val targetRotation = rotationTracker.targetDegrees

    var phase by remember { mutableStateOf(LivenessPhase.ROTATING) }
    var status by remember { mutableStateOf("Opening front camera…") }
    var ready by remember { mutableStateOf(false) }
    var faceCount by remember { mutableIntStateOf(0) }
    var faceFillRatio by remember { mutableFloatStateOf(0f) }
    var distanceOk by remember { mutableStateOf(false) }
    var rotationProgress by remember { mutableFloatStateOf(0f) }
    var rotationDegrees by remember { mutableFloatStateOf(0f) }
    var rotationComplete by remember { mutableStateOf(false) }
    var extraPersonAlert by remember { mutableStateOf(false) }

    val animatedProgress by animateFloatAsState(
        targetValue = rotationProgress,
        animationSpec = tween(180, easing = LinearEasing),
        label = "rotationProgress"
    )

    val extraPersonMessage =
        "Another person detected in frame. Rotation scan restarted from the start. Stay alone, then rotate again."

    fun updateStatus(count: Int, fill: Float = faceFillRatio) {
        val farEnough = fill in MIN_FACE_FILL_FOR_SCAN..MAX_FACE_FILL_FOR_WIDE_SCAN
        status = when {
            extraPersonAlert || count > 1 -> extraPersonMessage
            phase == LivenessPhase.CAPTURING -> "Capturing photo…"
            phase == LivenessPhase.VERIFYING -> "Verifying your identity… remove glasses if rejected."
            count == 0 -> "Hold phone at arm's length. Keep your face in the oval."
            !farEnough && fill > MAX_FACE_FILL_FOR_WIDE_SCAN ->
                "Too close — stretch your arm and move the phone farther for a wider room view."
            !farEnough && fill > 0f && fill < MIN_FACE_FILL_FOR_SCAN ->
                "A bit too far — move slightly closer so we can see your face."
            rotationComplete -> "Wide scan complete. Hold still — capturing soon…"
            else ->
                "Arm's length OK. Rotate one way (${rotationDegrees.toInt()}° / ${targetRotation.toInt()}°)."
        }
    }

    fun isWideDistanceOk(fill: Float, count: Int): Boolean =
        count == 1 && fill in MIN_FACE_FILL_FOR_SCAN..MAX_FACE_FILL_FOR_WIDE_SCAN && !extraPersonAlert

    fun unlockForRecapture(reason: String) {
        captureTriggered.set(false)
        // Keep rotation progress — user only needs a new photo (e.g. without glasses).
        phase = if (rotationComplete || !rotationTracker.isSensorAvailable) {
            LivenessPhase.READY
        } else {
            LivenessPhase.ROTATING
        }
        status = reason
    }

    LaunchedEffect(retryToken) {
        if (retryToken <= 0) return@LaunchedEffect
        unlockForRecapture(
            "Verification failed. Remove glasses, improve lighting, then tap Recapture."
        )
    }

    DisposableEffect(Unit) {
        onDispose {
            cameraExecutor.shutdown()
            analysisExecutor.shutdown()
            detector.close()
        }
    }

    fun resetScan(reason: String, extraPerson: Boolean = false) {
        rotationTracker.reset()
        rotationComplete = false
        rotationProgress = 0f
        rotationDegrees = 0f
        phase = LivenessPhase.ROTATING
        captureTriggered.set(false)
        extraPersonAlert = extraPerson
        status = reason
    }

    DisposableEffect(lifecycleOwner) {
        rotationTracker.onProgress = { p, d ->
            mainExecutor.execute {
                rotationProgress = p
                rotationDegrees = d
                if (d >= targetRotation) rotationComplete = true
            }
        }
        rotationTracker.onComplete = {
            mainExecutor.execute { rotationComplete = true }
        }
        rotationTracker.start()
        bindStarted.set(false)
        onDispose {
            rotationTracker.stop()
            runCatching {
                ProcessCameraProvider.getInstance(context).get().unbindAll()
            }
        }
    }

    LaunchedEffect(faceCount) {
        if (faceCount > 1 && phase != LivenessPhase.VERIFYING) {
            if (!extraPersonAlert) {
                resetScan(extraPersonMessage, extraPerson = true)
                onScanWarning(extraPersonMessage)
            }
        } else if (faceCount == 1 && extraPersonAlert) {
            extraPersonAlert = false
            status = "You are alone now. Stay in the oval and restart rotation from 0°."
        }
    }

    LaunchedEffect(faceCount, faceFillRatio, rotationComplete, phase, ready) {
        if (!ready || phase != LivenessPhase.ROTATING) return@LaunchedEffect
        distanceOk = isWideDistanceOk(faceFillRatio, faceCount)
        rotationTracker.canAccumulate = distanceOk
        updateStatus(faceCount, faceFillRatio)

        if (rotationComplete && distanceOk) {
            phase = LivenessPhase.READY
            status = "Scan complete. Capturing in a moment…"
            delay(AUTO_CAPTURE_DELAY_MS)
            if (faceCount == 1 && !extraPersonAlert && phase == LivenessPhase.READY &&
                captureTriggered.compareAndSet(false, true)
            ) {
                phase = LivenessPhase.CAPTURING
                captureFacePhoto(
                    context = context,
                    imageCapture = imageCapture,
                    cameraExecutor = cameraExecutor,
                    mainExecutor = mainExecutor,
                    onCaptured = { url ->
                        phase = LivenessPhase.VERIFYING
                        onCaptured(url)
                    },
                    onError = { msg ->
                        unlockForRecapture(msg)
                        onError(msg)
                    }
                )
            }
        }
    }

    val borderColor = when {
        faceCount > 1 -> Color(0xFFFF8A80)
        rotationComplete && distanceOk -> EmeraldGreen
        distanceOk -> ElectricCyan
        faceCount == 1 -> Color(0xFFFFB74D)
        else -> Color(0xFFFFB74D)
    }

    Column(modifier = modifier) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(420.dp)
                .clip(RoundedCornerShape(16.dp))
                .border(2.dp, borderColor, RoundedCornerShape(16.dp))
        ) {
            AndroidView(
                factory = { ctx ->
                    PreviewView(ctx).apply {
                        implementationMode = PreviewView.ImplementationMode.COMPATIBLE
                        scaleType = PreviewView.ScaleType.FILL_CENTER
                        layoutParams = ViewGroup.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.MATCH_PARENT
                        )
                    }
                },
                modifier = Modifier.fillMaxSize(),
                update = { previewView ->
                    if (!enabled) return@AndroidView
                    if (!bindStarted.compareAndSet(false, true)) return@AndroidView

                    fun tryBind() {
                        if (previewView.width <= 0 || previewView.height <= 0) {
                            previewView.post { tryBind() }
                            return
                        }
                        bindFrontCamera(
                            context = context,
                            lifecycleOwner = lifecycleOwner,
                            previewView = previewView,
                            imageCapture = imageCapture,
                            analysisExecutor = analysisExecutor,
                            mainExecutor = mainExecutor,
                            detector = detector,
                            lastAnalysisAt = lastAnalysisAt,
                            onFaceDetected = { count, fill ->
                                faceCount = count
                                faceFillRatio = fill
                                distanceOk = isWideDistanceOk(fill, count)
                                updateStatus(count, fill)
                            },
                            onStatus = { status = it },
                            onReady = {
                                ready = it
                                if (it) {
                                    status =
                                        "Hold phone at arm's length with one hand, then rotate slowly to one side."
                                }
                            },
                            onError = { msg ->
                                bindStarted.set(false)
                                onError(msg)
                            }
                        )
                    }
                    previewView.post { tryBind() }
                }
            )

            LivenessOverlay(
                status = status,
                faceCount = faceCount,
                progress = animatedProgress,
                degrees = rotationDegrees,
                rotationComplete = rotationComplete,
                extraPersonAlert = extraPersonAlert,
                distanceOk = distanceOk,
                tooClose = faceCount == 1 && faceFillRatio > MAX_FACE_FILL_FOR_WIDE_SCAN
            )
        }

        Spacer(modifier = Modifier.height(10.dp))

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(Color.White.copy(alpha = 0.06f))
                .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            RowBetween(
                label = "Room coverage",
                value = when {
                    faceCount > 1 -> "Blocked"
                    distanceOk -> "Wide view OK"
                    faceCount == 1 && faceFillRatio > MAX_FACE_FILL_FOR_WIDE_SCAN -> "Too close"
                    faceCount == 0 -> "Find face"
                    else -> "Adjust distance"
                }
            )
            RowBetween(
                label = "Rotation scan",
                value = "${rotationDegrees.toInt()}° / ${targetRotation.toInt()}°"
            )
            LinearProgressIndicator(
                progress = { animatedProgress },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(8.dp)
                    .clip(RoundedCornerShape(4.dp)),
                color = if (faceCount > 1) Color(0xFFFF8A80) else EmeraldGreen,
                trackColor = Color.White.copy(alpha = 0.15f)
            )
            Text(
                text = when {
                    extraPersonAlert || faceCount > 1 ->
                        "0% — another person detected. Scan restarted from the start."
                    faceCount == 1 && faceFillRatio > MAX_FACE_FILL_FOR_WIDE_SCAN ->
                        "Hold farther (arm's length) so we can see more of the room."
                    !rotationTracker.isSensorAvailable ->
                        "Rotation sensor unavailable — use Capture when your face is centered."
                    rotationComplete -> "100% — rotation complete"
                    !distanceOk -> "Distance locked — stretch arm, then rotate"
                    else -> "${(animatedProgress * 100).toInt()}% — keep arm extended while rotating"
                },
                color = Color.White.copy(alpha = 0.75f),
                style = MaterialTheme.typography.labelSmall
            )
        }

        Spacer(modifier = Modifier.height(12.dp))

        PrimaryGradientButton(
            text = when (phase) {
                LivenessPhase.CAPTURING -> "Capturing…"
                LivenessPhase.VERIFYING -> "Verifying your identity…"
                LivenessPhase.READY -> if (retryToken > 0) "Recapture face" else "Capture now"
                else -> when {
                    extraPersonAlert || faceCount > 1 -> "Another person detected — restarting scan"
                    faceCount == 0 -> "Center your face to start scan"
                    faceCount == 1 && faceFillRatio > MAX_FACE_FILL_FOR_WIDE_SCAN ->
                        "Move phone farther (arm's length)"
                    rotationComplete -> "Capture now"
                    else -> "Rotate ${(targetRotation - rotationDegrees).toInt().coerceAtLeast(0)}° more (same direction)…"
                }
            },
            onClick = {
                when {
                    phase == LivenessPhase.CAPTURING || phase == LivenessPhase.VERIFYING ->
                        return@PrimaryGradientButton
                    extraPersonAlert || faceCount > 1 ->
                        onScanWarning(extraPersonMessage)
                    faceCount == 0 -> onError("Stay in the oval before capturing.")
                    faceCount == 1 && faceFillRatio > MAX_FACE_FILL_FOR_WIDE_SCAN ->
                        onError("Hold the phone at arm's length for a wider room scan.")
                    !rotationComplete && !rotationTracker.isSensorAvailable -> {
                        rotationComplete = true
                        phase = LivenessPhase.READY
                    }
                    !rotationComplete ->
                        onError("Keep rotating the same way (${rotationDegrees.toInt()}° / ${targetRotation.toInt()}°).")
                    captureTriggered.compareAndSet(false, true) -> {
                        phase = LivenessPhase.CAPTURING
                        captureFacePhoto(
                            context = context,
                            imageCapture = imageCapture,
                            cameraExecutor = cameraExecutor,
                            mainExecutor = mainExecutor,
                            onCaptured = { url ->
                                phase = LivenessPhase.VERIFYING
                                onCaptured(url)
                            },
                            onError = { msg ->
                                unlockForRecapture(msg)
                                onError(msg)
                            }
                        )
                    }
                }
            },
            modifier = Modifier.fillMaxWidth()
        )
    }
}

@Composable
private fun RowBetween(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(label, color = Color.White.copy(alpha = 0.7f), style = MaterialTheme.typography.labelMedium)
        Text(value, color = ElectricCyan, fontWeight = FontWeight.SemiBold, style = MaterialTheme.typography.labelMedium)
    }
}

@Composable
private fun LivenessOverlay(
    status: String,
    faceCount: Int,
    progress: Float,
    degrees: Float,
    rotationComplete: Boolean,
    extraPersonAlert: Boolean,
    distanceOk: Boolean,
    tooClose: Boolean
) {
    Box(modifier = Modifier.fillMaxSize()) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = 0.15f))
        )

        Canvas(modifier = Modifier.fillMaxSize()) {
            val ovalW = size.width * 0.58f
            val ovalH = size.height * 0.52f
            val top = size.height * 0.16f
            val left = (size.width - ovalW) / 2f

            drawArc(
                color = Color.White.copy(alpha = 0.12f),
                startAngle = -90f,
                sweepAngle = 360f,
                useCenter = false,
                topLeft = Offset(left - 8f, top - 8f),
                size = Size(ovalW + 16f, ovalH + 16f),
                style = Stroke(width = 6.dp.toPx())
            )
            drawArc(
                color = when {
                    faceCount > 1 -> Color(0xFFFF8A80)
                    rotationComplete -> EmeraldGreen
                    distanceOk -> ElectricCyan
                    else -> Color(0xFFFFB74D)
                },
                startAngle = -90f,
                sweepAngle = 360f * progress.coerceIn(0f, 1f),
                useCenter = false,
                topLeft = Offset(left - 8f, top - 8f),
                size = Size(ovalW + 16f, ovalH + 16f),
                style = Stroke(width = 6.dp.toPx(), cap = StrokeCap.Round)
            )
            drawOval(
                color = when {
                    faceCount > 1 -> Color(0xFFFF8A80)
                    distanceOk -> EmeraldGreen.copy(alpha = 0.9f)
                    tooClose -> Color(0xFFFFB74D)
                    else -> ElectricCyan.copy(alpha = 0.75f)
                },
                topLeft = Offset(left, top),
                size = Size(ovalW, ovalH),
                style = Stroke(width = 3.dp.toPx(), cap = StrokeCap.Round)
            )
        }

        Column(
            modifier = Modifier
                .align(Alignment.TopCenter)
                .fillMaxWidth()
                .padding(12.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(Color.Black.copy(alpha = 0.65f))
                .padding(horizontal = 14.dp, vertical = 10.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            if (extraPersonAlert || faceCount > 1) {
                Icon(
                    imageVector = Icons.Default.Warning,
                    contentDescription = null,
                    tint = Color(0xFFFF8A80)
                )
                Text(
                    text = "Another person detected in frame",
                    color = Color(0xFFFF8A80),
                    fontWeight = FontWeight.Bold,
                    style = MaterialTheme.typography.titleSmall,
                    textAlign = TextAlign.Center
                )
                Text(
                    text = "Rotation scan restarted from the start. Stay alone, then rotate again.",
                    color = Color.White,
                    style = MaterialTheme.typography.bodySmall,
                    textAlign = TextAlign.Center
                )
            } else if (tooClose) {
                Icon(
                    imageVector = Icons.Default.Warning,
                    contentDescription = null,
                    tint = Color(0xFFFFB74D)
                )
                Text(
                    text = "Hold phone farther — arm's length",
                    color = Color(0xFFFFB74D),
                    fontWeight = FontWeight.Bold,
                    style = MaterialTheme.typography.titleSmall,
                    textAlign = TextAlign.Center
                )
                Text(
                    text = "Stretch your arm so the camera sees more of the room around you.",
                    color = Color.White,
                    style = MaterialTheme.typography.bodySmall,
                    textAlign = TextAlign.Center
                )
            } else {
                Icon(
                    imageVector = Icons.Default.Cameraswitch,
                    contentDescription = null,
                    tint = ElectricCyan,
                    modifier = Modifier.rotate(degrees.coerceIn(0f, 360f) * 0.4f)
                )
                Text(
                    text = if (distanceOk) {
                        "Wide view OK · rotate slowly to one side"
                    } else {
                        "Arm's length · then rotate one way"
                    },
                    color = Color.White,
                    fontWeight = FontWeight.SemiBold,
                    style = MaterialTheme.typography.titleSmall,
                    textAlign = TextAlign.Center
                )
                Text(
                    text = "Hold with one hand farther from your face. Same direction only — reverse is ignored.",
                    color = Color.White.copy(alpha = 0.82f),
                    style = MaterialTheme.typography.bodySmall,
                    textAlign = TextAlign.Center
                )
            }
        }

        Text(
            text = status,
            color = if (extraPersonAlert || faceCount > 1) Color(0xFFFF8A80) else Color.White,
            style = MaterialTheme.typography.labelMedium,
            textAlign = TextAlign.Center,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .padding(12.dp)
                .clip(RoundedCornerShape(10.dp))
                .background(Color.Black.copy(alpha = 0.72f))
                .padding(horizontal = 12.dp, vertical = 10.dp)
        )
    }
}

private fun captureFacePhoto(
    context: Context,
    imageCapture: ImageCapture,
    cameraExecutor: ExecutorService,
    mainExecutor: Executor,
    onCaptured: (String) -> Unit,
    onError: (String) -> Unit
) {
    val photoFile = File(context.cacheDir, "face_${System.currentTimeMillis()}.jpg")
    val output = ImageCapture.OutputFileOptions.Builder(photoFile).build()
    imageCapture.takePicture(
        output,
        cameraExecutor,
        object : ImageCapture.OnImageSavedCallback {
            override fun onImageSaved(outputFileResults: ImageCapture.OutputFileResults) {
                try {
                    val bytes = photoFile.readBytes()
                    val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                        ?: error("Unable to decode photo")
                    val url = bitmapToJpegDataUrl(bitmap)
                    mainExecutor.execute { onCaptured(url) }
                } catch (e: Exception) {
                    mainExecutor.execute { onError(e.message ?: "Capture failed") }
                } finally {
                    photoFile.delete()
                }
            }

            override fun onError(exception: ImageCaptureException) {
                mainExecutor.execute {
                    onError(exception.message ?: "Camera capture failed")
                }
            }
        }
    )
}

private fun bindFrontCamera(
    context: Context,
    lifecycleOwner: LifecycleOwner,
    previewView: PreviewView,
    imageCapture: ImageCapture,
    analysisExecutor: ExecutorService,
    mainExecutor: Executor,
    detector: FaceDetector,
    lastAnalysisAt: AtomicLong,
    onFaceDetected: (count: Int, faceFillRatio: Float) -> Unit,
    onStatus: (String) -> Unit,
    onReady: (Boolean) -> Unit,
    onError: (String) -> Unit
) {
    val future = ProcessCameraProvider.getInstance(context)
    future.addListener(
        {
            try {
                val provider = future.get()
                provider.unbindAll()

                val preview = Preview.Builder().build().also {
                    it.surfaceProvider = previewView.surfaceProvider
                }

                val analysis = ImageAnalysis.Builder()
                    .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                    .build()
                    .also { useCase ->
                        useCase.setAnalyzer(analysisExecutor) { imageProxy ->
                            analyzeFrame(
                                imageProxy = imageProxy,
                                detector = detector,
                                lastAnalysisAt = lastAnalysisAt,
                                mainExecutor = mainExecutor,
                                onFaceDetected = onFaceDetected
                            )
                        }
                    }

                val selectors = listOf(
                    CameraSelector.Builder()
                        .requireLensFacing(CameraSelector.LENS_FACING_FRONT)
                        .build(),
                    CameraSelector.DEFAULT_FRONT_CAMERA
                )

                var bound = false
                var lastError: Throwable? = null
                for (selector in selectors) {
                    try {
                        val camera = provider.bindToLifecycle(
                            lifecycleOwner,
                            selector,
                            preview,
                            imageCapture,
                            analysis
                        )
                        // Widest available zoom (ultrawide if present; otherwise 1x)
                        runCatching {
                            val zoom = camera.cameraInfo.zoomState.value
                            val minZoom = zoom?.minZoomRatio ?: 1f
                            camera.cameraControl.setZoomRatio(minZoom)
                        }
                        onReady(true)
                        bound = true
                        break
                    } catch (e: Exception) {
                        lastError = e
                        Log.w(TAG, "Bind failed: ${e.message}")
                    }
                }

                if (!bound) {
                    val msg = lastError?.message ?: "Front camera not available"
                    onStatus(msg)
                    onReady(false)
                    onError(msg)
                }
            } catch (e: Exception) {
                onStatus(e.message ?: "Camera failed")
                onReady(false)
                onError(e.message ?: "Camera failed")
            }
        },
        ContextCompat.getMainExecutor(context)
    )
}

@OptIn(ExperimentalGetImage::class)
private fun analyzeFrame(
    imageProxy: ImageProxy,
    detector: FaceDetector,
    lastAnalysisAt: AtomicLong,
    mainExecutor: Executor,
    onFaceDetected: (count: Int, faceFillRatio: Float) -> Unit
) {
    val now = System.currentTimeMillis()
    if (now - lastAnalysisAt.get() < ANALYSIS_MIN_INTERVAL_MS) {
        imageProxy.close()
        return
    }
    lastAnalysisAt.set(now)

    val mediaImage = imageProxy.image ?: run {
        imageProxy.close()
        return
    }

    val rotation = imageProxy.imageInfo.rotationDegrees
    val input = InputImage.fromMediaImage(mediaImage, rotation)
    val imageH = input.height.coerceAtLeast(1).toFloat()
    detector.process(input)
        .addOnSuccessListener { faces ->
            val maxFill = faces.maxOfOrNull { face ->
                face.boundingBox.height().toFloat() / imageH
            } ?: 0f
            mainExecutor.execute { onFaceDetected(faces.size, maxFill) }
        }
        .addOnFailureListener { e ->
            Log.w(TAG, "Face detection failed: ${e.message}")
        }
        .addOnCompleteListener { imageProxy.close() }
}

private fun Context.findComponentActivity(): ComponentActivity? {
    var ctx = this
    while (ctx is ContextWrapper) {
        if (ctx is ComponentActivity) return ctx
        ctx = ctx.baseContext
    }
    return null
}

private fun bitmapToJpegDataUrl(bitmap: android.graphics.Bitmap): String {
    val scaled = if (bitmap.width > 960) {
        val ratio = 960f / bitmap.width
        android.graphics.Bitmap.createScaledBitmap(
            bitmap,
            960,
            (bitmap.height * ratio).toInt(),
            true
        )
    } else bitmap
    val out = ByteArrayOutputStream()
    scaled.compress(android.graphics.Bitmap.CompressFormat.JPEG, 85, out)
    return "data:image/jpeg;base64,${Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)}"
}
