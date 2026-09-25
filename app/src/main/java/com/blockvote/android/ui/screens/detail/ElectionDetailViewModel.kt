package com.blockvote.android.ui.screens.detail

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.blockvote.android.data.remote.ApiException
import com.blockvote.android.data.remote.BlockVoteApi
import com.blockvote.android.data.remote.dto.AnalyticsDataDto
import com.blockvote.android.data.remote.dto.ElectionDetailDto
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

data class ElectionInsightUi(
    val election: ElectionDetailDto,
    val analytics: AnalyticsDataDto?
)

sealed interface ElectionDetailUiState {
    data object Loading : ElectionDetailUiState
    data class Success(val data: ElectionInsightUi) : ElectionDetailUiState
    data class Error(val message: String) : ElectionDetailUiState
}

@HiltViewModel
class ElectionDetailViewModel @Inject constructor(
    private val api: BlockVoteApi
) : ViewModel() {

    private val _uiState = MutableStateFlow<ElectionDetailUiState>(ElectionDetailUiState.Loading)
    val uiState: StateFlow<ElectionDetailUiState> = _uiState.asStateFlow()

    fun loadElection(electionId: String) {
        viewModelScope.launch {
            _uiState.value = ElectionDetailUiState.Loading
            try {
                val insight = withContext(Dispatchers.IO) {
                    val electionBody = api.getElection(electionId)
                    val election = electionBody.data
                        ?: throw ApiException(electionBody.error ?: "Election not found", 404)

                    val analytics = runCatching {
                        api.getPublicAnalytics(electionId).data
                    }.getOrNull()

                    ElectionInsightUi(election = election, analytics = analytics)
                }
                _uiState.value = ElectionDetailUiState.Success(insight)
            } catch (e: Exception) {
                _uiState.value = ElectionDetailUiState.Error(
                    e.message ?: "Failed to load election details"
                )
            }
        }
    }
}
