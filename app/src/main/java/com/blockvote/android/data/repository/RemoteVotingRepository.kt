package com.blockvote.android.data.repository

import com.blockvote.android.data.remote.ApiException
import com.blockvote.android.data.remote.AssetUrlResolver
import com.blockvote.android.data.remote.BlockVoteApi
import com.blockvote.android.data.remote.dto.BiometricVerifyRequest
import com.blockvote.android.data.remote.dto.SendOtpRequest
import com.blockvote.android.data.remote.dto.VerifyOtpRequest
import com.blockvote.android.data.remote.dto.CoarseLocationDto
import com.blockvote.android.domain.model.Candidate
import com.blockvote.android.domain.model.Election
import com.blockvote.android.domain.model.ElectionStatus
import com.blockvote.android.domain.model.VoteReceipt
import com.blockvote.android.domain.model.VoterIdentity
import com.blockvote.android.domain.repository.VotingRepository
import com.blockvote.android.util.CoarseLocation
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class RemoteVotingRepository @Inject constructor(
    private val api: BlockVoteApi
) : VotingRepository {

    private val receipts = MutableStateFlow<Map<String, VoteReceipt>>(emptyMap())

    override suspend fun getElection(electionId: String): Result<Election> = apiCall {
        val body = api.getElection(electionId)
        val dto = body.data ?: throw ApiException(body.error ?: "Election not found", 404)
        if (dto.phase != 1 || !dto.guardianApproved) {
            throw ApiException("This election is not open for voting yet", 403)
        }
        val window = dto.votingWindow
        if (window != null && !window.open) {
            throw ApiException(window.reason ?: "Polls are closed right now", 403)
        }
        Election(
            id = dto.electionId.ifBlank { electionId },
            title = dto.title,
            description = dto.description.orEmpty(),
            status = ElectionStatus.LIVE,
            endDate = 0L,
            phase = dto.phase,
            guardianApproved = dto.guardianApproved,
            votingHours = window?.hours.orEmpty()
        )
    }

    override suspend fun getCandidates(electionId: String): Result<List<Candidate>> =
        apiCall {
            api.getCandidates(electionId).candidates.map { c ->
                Candidate(
                    id = c.id.toString(),
                    name = c.name,
                    party = c.party.orEmpty(),
                    imageUrl = AssetUrlResolver.resolve(c.photoUrl.orEmpty()),
                    symbolUrl = AssetUrlResolver.resolve(c.symbol.orEmpty()),
                    description = c.manifesto.orEmpty()
                )
            }
        }

    override suspend fun lookupVoter(
        email: String,
        electionId: String
    ): Result<VoterIdentity> = apiCall {
        val body = api.lookupVoter(email.lowercase().trim(), electionId)
        if (body.nullifierHash.isNullOrBlank()) {
            throw ApiException(body.error ?: "Voter not registered for this election", 404)
        }
        VoterIdentity(
            email = email.lowercase().trim(),
            memberId = body.memberId.orEmpty(),
            nullifierHash = body.nullifierHash
        )
    }

    override suspend fun verifyFace(
        nullifierHash: String,
        imageDataUrl: String,
        electionId: String
    ): Result<String> = apiCall {
        val body = api.verifyBiometric(
            BiometricVerifyRequest(
                nullifierHash = nullifierHash,
                image = imageDataUrl,
                electionId = electionId
            )
        )
        body.token ?: throw ApiException(body.error ?: "Face verification failed", 400)
    }

    override suspend fun sendOtp(email: String, electionId: String): Result<Unit> =
        apiCall {
            val body = api.sendOtp(
                SendOtpRequest(
                    email = email.lowercase().trim(),
                    electionId = electionId
                )
            )
            if (body.success != true && !body.error.isNullOrBlank()) {
                throw ApiException(body.error)
            }
        }

    override suspend fun castVote(
        email: String,
        otp: String,
        electionId: String,
        candidateId: Int,
        biometricToken: String,
        electionTitle: String,
        location: CoarseLocation?
    ): Result<VoteReceipt> = apiCall {
        val body = api.verifyOtpAndCastVote(
            biometricToken = biometricToken,
            body = VerifyOtpRequest(
                email = email.lowercase().trim(),
                otp = otp.trim(),
                electionId = electionId,
                candidateId = candidateId,
                location = location?.let {
                    CoarseLocationDto(
                        village = it.village.ifBlank { null },
                        city = it.city.ifBlank { null },
                        state = it.state.ifBlank { null },
                        region = it.region.ifBlank { null },
                        localityType = it.localityType.ifBlank { null }
                    )
                }
            )
        )
        val txHash = body.txHash ?: throw ApiException(body.error ?: "Vote failed", 500)
        val receipt = VoteReceipt(
            transactionId = txHash,
            voterId = email.lowercase().trim(),
            electionId = electionId,
            candidateId = candidateId.toString(),
            timestamp = System.currentTimeMillis(),
            hash = txHash,
            verifyUrl = body.verifyUrl.orEmpty(),
            electionTitle = electionTitle,
            statusMessage = body.message.orEmpty()
        )
        receipts.value = receipts.value + (txHash to receipt)
        receipt
    }

    override suspend fun verifyOnChain(txHash: String): Result<Boolean> = apiCall {
        val body = api.verifyReceipt(txHash)
        body.verified == true || body.success == true
    }

    override suspend fun submitTwinRequest(
        nullifierHash: String,
        electionId: String,
        email: String,
        notes: String
    ): Result<String> = apiCall {
        val body = api.submitTwinRequest(
            com.blockvote.android.data.remote.dto.TwinRequestBody(
                nullifierHash = nullifierHash,
                electionId = electionId,
                email = email,
                notes = notes.ifBlank { null }
            )
        )
        if (body.success != true && !body.error.isNullOrBlank()) {
            throw ApiException(body.error)
        }
        body.message ?: "Twin verification override requested successfully."
    }

    override suspend fun getTwinVerificationStatus(nullifierHash: String): Result<String> = apiCall {
        val body = api.getBiometricStatus(nullifierHash)
        body.twinVerificationStatus ?: "none"
    }

    override fun observeReceipt(id: String): Flow<VoteReceipt?> =
        receipts.map { it[id] }

    private suspend fun <T> apiCall(block: () -> T): Result<T> = withContext(Dispatchers.IO) {
        runCatching(block)
    }
}
