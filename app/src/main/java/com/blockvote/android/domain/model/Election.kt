package com.blockvote.android.domain.model

import kotlinx.serialization.Serializable

@Serializable
enum class ElectionStatus {
    LIVE, UPCOMING, CLOSED
}

@Serializable
data class Election(
    val id: String,
    val title: String,
    val description: String,
    val status: ElectionStatus,
    val candidates: List<Candidate>,
    val endDate: Long
)
