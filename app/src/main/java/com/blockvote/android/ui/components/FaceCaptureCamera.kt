package com.blockvote.android.ui.components

import android.content.Context
import android.content.ContextWrapper
import android.graphics.BitmapFactory
import android.util.Base64
import android.util.Log
import android.view.ViewGroup
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.result.launch
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import com.blockvote.android.ui.theme.ElectricCyan
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

private const val TAG = "FaceCaptureCamera"

@Composable
fun FaceCaptureCamera(
    enabled: Boolean,
    onCaptured: (dataUrl: String) -> Unit,
    onError: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val activity = remember(context) { context.findComponentActivity() }
        ?: error("FaceCaptureCamera must be hosted in an Activity")
    val lifecycleOwner: LifecycleOwner = activity

    val mainExecutor = remember { ContextCompat.getMainExecutor(context) }
    val cameraExecutor = remember { Executors.newSingleThreadExecutor() }
    val imageCapture = remember {
        ImageCapture.Builder()
            .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
            .build()
    }
    val bindStarted = remember { AtomicBoolean(false) }

    var status by remember { mutableStateOf("Opening front camera…") }
    var ready by remember { mutableStateOf(false) }

    val systemCameraLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.TakePicturePreview()
    ) { bitmap ->
        if (bitmap == null) {
            onError("No photo returned from system camera")
            return@rememberLauncherForActivityResult
        }
        onCaptured(bitmapToJpegDataUrl(bitmap))
    }

    DisposableEffect(lifecycleOwner) {
        onDispose {
            ready = false
            bindStarted.set(false)
            runCatching {
                ProcessCameraProvider.getInstance(context).get().unbindAll()
            }
        }
    }

    DisposableEffect(Unit) {
        onDispose { cameraExecutor.shutdown() }
    }

    Column(modifier = modifier) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(420.dp)
                .clip(RoundedCornerShape(16.dp))
                .border(2.dp, ElectricCyan, RoundedCornerShape(16.dp))
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
                            onStatus = { status = it },
                            onReady = { ready = it },
                            onError = { msg ->
                                bindStarted.set(false)
                                onError(msg)
                            }
                        )
                    }
                    previewView.post { tryBind() }
                }
            )
        }

        Spacer(modifier = Modifier.height(10.dp))
        Text(
            text = status,
            style = MaterialTheme.typography.bodySmall,
            color = if (ready) Color.White.copy(alpha = 0.75f) else Color(0xFFFFB74D),
            modifier = Modifier.padding(horizontal = 4.dp)
        )
        Spacer(modifier = Modifier.height(12.dp))
        PrimaryGradientButton(
            text = "Capture & Verify Face",
            onClick = {
                if (!ready) {
                    runCatching { systemCameraLauncher.launch() }
                        .onFailure { onError("Camera is not ready. Allow camera permission and retry.") }
                    return@PrimaryGradientButton
                }
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
                                val dataUrl = bitmapToJpegDataUrl(bitmap)
                                photoFile.delete()
                                mainExecutor.execute { onCaptured(dataUrl) }
                            } catch (e: Exception) {
                                photoFile.delete()
                                mainExecutor.execute {
                                    onError(e.message ?: "Capture failed")
                                }
                            }
                        }

                        override fun onError(exception: ImageCaptureException) {
                            mainExecutor.execute {
                                onError(exception.message ?: "Camera capture failed")
                            }
                        }
                    }
                )
            },
            modifier = Modifier.fillMaxWidth()
        )
        TextButton(
            onClick = {
                runCatching { systemCameraLauncher.launch() }
                    .onFailure { onError(it.message ?: "Could not open system camera") }
            },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Preview dark? Open system front camera", color = ElectricCyan)
        }
    }
}

private fun bindFrontCamera(
    context: Context,
    lifecycleOwner: LifecycleOwner,
    previewView: PreviewView,
    imageCapture: ImageCapture,
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

                val selectors = listOf(
                    CameraSelector.Builder()
                        .requireLensFacing(CameraSelector.LENS_FACING_FRONT)
                        .build(),
                    CameraSelector.DEFAULT_FRONT_CAMERA,
                    CameraSelector.DEFAULT_BACK_CAMERA
                )

                var bound = false
                var lastError: Throwable? = null
                for (selector in selectors) {
                    try {
                        provider.bindToLifecycle(
                            lifecycleOwner,
                            selector,
                            preview,
                            imageCapture
                        )
                        Log.i(
                            TAG,
                            "Camera bound size=${previewView.width}x${previewView.height}"
                        )
                        onStatus("Camera ready — one face, eyes open, no glasses")
                        onReady(true)
                        bound = true
                        break
                    } catch (e: Exception) {
                        lastError = e
                        Log.w(TAG, "Bind attempt failed: ${e.message}")
                    }
                }

                if (!bound) {
                    val msg = lastError?.message ?: "No camera available"
                    Log.e(TAG, "All camera bind attempts failed", lastError)
                    onStatus("$msg — use system camera button below")
                    onReady(false)
                    onError(msg)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Camera provider failed", e)
                onStatus(e.message ?: "Camera provider failed")
                onReady(false)
                onError(e.message ?: "Camera provider failed")
            }
        },
        ContextCompat.getMainExecutor(context)
    )
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
    } else {
        bitmap
    }
    val out = ByteArrayOutputStream()
    scaled.compress(android.graphics.Bitmap.CompressFormat.JPEG, 85, out)
    val b64 = Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
    return "data:image/jpeg;base64,$b64"
}
