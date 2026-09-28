package com.blockvote.android.util

import android.location.Location
import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Geocoder
import android.os.Build
import androidx.core.content.ContextCompat
import com.blockvote.android.BuildConfig
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale
import kotlin.coroutines.resume

data class CoarseLocation(
    val village: String = "",
    val city: String = "",
    val state: String = "",
    val region: String = "",
    val localityType: String = ""
)

object CoarseLocationHelper {

    fun hasPermission(context: Context): Boolean =
        ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

    suspend fun resolve(context: Context): CoarseLocation? {
        if (!hasPermission(context)) return null

        val fused = LocationServices.getFusedLocationProviderClient(context)
        val cancellation = CancellationTokenSource()
        val location = suspendCancellableCoroutine<Location?> { continuation ->
            fused.getCurrentLocation(Priority.PRIORITY_BALANCED_POWER_ACCURACY, cancellation.token)
                .addOnSuccessListener { continuation.resume(it) }
                .addOnFailureListener { continuation.resume(null) }
            continuation.invokeOnCancellation { cancellation.cancel() }
        } ?: return null

        if (!Geocoder.isPresent()) {
            return reverseOnServer(location.latitude, location.longitude)
        }

        val addresses = try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                suspendCancellableCoroutine<List<android.location.Address>> { continuation ->
                    Geocoder(context, Locale.getDefault()).getFromLocation(
                        location.latitude,
                        location.longitude,
                        1,
                        object : Geocoder.GeocodeListener {
                            override fun onGeocode(results: MutableList<android.location.Address>) {
                                if (continuation.isActive) {
                                    continuation.resume(results)
                                }
                            }

                            override fun onError(errorMessage: String?) {
                                if (continuation.isActive) {
                                    continuation.resume(emptyList())
                                }
                            }
                        }
                    )
                }
            } else {
                @Suppress("DEPRECATION")
                Geocoder(context, Locale.getDefault()).getFromLocation(
                    location.latitude,
                    location.longitude,
                    1
                ).orEmpty()
            }
        } catch (_: Exception) {
            emptyList()
        }

        val address = addresses.firstOrNull()
            ?: return reverseOnServer(location.latitude, location.longitude)
        val village = listOf(
            address.subLocality,
            address.thoroughfare,
            address.featureName
        ).firstOrNull { !it.isNullOrBlank() }.orEmpty()

        val city = listOf(
            address.locality,
            address.subAdminArea,
            address.adminArea
        ).firstOrNull { !it.isNullOrBlank() }.orEmpty()

        val state = address.adminArea.orEmpty()
        val localityType = when {
            address.locality != null -> "urban"
            village.isNotBlank() -> "rural"
            else -> ""
        }

        if (village.isBlank() && city.isBlank() && state.isBlank()) {
            return reverseOnServer(location.latitude, location.longitude)
        }

        return CoarseLocation(
            village = village,
            city = city,
            state = state,
            region = state,
            localityType = localityType
        )
    }

    private suspend fun reverseOnServer(latitude: Double, longitude: Double): CoarseLocation? =
        withContext(Dispatchers.IO) {
            val connection = (URL("${BuildConfig.API_BASE_URL.trimEnd('/')}/api/location/reverse")
                .openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("Accept", "application/json")
                connectTimeout = 12000
                readTimeout = 12000
            }
            try {
                connection.outputStream.use { stream ->
                    stream.write("""{"lat":$latitude,"lng":$longitude}""".toByteArray())
                }
                if (connection.responseCode !in 200..299) return@withContext null
                val payload = connection.inputStream.bufferedReader().use { it.readText() }
                val location = JSONObject(payload).optJSONObject("location") ?: return@withContext null
                val village = location.optString("village")
                val city = location.optString("city")
                val state = location.optString("state")
                if (village.isBlank() && city.isBlank() && state.isBlank()) return@withContext null
                CoarseLocation(
                    village = village,
                    city = city,
                    state = state,
                    region = location.optString("region").ifBlank { state },
                    localityType = location.optString("localityType")
                )
            } catch (_: Exception) {
                null
            } finally {
                connection.disconnect()
            }
        }
}
