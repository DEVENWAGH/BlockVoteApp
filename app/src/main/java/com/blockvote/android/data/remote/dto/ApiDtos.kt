package com.blockvote.android.data.remote.dto

import com.squareup.moshi.Json

data class ElectionDetailResponse(
    val success: Boolean? = null,
    val data: ElectionDetailDto? = null,
    val error: String? = null
)

data class ElectionDetailDto(
    val electionId: String = "",
    val title: String = "",
    val description: String? = null,
    val phase: Int = 0,
    val guardianApproved: Boolean = false,
    val endTime: String? = null,
    val startTime: String? = null
)

data class ElectionsResponse(
    val elections: List<ElectionDto> = emptyList(),
    val error: String? = null
)

data class ElectionDto(
    val id: String = "",
    val title: String = "",
    val description: String? = null,
    val bannerUrl: String? = null,
    val startTime: Long? = null,
    val endTime: Long? = null,
    val phase: Int = 0,
    val guardianApproved: Boolean = false,
    val pendingApproval: Boolean = false,
    val ipfsCid: String? = null
)

data class CandidatesResponse(
    val candidates: List<CandidateDto> = emptyList(),
    val error: String? = null
)

data class CandidateDto(
    val id: Int = 0,
    val name: String = "",
    val party: String? = null,
    val symbol: String? = null,
    val manifesto: String? = null,
    val photoUrl: String? = null,
    val voteCount: Int? = null
)

data class VoterLookupResponse(
    val success: Boolean? = null,
    val memberId: String? = null,
    val nullifierHash: String? = null,
    val error: String? = null
)

data class BiometricVerifyRequest(
    val nullifierHash: String,
    val image: String,
    val electionId: String
)

data class BiometricVerifyResponse(
    val success: Boolean? = null,
    val token: String? = null,
    val error: String? = null,
    val isDuplicate: Boolean? = null
)

data class SendOtpRequest(
    val email: String,
    val electionId: String
)

data class SendOtpResponse(
    val success: Boolean? = null,
    val message: String? = null,
    val expiresAt: String? = null,
    val error: String? = null
)

data class VerifyOtpRequest(
    val email: String,
    val otp: String,
    val electionId: String,
    val candidateId: Int
)

data class VerifyOtpResponse(
    val success: Boolean? = null,
    val message: String? = null,
    val txHash: String? = null,
    val verifyUrl: String? = null,
    val error: String? = null
)

data class AuditVerifyResponse(
    val success: Boolean? = null,
    val verified: Boolean? = null,
    val electionTitle: String? = null,
    val blockNumber: Long? = null,
    val timestamp: String? = null,
    val error: String? = null
)

data class ApiErrorBody(
    val error: String? = null,
    val message: String? = null
)

data class TwinRequestBody(
    val nullifierHash: String,
    val electionId: String? = null,
    val email: String? = null,
    val notes: String? = null
)

data class TwinRequestResponse(
    val success: Boolean? = null,
    val message: String? = null,
    val status: String? = null,
    val error: String? = null
)

data class BiometricStatusResponse(
    val registered: Boolean? = null,
    val verified: Boolean? = null,
    val twinVerificationStatus: String? = null,
    val bypassDuplicateCheck: Boolean? = null,
    val error: String? = null
)
