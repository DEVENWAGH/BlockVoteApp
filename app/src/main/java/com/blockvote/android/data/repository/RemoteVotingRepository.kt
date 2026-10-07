package com.blockvote.android.data.repository

import com.blockvote.android.data.remote.ApiException
import com.blockvote.android.data.remote.AssetUrlResolver
import com.blockvote.android.data.remote.BlockVoteApi
import com.blockvote.android.data.remote.dto.BiometricVerifyRequest
import com.blockvote.android.data.remote.dto.CandidateDto
import com.blockvote.android.data.remote.dto.CoarseLocationDto
import com.blockvote.android.data.remote.dto.SendOtpRequest
import com.blockvote.android.data.remote.dto.TwinRequestBody
import com.blockvote.android.data.remote.dto.VerifyOtpRequest
import com.blockvote.android.domain.model.Ballot
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

/** Same plain-language strings as lib/voterMessages.js on the web. */
private const val MSG_NOT_OPEN = "This election is not open yet."
private const val MSG_CLOSED = "This election has closed."
private const val MSG_NOT_ON_LIST = "This voter ID is not on the list. Check the ID or ask the booth officer."
private const val MSG_NO_CANDIDATES = "No candidates are listed for your area yet."

@Singleton
class RemoteVotingRepository @Inject constructor(
    private val api: BlockVoteApi
) : VotingRepository {

    private val receipts = MutableStateFlow<Map<String, VoteReceipt>>(emptyMap())

    override suspend fun getElection(electionId: String): Result<Election> = apiCall {
        val body = api.getElection(electionId)
        val dto = body.data ?: throw ApiException(body.error ?: "Election not found", 404)
        if (dto.phase == 2) throw ApiException(MSG_CLOSED, 403)
        if (dto.phase != 1 || !dto.guardianApproved) throw ApiException(MSG_NOT_OPEN, 403)
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
            votingHours = window?.hours.orEmpty(),
            level = dto.level ?: "general"
        )
    }

    override suspend fun getCandidates(electionId: String): Result<List<Candidate>> =
        apiCall { api.getCandidates(electionId).candidates.map { it.toModel() } }

    override suspend fun lookupVoter(
        voterId: String,
        electionId: String
    ): Result<VoterIdentity> = apiCall {
        val cleanId = normalizeVoterId(voterId)
        val body = api.lookupVoter(cleanId, electionId)
        val hash = body.nullifierHash
        if (hash.isNullOrBlank()) throw ApiException(body.error ?: MSG_NOT_ON_LIST, 404)
        val slip = body.slip
        VoterIdentity(
            voterId = slip?.voterId ?: cleanId,
            maskedVoterId = slip?.maskedVoterId ?: maskVoterId(cleanId),
            name = slip?.name.orEmpty(),
            maskedEmail = slip?.maskedEmail.orEmpty(),
            memberId = body.memberId ?: cleanId,
            nullifierHash = hash,
            homePlace = slip?.homePlace.orEmpty(),
            homePollingStation = slip?.homePollingStation.orEmpty(),
            seatCode = slip?.constituencyCode.orEmpty(),
            seatName = slip?.constituencyName.orEmpty(),
            level = slip?.level ?: "general",
            hasVoted = slip?.hasVoted == true,
            stationVoteFinal = slip?.stationVoteFinal == true
        )
    }

    override suspend fun getBallot(electionId: String, voterId: String): Result<Ballot> = apiCall {
        val body = api.getBallot(electionId, normalizeVoterId(voterId))
        if (body.success != true && !body.error.isNullOrBlank()) throw ApiException(body.error)
        Ballot(
            electionId = body.election?.electionId ?: electionId,
            electionTitle = body.election?.title.orEmpty(),
            open = body.election?.open == true,
            statusLabel = body.election?.status ?: "Not open",
            seatCode = body.seat?.code.orEmpty(),
            seatName = body.seat?.name.orEmpty(),
            homePlace = body.seat?.homePlace.orEmpty(),
            candidates = body.candidates.map { it.toModel() },
            message = body.message ?: if (body.candidates.isEmpty()) MSG_NO_CANDIDATES else ""
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
        body.token ?: throw ApiException(body.error ?: "Face check did not pass. Try again in better light.", 400)
    }

    override suspend fun sendOtp(voterId: String, electionId: String): Result<String> =
        apiCall {
            val body = api.sendOtp(
                SendOtpRequest(
                    voterId = normalizeVoterId(voterId),
                    electionId = electionId
                )
            )
            if (body.success != true && !body.error.isNullOrBlank()) {
                throw ApiException(body.error)
            }
            body.sentTo ?: "your email"
        }

    override suspend fun castVote(
        voterId: String,
        otp: String,
        electionId: String,
        candidateId: Int,
        biometricToken: String,
        electionTitle: String,
        location: CoarseLocation?
    ): Result<VoteReceipt> = apiCall {
        val cleanId = normalizeVoterId(voterId)
        val body = api.verifyOtpAndCastVote(
            biometricToken = biometricToken,
            body = VerifyOtpRequest(
                voterId = cleanId,
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
        val txHash = body.receiptCode ?: body.txHash
            ?: throw ApiException(body.error ?: "Your vote could not be recorded. Please try again.", 500)
        val receipt = VoteReceipt(
            transactionId = txHash,
            voterId = cleanId,
            electionId = electionId,
            candidateId = candidateId.toString(),
            timestamp = System.currentTimeMillis(),
            hash = txHash,
            verifyUrl = body.verifyUrl.orEmpty(),
            electionTitle = electionTitle,
            statusMessage = body.message.orEmpty(),
            receiptCode = txHash,
            isFinal = body.isFinal == true
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
        voterId: String,
        notes: String
    ): Result<String> = apiCall {
        val body = api.submitTwinRequest(
            TwinRequestBody(
                nullifierHash = nullifierHash,
                electionId = electionId,
                email = null,
                notes = notes.ifBlank { null }
            )
        )
        if (body.success != true && !body.error.isNullOrBlank()) {
            throw ApiException(body.error)
        }
        body.message ?: "Your request was sent. The booth officer will be told when it is approved."
    }

    override suspend fun getTwinVerificationStatus(nullifierHash: String): Result<String> = apiCall {
        val body = api.getBiometricStatus(nullifierHash)
        body.twinVerificationStatus ?: "none"
    }

    override fun observeReceipt(id: String): Flow<VoteReceipt?> =
        receipts.map { it[id] }

    private fun CandidateDto.toModel() = Candidate(
        id = id.toString(),
        name = name,
        party = party.orEmpty(),
        imageUrl = AssetUrlResolver.resolve(photoUrl.orEmpty()),
        symbolUrl = AssetUrlResolver.resolve(symbol.orEmpty()),
        description = manifesto.orEmpty(),
        partyCode = partyCode.orEmpty(),
        constituencyCode = constituencyCode.orEmpty()
    )

    private suspend fun <T> apiCall(block: () -> T): Result<T> = withContext(Dispatchers.IO) {
        runCatching(block)
    }

    companion object {
        /** Same rule as lib/voterIdentity.js: uppercase, letters and digits only. */
        fun normalizeVoterId(raw: String): String =
            raw.trim().uppercase().filter { it.isLetterOrDigit() }

        fun maskVoterId(id: String): String =
            if (id.length <= 4) id else id.take(3) + "•••" + id.takeLast(4)
    }
}
