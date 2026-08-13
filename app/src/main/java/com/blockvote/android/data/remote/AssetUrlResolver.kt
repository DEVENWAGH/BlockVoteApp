package com.blockvote.android.data.remote

import com.blockvote.android.BuildConfig
import java.net.URL
import java.net.URLDecoder
import java.net.URLEncoder

/**
 * Rewrites legacy direct S3 URLs to the BlockVote asset proxy (same as web resolveAssetUrl).
 */
object AssetUrlResolver {
    private val publicPrefixes = listOf("party-symbols/", "candidates/")

    fun resolve(url: String): String {
        if (url.isBlank()) return url
        if (url.contains("/api/assets/")) return absolutize(url)
        val s3Key = extractS3Key(url) ?: return url
        if (!isPublicAssetKey(s3Key)) return url
        val encodedPath = s3Key.split("/").joinToString("/") { segment ->
            URLEncoder.encode(segment, Charsets.UTF_8.name()).replace("+", "%20")
        }
        return absolutize("api/assets/$encodedPath")
    }

    private fun absolutize(pathOrUrl: String): String {
        if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
            return pathOrUrl
        }
        val base = BuildConfig.API_BASE_URL.trimEnd('/')
        val path = pathOrUrl.trimStart('/')
        return "$base/$path"
    }

    private fun extractS3Key(url: String): String? {
        if (!url.startsWith("http")) return null
        return try {
            val parsed = URL(url)
            val host = parsed.host ?: return null
            if (!host.matches(Regex("""^.+\.s3(\.[a-z0-9-]+)?\.amazonaws\.com$""", RegexOption.IGNORE_CASE))) {
                return null
            }
            URLDecoder.decode(parsed.path.trimStart('/'), Charsets.UTF_8.name()).takeIf { it.isNotBlank() }
        } catch (_: Exception) {
            null
        }
    }

    private fun isPublicAssetKey(key: String): Boolean =
        publicPrefixes.any { key.startsWith(it) }
}
