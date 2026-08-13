package com.blockvote.android.data.repository

import com.blockvote.android.domain.model.Election
import com.blockvote.android.domain.model.ElectionStatus
import com.blockvote.android.domain.model.VoteReceipt
import com.blockvote.android.domain.repository.ElectionRepository
import com.blockvote.android.domain.repository.VotingRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Bridges older dashboard screens to [VotingRepository] while the voter portal
 * is the primary product surface.
 */
@Singleton
class ElectionRepositoryAdapter @Inject constructor(
    private val votingRepository: VotingRepository
) : ElectionRepository {

    private var cached: List<Election> = emptyList()

    override fun getElections(): Flow<List<Election>> = flow {
        emit(
            listOf(
                Election(
                    id = "portal",
                    title = "Use Secure Voter Portal",
                    description = "Invite link → face → OTP → gasless on-chain vote.",
                    status = ElectionStatus.LIVE,
                    candidates = emptyList(),
                    endDate = System.currentTimeMillis() + 86_400_000L
                )
            ).also { cached = it }
        )
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
