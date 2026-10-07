package com.blockvote.android.domain.repository

import com.blockvote.android.domain.model.Ballot
import com.blockvote.android.domain.model.Candidate
import com.blockvote.android.domain.model.Election
import com.blockvote.android.domain.model.VoteReceipt
import com.blockvote.android.domain.model.VoterIdentity
import com.blockvote.android.util.CoarseLocation
import kotlinx.coroutines.flow.Flow

interface VotingRepository {
    suspend fun getElection(electionId: String): Result<Election>

    /** Every candidate in the election (for the public detail screen). */
    suspend fun getCandidates(electionId: String): Result<List<Candidate>>

    /** Who this voter ID is on the roll and which home area they vote for. */
    suspend fun lookupVoter(voterId: String, electionId: String): Result<VoterIdentity>

    /** Only the candidates of the voter's home area — never the phone's location. */
    suspend fun getBallot(electionId: String, voterId: String): Result<Ballot>

    suspend fun verifyFace(
        nullifierHash: String,
        imageDataUrl: String,
        electionId: String
    ): Result<String>

    /** Sends the 6-digit code; returns the masked address it went to. */
    suspend fun sendOtp(voterId: String, electionId: String): Result<String>

    suspend fun castVote(
        voterId: String,
        otp: String,
        electionId: String,
        candidateId: Int,
        biometricToken: String,
        electionTitle: String = "",
        location: CoarseLocation? = null
    ): Result<VoteReceipt>

    suspend fun verifyOnChain(txHash: String): Result<Boolean>

    suspend fun submitTwinRequest(
        nullifierHash: String,
        electionId: String,
        voterId: String,
        notes: String = ""
    ): Result<String>

    suspend fun getTwinVerificationStatus(nullifierHash: String): Result<String>

    fun observeReceipt(id: String): Flow<VoteReceipt?>
}

/** Legacy dashboard contract kept for existing screens during migration. */
interface ElectionRepository {
    fun getElections(): Flow<List<Election>>
    fun getElectionById(id: String): Flow<Election?>
    fun getReceiptById(id: String): Flow<VoteReceipt?>
    fun castVote(electionId: String, candidateId: String): Flow<Result<VoteReceipt>>
}
