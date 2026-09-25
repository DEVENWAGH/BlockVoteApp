package com.blockvote.android.util

import android.location.Location
import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Geocoder
import android.os.Build
import androidx.core.content.ContextCompat
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import kotlinx.coroutines.suspendCancellableCoroutine
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

        if (!Geocoder.isPresent()) return null

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

        val address = addresses.firstOrNull() ?: return null
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

        if (village.isBlank() && city.isBlank() && state.isBlank()) return null

        return CoarseLocation(
            village = village,
            city = city,
            state = state,
            region = state,
            localityType = localityType
        )
    }
}
