package com.blockvote.android.domain.model

import kotlinx.serialization.Serializable

@Serializable
enum class ElectionStatus {
    LIVE, UPCOMING, CLOSED
}

@Serializable
data class Election(
    val id: String,
    val title: String,
    val description: String,
    val status: ElectionStatus,
    val candidates: List<Candidate> = emptyList(),
    val endDate: Long = 0L,
    val phase: Int = 0,
    val guardianApproved: Boolean = false,
    val bannerUrl: String = ""
)

@Serializable
data class Candidate(
    val id: String,
    val name: String,
    val party: String,
    val imageUrl: String,
    val symbolUrl: String = "",
    val description: String
)

@Serializable
data class VoterIdentity(
    val email: String,
    val memberId: String,
    val nullifierHash: String
)

@Serializable
data class VoteReceipt(
    val transactionId: String,
    val voterId: String,
    val electionId: String,
    val candidateId: String,
    val timestamp: Long,
    val hash: String,
    val verifyUrl: String = "",
    val electionTitle: String = "",
    val onChainVerified: Boolean? = null
)
