package com.blockvote.android.data.repository

import com.blockvote.android.data.remote.ApiException
import com.blockvote.android.data.remote.BlockVoteApi
import com.blockvote.android.domain.model.Election
import com.blockvote.android.domain.model.ElectionStatus
import com.blockvote.android.domain.model.VoteReceipt
import com.blockvote.android.domain.repository.ElectionRepository
import com.blockvote.android.domain.repository.VotingRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Loads live / upcoming elections from GET /api/elections/public
 * (Mongo + on-chain merge via the Next.js backend).
 */
@Singleton
class ElectionRepositoryAdapter @Inject constructor(
    private val api: BlockVoteApi,
    private val votingRepository: VotingRepository
) : ElectionRepository {

    private var cached: List<Election> = emptyList()

    override fun getElections(): Flow<List<Election>> = flow {
        val list = withContext(Dispatchers.IO) {
            try {
                api.getPublicElections().elections.map { dto ->
                    val endMs = (dto.endTime ?: 0L) * 1000L
                    val phase = dto.phase
                    val status = when {
                        phase == 1 && dto.guardianApproved -> ElectionStatus.LIVE
                        phase == 0 -> ElectionStatus.UPCOMING
                        else -> ElectionStatus.CLOSED
                    }
                    Election(
                        id = dto.id,
                        title = dto.title.ifBlank { "Election ${dto.id}" },
                        description = dto.description.orEmpty(),
                        status = status,
                        endDate = endMs,
                        phase = phase,
                        guardianApproved = dto.guardianApproved,
                        bannerUrl = dto.bannerUrl.orEmpty()
                    )
                }
            } catch (e: ApiException) {
                throw e
            } catch (e: Exception) {
                throw ApiException(e.message ?: "Failed to load elections", 0)
            }
        }
        cached = list
        emit(list)
    }

    override fun getElectionById(id: String): Flow<Election?> = flow {
        emit(cached.find { it.id == id })
    }

    override fun getReceiptById(id: String): Flow<VoteReceipt?> =
        votingRepository.observeReceipt(id)

    override fun castVote(electionId: String, candidateId: String): Flow<Result<VoteReceipt>> = flow {
        emit(
            Result.failure(
                IllegalStateException("Use the secure voter portal flow (invite link → face → OTP).")
            )
        )
    }
}
