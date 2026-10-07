package com.blockvote.android.domain.model

import kotlinx.serialization.Serializable

@Serializable
enum class ElectionStatus {
    LIVE, UPCOMING, CLOSED
}

/** Plain-language status label shared with the web: Not open / Voting open / Closed. */
fun ElectionStatus.label(): String = when (this) {
    ElectionStatus.LIVE -> "Voting open"
    ElectionStatus.UPCOMING -> "Not open"
    ElectionStatus.CLOSED -> "Closed"
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
    val bannerUrl: String = "",
    /** Daily polling hours from the server, e.g. "7:00 AM – 6:00 PM IST". */
    val votingHours: String = "",
    /** general | panchayat | municipal | assembly | loksabha */
    val level: String = "general"
)

@Serializable
data class Candidate(
    val id: String,
    val name: String,
    val party: String,
    val imageUrl: String,
    val symbolUrl: String = "",
    val description: String,
    val partyCode: String = "",
    val constituencyCode: String = ""
)

/**
 * The voter slip: who the roll says this person is and which home area they
 * vote for. Shown as "Is this you?" before the face check.
 */
@Serializable
data class VoterIdentity(
    val voterId: String,
    val maskedVoterId: String,
    val name: String,
    val maskedEmail: String,
    val memberId: String,
    val nullifierHash: String,
    val homePlace: String = "",
    val homePollingStation: String = "",
    val seatCode: String = "",
    val seatName: String = "",
    val level: String = "general",
    val hasVoted: Boolean = false,
    val stationVoteFinal: Boolean = false
)

/** The home ballot: only the candidates standing in the voter's own area. */
@Serializable
data class Ballot(
    val electionId: String,
    val electionTitle: String,
    val open: Boolean,
    val statusLabel: String,
    val seatCode: String,
    val seatName: String,
    val homePlace: String,
    val candidates: List<Candidate>,
    val message: String = ""
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
    val onChainVerified: Boolean? = null,
    /** Server note, e.g. whether the vote replaced an earlier one and changes left. */
    val statusMessage: String = "",
    /** The same value as [hash], named the way voters see it. */
    val receiptCode: String = hash,
    val isFinal: Boolean = false
)
