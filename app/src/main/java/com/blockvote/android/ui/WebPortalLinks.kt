package com.blockvote.android.ui

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import com.blockvote.android.BuildConfig

/** Public HTTPS election page derived from the flavor API host (dev LAN vs production). */
object WebPortalLinks {
    fun portalUrl(electionId: String? = null): String {
        val base = BuildConfig.API_BASE_URL.trimEnd('/')
        return if (electionId.isNullOrBlank()) {
            "$base/elections"
        } else {
            "$base/elections/${Uri.encode(electionId)}"
        }
    }

    fun open(context: Context, electionId: String? = null) {
        try {
            context.startActivity(
                Intent(Intent.ACTION_VIEW, Uri.parse(portalUrl(electionId)))
            )
        } catch (_: ActivityNotFoundException) {
            // No browser available
        }
    }
}
