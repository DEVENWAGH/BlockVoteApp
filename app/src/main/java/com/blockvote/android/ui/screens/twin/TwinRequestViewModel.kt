package com.blockvote.android.ui.screens.twin

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.blockvote.android.domain.repository.VotingRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class TwinRequestUiState(
    val electionIdInput: String = "",
    val voterIdInput: String = "",
    val notesInput: String = "",
    val nullifierHash: String? = null,
    val twinStatus: String? = null,
    val loading: Boolean = false,
    val submitted: Boolean = false,
    val error: String? = null,
    val successMessage: String? = null
)

@HiltViewModel
class TwinRequestViewModel @Inject constructor(
    private val repository: VotingRepository
) : ViewModel() {

    private val _state = MutableStateFlow(TwinRequestUiState())
    val state: StateFlow<TwinRequestUiState> = _state.asStateFlow()

    fun onElectionIdChange(value: String) {
        _state.update { it.copy(electionIdInput = value.trim(), error = null) }
    }

    fun onVoterIdChange(value: String) {
        val clean = value.uppercase().filter { ch -> ch.isLetterOrDigit() }.take(20)
        _state.update { it.copy(voterIdInput = clean, error = null) }
    }

    fun onNotesChange(value: String) {
        _state.update { it.copy(notesInput = value, error = null) }
    }

    fun submitRequest() {
        val electionId = _state.value.electionIdInput
        val voterId = _state.value.voterIdInput.trim()
        if (electionId.isBlank()) {
            _state.update { it.copy(error = "Enter the election ID from your invite") }
            return
        }
        if (voterId.length < 6) {
            _state.update { it.copy(error = "Enter the voter ID printed on your voter card") }
            return
        }

        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null, successMessage = null) }
            repository.lookupVoter(voterId, electionId)
                .onSuccess { voter ->
                    repository.submitTwinRequest(
                        nullifierHash = voter.nullifierHash,
                        electionId = electionId,
                        voterId = voter.voterId,
                        notes = _state.value.notesInput.trim()
                    ).onSuccess { message ->
                        repository.getTwinVerificationStatus(voter.nullifierHash)
                            .onSuccess { status ->
                                _state.update {
                                    it.copy(
                                        loading = false,
                                        submitted = true,
                                        nullifierHash = voter.nullifierHash,
                                        twinStatus = status,
                                        successMessage = message
                                    )
                                }
                            }
                            .onFailure {
                                _state.update {
                                    it.copy(
                                        loading = false,
                                        submitted = true,
                                        nullifierHash = voter.nullifierHash,
                                        twinStatus = "pending",
                                        successMessage = message
                                    )
                                }
                            }
                    }.onFailure { e ->
                        _state.update {
                            it.copy(loading = false, error = e.message ?: "Failed to submit request")
                        }
                    }
                }
                .onFailure { e ->
                    _state.update {
                        it.copy(loading = false, error = e.message ?: "This voter ID is not on the list. Check the ID or ask the booth officer.")
                    }
                }
        }
    }

    fun refreshStatus() {
        val hash = _state.value.nullifierHash ?: return
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            repository.getTwinVerificationStatus(hash)
                .onSuccess { status ->
                    _state.update { it.copy(loading = false, twinStatus = status) }
                }
                .onFailure { e ->
                    _state.update { it.copy(loading = false, error = e.message ?: "Could not refresh status") }
                }
        }
    }

    fun reset() {
        _state.value = TwinRequestUiState()
    }
}
