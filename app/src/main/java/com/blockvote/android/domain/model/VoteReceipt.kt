package com.blockvote.android.domain.model

import kotlinx.serialization.Serializable

@Serializable
data class VoteReceipt(
    val transactionId: String,
    val voterId: String,
    val electionId: String,
    val candidateId: String,
    val timestamp: Long,
    val hash: String
)
