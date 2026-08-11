package com.blockvote.android.data.repository

import com.blockvote.android.domain.model.Candidate
import com.blockvote.android.domain.model.Election
import com.blockvote.android.domain.model.ElectionStatus
import com.blockvote.android.domain.model.VoteReceipt
import com.blockvote.android.domain.repository.ElectionRepository
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class FakeElectionRepository @Inject constructor() : ElectionRepository {

    private val receipts = mutableMapOf<String, VoteReceipt>()

    private val elections = listOf(
        Election(
            id = "1",
            title = "Presidential Election 2026",
            description = "General election for the president.",
            status = ElectionStatus.LIVE,
            candidates = listOf(
                Candidate("1", "John Doe", "Progressive Party", "", "Vision for progress."),
                Candidate("2", "Jane Smith", "Conservative Party", "", "Stability and growth.")
            ),
            endDate = System.currentTimeMillis() + 86400000
        ),
        Election(
            id = "2",
            title = "City Council Seat A",
            description = "Vote for your local representative.",
            status = ElectionStatus.UPCOMING,
            candidates = listOf(
                Candidate("3", "Alice Brown", "Independent", "", "Community first.")
            ),
            endDate = System.currentTimeMillis() + 172800000
        )
    )

    override fun getElections(): Flow<List<Election>> = flow {
        emit(elections)
    }

    override fun getElectionById(id: String): Flow<Election?> = flow {
        emit(elections.find { it.id == id })
    }

    override fun getReceiptById(id: String): Flow<VoteReceipt?> = flow {
        emit(receipts[id])
    }

    override fun castVote(electionId: String, candidateId: String): Flow<Result<VoteReceipt>> = flow {
        delay(1000)
        val receipt = VoteReceipt(
            transactionId = UUID.randomUUID().toString(),
            voterId = "voter_123",
            electionId = electionId,
            candidateId = candidateId,
            timestamp = System.currentTimeMillis(),
            hash = "0x" + UUID.randomUUID().toString().replace("-", "")
        )
        receipts[receipt.transactionId] = receipt
        emit(Result.success(receipt))
    }
}
