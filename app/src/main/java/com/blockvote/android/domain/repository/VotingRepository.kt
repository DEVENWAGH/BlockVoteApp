package com.blockvote.android.domain.repository

import com.blockvote.android.domain.model.Candidate
import com.blockvote.android.domain.model.Election
import com.blockvote.android.domain.model.VoteReceipt
import com.blockvote.android.domain.model.VoterIdentity
import com.blockvote.android.util.CoarseLocation
import kotlinx.coroutines.flow.Flow

interface VotingRepository {
    suspend fun getElection(electionId: String): Result<Election>
    suspend fun getCandidates(electionId: String): Result<List<Candidate>>
    suspend fun lookupVoter(email: String, electionId: String): Result<VoterIdentity>
    suspend fun verifyFace(
        nullifierHash: String,
        imageDataUrl: String,
        electionId: String
    ): Result<String>
    suspend fun sendOtp(email: String, electionId: String): Result<Unit>
    suspend fun castVote(
        email: String,
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
        email: String,
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
