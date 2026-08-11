package com.blockvote.android.ui.screens.detail

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.blockvote.android.domain.model.Election
import com.blockvote.android.domain.repository.ElectionRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed interface ElectionDetailUiState {
    data object Loading : ElectionDetailUiState
    data class Success(val election: Election) : ElectionDetailUiState
    data class Error(val message: String) : ElectionDetailUiState
}

@HiltViewModel
class ElectionDetailViewModel @Inject constructor(
    private val electionRepository: ElectionRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<ElectionDetailUiState>(ElectionDetailUiState.Loading)
    val uiState: StateFlow<ElectionDetailUiState> = _uiState.asStateFlow()

    private val _selectedCandidateId = MutableStateFlow<String?>(null)
    val selectedCandidateId: StateFlow<String?> = _selectedCandidateId.asStateFlow()

    private val _voteResult = MutableSharedFlow<String?>()
    val voteResult: SharedFlow<String?> = _voteResult.asSharedFlow()

    private val _isVoting = MutableStateFlow(false)
    val isVoting: StateFlow<Boolean> = _isVoting.asStateFlow()

    fun loadElection(electionId: String) {
        viewModelScope.launch {
            electionRepository.getElectionById(electionId)
                .collect { election ->
                    if (election != null) {
                        _uiState.value = ElectionDetailUiState.Success(election)
                    } else {
                        _uiState.value = ElectionDetailUiState.Error("Election not found")
                    }
                }
        }
    }

    fun selectCandidate(candidateId: String) {
        _selectedCandidateId.value = candidateId
    }

    fun castVote(electionId: String) {
        val candidateId = _selectedCandidateId.value ?: return
        viewModelScope.launch {
            _isVoting.value = true
            electionRepository.castVote(electionId, candidateId)
                .collect { result ->
                    _isVoting.value = false
                    result.onSuccess { receipt ->
                        _voteResult.emit(receipt.transactionId)
                    }.onFailure {
                        // Handle error
                    }
                }
        }
    }
}
