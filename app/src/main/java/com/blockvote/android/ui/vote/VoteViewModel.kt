package com.blockvote.android.ui.vote

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.blockvote.android.domain.model.Candidate
import com.blockvote.android.domain.model.Election
import com.blockvote.android.domain.model.VoteReceipt
import com.blockvote.android.domain.model.VoterIdentity
import com.blockvote.android.domain.repository.VotingRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

enum class VoteStep {
    ELECTION,
    EMAIL,
    /** Front camera rotation scan + AWS face verify (single step). */
    LIVENESS,
    CANDIDATE,
    OTP,
    SUCCESS
}

data class VoteUiState(
    val step: VoteStep = VoteStep.ELECTION,
    val electionIdInput: String = "",
    val emailInput: String = "",
    val otpInput: String = "",
    val selectedElection: Election? = null,
    val candidates: List<Candidate> = emptyList(),
    val selectedCandidateId: String? = null,
    val voter: VoterIdentity? = null,
    val biometricToken: String? = null,
    val receipt: VoteReceipt? = null,
    val onChainVerified: Boolean? = null,
    val loading: Boolean = false,
    val error: String? = null,
    val revealCandidate: Boolean = false,
    /** Bumped when AWS face verify fails so the camera unlocks for recapture. */
    val livenessRetryToken: Int = 0
)

@HiltViewModel
class VoteViewModel @Inject constructor(
    private val repository: VotingRepository
) : ViewModel() {

    private val _state = MutableStateFlow(VoteUiState())
    val state: StateFlow<VoteUiState> = _state.asStateFlow()

    fun onElectionIdChange(value: String) {
        _state.update { it.copy(electionIdInput = value.trim(), error = null) }
    }

    fun onEmailChange(value: String) {
        _state.update { it.copy(emailInput = value, error = null) }
    }

    fun onOtpChange(value: String) {
        _state.update { it.copy(otpInput = value.filter { ch -> ch.isDigit() }.take(6), error = null) }
    }

    fun toggleRevealCandidate() {
        _state.update { it.copy(revealCandidate = !it.revealCandidate) }
    }

    fun openElection(prefillId: String? = null) {
        if (!prefillId.isNullOrBlank()) {
            _state.update { it.copy(electionIdInput = prefillId.trim()) }
        }
        val electionId = _state.value.electionIdInput
        if (electionId.isBlank()) {
            _state.update { it.copy(error = "Enter or open your election invite link") }
            return
        }
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            repository.getElection(electionId)
                .onSuccess { election ->
                    repository.getCandidates(election.id)
                        .onSuccess { candidates ->
                            _state.update {
                                it.copy(
                                    loading = false,
                                    selectedElection = election,
                                    candidates = candidates,
                                    step = VoteStep.EMAIL,
                                    emailInput = "",
                                    otpInput = "",
                                    biometricToken = null,
                                    selectedCandidateId = null,
                                    voter = null
                                )
                            }
                        }
                        .onFailure { e ->
                            _state.update {
                                it.copy(loading = false, error = e.message ?: "Failed to load candidates")
                            }
                        }
                }
                .onFailure { e ->
                    _state.update {
                        it.copy(loading = false, error = e.message ?: "Election not found or not live")
                    }
                }
        }
    }

    fun submitEmail() {
        val s = _state.value
        val election = s.selectedElection ?: return
        val email = s.emailInput.trim()
        if (email.isBlank() || !email.contains("@")) {
            _state.update { it.copy(error = "Enter a valid registered email") }
            return
        }
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            repository.lookupVoter(email, election.id)
                .onSuccess { voter ->
                    _state.update {
                        it.copy(loading = false, voter = voter, step = VoteStep.LIVENESS)
                    }
                }
                .onFailure { e ->
                    _state.update {
                        it.copy(loading = false, error = e.message ?: "Voter not registered")
                    }
                }
        }
    }

    fun onLivenessCaptured(imageDataUrl: String) = onFaceVerified(imageDataUrl)

    fun onFaceVerified(imageDataUrl: String) {
        val s = _state.value
        val voter = s.voter
        val election = s.selectedElection
        if (voter == null) {
            _state.update {
                it.copy(error = "Complete email verification before face capture.")
            }
            return
        }
        if (election == null) {
            _state.update { it.copy(error = "Election not loaded.") }
            return
        }
        if (voter.nullifierHash.isBlank()) {
            _state.update {
                it.copy(error = "Voter identity missing. Go back and re-enter your email.")
            }
            return
        }
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            repository.verifyFace(voter.nullifierHash, imageDataUrl, election.id)
                .onSuccess { token ->
                    _state.update {
                        it.copy(loading = false, biometricToken = token, step = VoteStep.CANDIDATE)
                    }
                }
                .onFailure { e ->
                    val msg = e.message ?: "Face verification failed"
                    _state.update {
                        it.copy(
                            loading = false,
                            error = msg,
                            step = VoteStep.LIVENESS,
                            livenessRetryToken = it.livenessRetryToken + 1
                        )
                    }
                }
        }
    }

    /** Unlock camera for another photo after AWS rejection (glasses, lighting, etc.). */
    fun retryLivenessCapture() {
        _state.update {
            it.copy(
                loading = false,
                error = null,
                step = VoteStep.LIVENESS,
                livenessRetryToken = it.livenessRetryToken + 1
            )
        }
    }

    fun selectCandidate(id: String) {
        _state.update { it.copy(selectedCandidateId = id, error = null) }
    }

    fun setFaceError(message: String) {
        _state.update {
            it.copy(
                loading = false,
                error = message,
                livenessRetryToken = it.livenessRetryToken + 1
            )
        }
    }

    /** Show a scan warning without unlocking recapture (e.g. extra person in frame). */
    fun showLivenessMessage(message: String) {
        _state.update { it.copy(loading = false, error = message) }
    }

    fun sendOtp() {
        val s = _state.value
        val election = s.selectedElection ?: return
        val candidateId = s.selectedCandidateId ?: run {
            _state.update { it.copy(error = "Select a candidate first") }
            return
        }
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            repository.sendOtp(s.emailInput, election.id)
                .onSuccess {
                    _state.update {
                        it.copy(
                            loading = false,
                            step = VoteStep.OTP,
                            selectedCandidateId = candidateId,
                            revealCandidate = false
                        )
                    }
                }
                .onFailure { e ->
                    _state.update {
                        it.copy(loading = false, error = e.message ?: "Failed to send OTP")
                    }
                }
        }
    }

    fun castVote() {
        val s = _state.value
        val election = s.selectedElection ?: return
        val candidateId = s.selectedCandidateId?.toIntOrNull() ?: return
        val token = s.biometricToken.orEmpty()
        if (s.otpInput.length != 6) {
            _state.update { it.copy(error = "Enter the 6-digit OTP from your email") }
            return
        }
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            repository.castVote(
                email = s.emailInput,
                otp = s.otpInput,
                electionId = election.id,
                candidateId = candidateId,
                biometricToken = token,
                electionTitle = election.title
            ).onSuccess { receipt ->
                val verified = repository.verifyOnChain(receipt.hash).getOrNull()
                _state.update {
                    it.copy(
                        loading = false,
                        receipt = receipt.copy(onChainVerified = verified),
                        onChainVerified = verified,
                        step = VoteStep.SUCCESS
                    )
                }
            }.onFailure { e ->
                _state.update {
                    it.copy(loading = false, error = e.message ?: "Vote failed")
                }
            }
        }
    }

    fun goBack() {
        _state.update { s ->
            when (s.step) {
                VoteStep.EMAIL -> s.copy(step = VoteStep.ELECTION, error = null)
                VoteStep.LIVENESS -> s.copy(step = VoteStep.EMAIL, error = null)
                VoteStep.CANDIDATE -> s.copy(step = VoteStep.LIVENESS, error = null)
                VoteStep.OTP -> s.copy(step = VoteStep.CANDIDATE, error = null)
                else -> s
            }
        }
    }

    fun reset() {
        _state.value = VoteUiState()
    }
}
