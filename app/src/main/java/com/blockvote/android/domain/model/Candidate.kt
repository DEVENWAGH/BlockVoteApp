package com.blockvote.android.domain.model

import kotlinx.serialization.Serializable

@Serializable
data class Candidate(
    val id: String,
    val name: String,
    val party: String,
    val imageUrl: String,
    val description: String
)
