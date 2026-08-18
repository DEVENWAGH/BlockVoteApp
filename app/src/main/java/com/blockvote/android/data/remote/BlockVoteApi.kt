package com.blockvote.android.data.remote

import com.blockvote.android.data.remote.dto.ApiErrorBody
import com.blockvote.android.data.remote.dto.AuditVerifyResponse
import com.blockvote.android.data.remote.dto.BiometricVerifyRequest
import com.blockvote.android.data.remote.dto.BiometricVerifyResponse
import com.blockvote.android.data.remote.dto.CandidatesResponse
import com.blockvote.android.data.remote.dto.ElectionDetailResponse
import com.blockvote.android.data.remote.dto.ElectionsResponse
import com.blockvote.android.data.remote.dto.SendOtpRequest
import com.blockvote.android.data.remote.dto.SendOtpResponse
import com.blockvote.android.data.remote.dto.VerifyOtpRequest
import com.blockvote.android.data.remote.dto.VerifyOtpResponse
import com.blockvote.android.data.remote.dto.TwinRequestBody
import com.blockvote.android.data.remote.dto.TwinRequestResponse
import com.blockvote.android.data.remote.dto.BiometricStatusResponse
import com.blockvote.android.data.remote.dto.VoterLookupResponse
import com.squareup.moshi.Moshi
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

class BlockVoteApi(
    private val client: OkHttpClient,
    private val moshi: Moshi,
    private val baseUrl: String
) {
    private val jsonMedia = "application/json; charset=utf-8".toMediaType()

    fun getPublicElections(): ElectionsResponse =
        getJson("api/elections/public", emptyMap(), ElectionsResponse::class.java)

    fun getElection(electionId: String): ElectionDetailResponse =
        getJson("api/elections/$electionId", emptyMap(), ElectionDetailResponse::class.java)

    fun getCandidates(electionId: String): CandidatesResponse =
        getJson(
            "api/org/admin/elections/$electionId/candidates",
            emptyMap(),
            CandidatesResponse::class.java
        )

    fun lookupVoter(email: String, electionId: String): VoterLookupResponse =
        getJson(
            "api/voters/lookup",
            mapOf(
                "email" to email,
                "electionId" to electionId
            ),
            VoterLookupResponse::class.java
        )

    fun verifyBiometric(body: BiometricVerifyRequest): BiometricVerifyResponse =
        postJson("api/biometric/verify", body, BiometricVerifyResponse::class.java)

    fun sendOtp(body: SendOtpRequest): SendOtpResponse =
        postJson("api/auth/send-otp", body, SendOtpResponse::class.java)

    fun verifyOtpAndCastVote(biometricToken: String, body: VerifyOtpRequest): VerifyOtpResponse =
        postJson(
            "api/auth/verify-otp",
            body,
            VerifyOtpResponse::class.java,
            mapOf("x-biometric-token" to biometricToken)
        )

    fun verifyReceipt(txHash: String): AuditVerifyResponse =
        getJson("api/audit/verify", mapOf("txHash" to txHash), AuditVerifyResponse::class.java)

    fun submitTwinRequest(body: TwinRequestBody): TwinRequestResponse =
        postJson("api/biometric/twin-request", body, TwinRequestResponse::class.java)

    fun getBiometricStatus(nullifierHash: String): BiometricStatusResponse =
        getJson(
            "api/biometric/status",
            mapOf("nullifierHash" to nullifierHash),
            BiometricStatusResponse::class.java
        )

    private fun <T> getJson(
        path: String,
        query: Map<String, String>,
        type: Class<T>
    ): T {
        val urlBuilder = (join(path)).toHttpUrl().newBuilder()
        query.forEach { (k, v) -> urlBuilder.addQueryParameter(k, v) }
        val request = Request.Builder().url(urlBuilder.build()).get().build()
        return execute(request, type)
    }

    private fun <T> postJson(
        path: String,
        body: Any,
        type: Class<T>,
        headers: Map<String, String> = emptyMap()
    ): T {
        @Suppress("UNCHECKED_CAST")
        val adapter = moshi.adapter(body.javaClass as Class<Any>)
        val json = adapter.toJson(body)
        val requestBuilder = Request.Builder()
            .url(join(path))
            .post(json.toRequestBody(jsonMedia))
        headers.forEach { (k, v) -> requestBuilder.header(k, v) }
        return execute(requestBuilder.build(), type)
    }

    private fun <T> execute(request: Request, type: Class<T>): T {
        client.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                val parsed = runCatching {
                    moshi.adapter(ApiErrorBody::class.java).fromJson(raw)
                }.getOrNull()
                throw ApiException(
                    parsed?.error ?: parsed?.message ?: raw.ifBlank { response.message },
                    response.code
                )
            }
            return moshi.adapter(type).fromJson(raw)
                ?: throw ApiException("Empty response from ${request.url}", response.code)
        }
    }

    private fun join(path: String): String =
        baseUrl.trimEnd('/') + "/" + path.trimStart('/')
}
