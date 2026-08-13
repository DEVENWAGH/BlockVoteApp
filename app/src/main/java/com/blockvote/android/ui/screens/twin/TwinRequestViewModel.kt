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
    val emailInput: String = "",
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

    fun onEmailChange(value: String) {
        _state.update { it.copy(emailInput = value, error = null) }
    }

    fun onNotesChange(value: String) {
        _state.update { it.copy(notesInput = value, error = null) }
    }

    fun submitRequest() {
        val electionId = _state.value.electionIdInput
        val email = _state.value.emailInput.trim()
        if (electionId.isBlank()) {
            _state.update { it.copy(error = "Enter your election ID") }
            return
        }
        if (email.isBlank() || !email.contains("@")) {
            _state.update { it.copy(error = "Enter a valid registered email") }
            return
        }

        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null, successMessage = null) }
            repository.lookupVoter(email, electionId)
                .onSuccess { voter ->
                    repository.submitTwinRequest(
                        nullifierHash = voter.nullifierHash,
                        electionId = electionId,
                        email = email,
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
                        it.copy(loading = false, error = e.message ?: "Voter not found for this election")
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
