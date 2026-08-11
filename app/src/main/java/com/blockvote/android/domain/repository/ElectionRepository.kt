package com.blockvote.android.domain.repository

import com.blockvote.android.domain.model.Election
import com.blockvote.android.domain.model.VoteReceipt
import kotlinx.coroutines.flow.Flow

interface ElectionRepository {
    fun getElections(): Flow<List<Election>>
    fun getElectionById(id: String): Flow<Election?>
    fun getReceiptById(id: String): Flow<VoteReceipt?>
    fun castVote(electionId: String, candidateId: String): Flow<Result<VoteReceipt>>
}
