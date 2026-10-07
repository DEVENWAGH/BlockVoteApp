package com.blockvote.android.ui.vote

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.blockvote.android.domain.model.Ballot
import com.blockvote.android.domain.model.Candidate
import com.blockvote.android.domain.model.Election
import com.blockvote.android.domain.model.VoteReceipt
import com.blockvote.android.domain.model.VoterIdentity
import com.blockvote.android.domain.repository.VotingRepository
import com.blockvote.android.util.CoarseLocation
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.util.concurrent.atomic.AtomicBoolean
import javax.inject.Inject

/**
 * The same six steps a voter sees at a polling booth (see VOTER_STEPS on the
 * web). ELECTION is only shown when the app was opened without an invite link.
 */
enum class VoteStep(val label: String, val hint: String) {
    ELECTION("Open election", "Open the link from your invite email"),
    VOTER_ID("Enter voter ID", "The number printed on your voter card"),
    SEAT("Confirm your area", "Check this is you and your home area"),
    FACE("Face check", "Look at the camera and turn your head slowly"),
    BALLOT("Choose candidate", "Tap the symbol of the candidate you want"),
    CODE("Enter code", "Type the 6-digit code we emailed you"),
    DONE("Done", "Your vote is recorded");

    companion object {
        /** The six voter-facing steps, in order. */
        val VOTER_STEPS = listOf(VOTER_ID, SEAT, FACE, BALLOT, CODE, DONE)
    }
}

data class VoteUiState(
    val step: VoteStep = VoteStep.ELECTION,
    val electionIdInput: String = "",
    val voterIdInput: String = "",
    val otpInput: String = "",
    val selectedElection: Election? = null,
    val voter: VoterIdentity? = null,
    val ballot: Ballot? = null,
    val candidates: List<Candidate> = emptyList(),
    val selectedCandidateId: String? = null,
    val biometricToken: String? = null,
    /** Masked email the code was sent to. */
    val codeSentTo: String = "",
    val receipt: VoteReceipt? = null,
    val onChainVerified: Boolean? = null,
    val loading: Boolean = false,
    val error: String? = null,
    val revealCandidate: Boolean = false,
    /** Bumped when the face check fails so the camera unlocks for another try. */
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

    fun onVoterIdChange(value: String) {
        val clean = value.uppercase().filter { ch -> ch.isLetterOrDigit() }.take(20)
        _state.update { it.copy(voterIdInput = clean, error = null) }
    }

    fun onOtpChange(value: String) {
        _state.update { it.copy(otpInput = value.filter { ch -> ch.isDigit() }.take(6), error = null) }
    }

    fun toggleRevealCandidate() {
        _state.update { it.copy(revealCandidate = !it.revealCandidate) }
    }

    /** Step 0 — open the election from the invite link (or a pasted ID). */
    fun openElection(prefillId: String? = null) {
        if (!prefillId.isNullOrBlank()) {
            _state.update { it.copy(electionIdInput = prefillId.trim()) }
        }
        val electionId = _state.value.electionIdInput
        if (electionId.isBlank()) {
            _state.update { it.copy(error = "Open the link from your invite email, or paste the election ID.") }
            return
        }
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            repository.getElection(electionId)
                .onSuccess { election ->
                    _state.update {
                        it.copy(
                            loading = false,
                            selectedElection = election,
                            step = VoteStep.VOTER_ID,
                            voterIdInput = "",
                            otpInput = "",
                            voter = null,
                            ballot = null,
                            candidates = emptyList(),
                            biometricToken = null,
                            selectedCandidateId = null,
                            codeSentTo = ""
                        )
                    }
                }
                .onFailure { e ->
                    _state.update {
                        it.copy(loading = false, error = e.message ?: "This election is not open yet.")
                    }
                }
        }
    }

    /** Step 1 — find the voter on the roll by voter ID. */
    fun submitVoterId() {
        val s = _state.value
        val election = s.selectedElection ?: return
        val voterId = s.voterIdInput
        if (voterId.length < 6) {
            _state.update { it.copy(error = "Enter the voter ID printed on your voter card.") }
            return
        }
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            repository.lookupVoter(voterId, election.id)
                .onSuccess { voter ->
                    _state.update {
                        it.copy(loading = false, voter = voter, step = VoteStep.SEAT)
                    }
                }
                .onFailure { e ->
                    _state.update {
                        it.copy(
                            loading = false,
                            error = e.message
                                ?: "This voter ID is not on the list. Check the ID or ask the booth officer."
                        )
                    }
                }
        }
    }

    /** Step 2 — "Yes, this is me": load the home ballot, then go to the face check. */
    fun confirmSeat() {
        val s = _state.value
        val election = s.selectedElection ?: return
        val voter = s.voter ?: return
        if (voter.stationVoteFinal) {
            _state.update {
                it.copy(error = "A vote has already been cast at a polling station for this voter. No more votes are allowed.")
            }
            return
        }
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            repository.getBallot(election.id, voter.voterId)
                .onSuccess { ballot ->
                    if (ballot.candidates.isEmpty()) {
                        _state.update {
                            it.copy(
                                loading = false,
                                ballot = ballot,
                                error = ballot.message.ifBlank { "No candidates are listed for your area yet." }
                            )
                        }
                    } else {
                        _state.update {
                            it.copy(
                                loading = false,
                                ballot = ballot,
                                candidates = ballot.candidates,
                                step = VoteStep.FACE
                            )
                        }
                    }
                }
                .onFailure { e ->
                    _state.update {
                        it.copy(loading = false, error = e.message ?: "Could not load your ballot. Please try again.")
                    }
                }
        }
    }

    /** "Not me" on the slip — back to the voter ID field. */
    fun rejectSeat() {
        _state.update { it.copy(step = VoteStep.VOTER_ID, voter = null, ballot = null, error = null) }
    }

    fun onLivenessCaptured(imageDataUrl: String) = onFaceVerified(imageDataUrl)

    /** Step 3 — face check. */
    fun onFaceVerified(imageDataUrl: String) {
        val s = _state.value
        val voter = s.voter
        val election = s.selectedElection
        if (voter == null) {
            _state.update { it.copy(error = "Enter your voter ID first.") }
            return
        }
        if (election == null) {
            _state.update { it.copy(error = "This election is not open yet.") }
            return
        }
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            repository.verifyFace(voter.nullifierHash, imageDataUrl, election.id)
                .onSuccess { token ->
                    _state.update {
                        it.copy(loading = false, biometricToken = token, step = VoteStep.BALLOT)
                    }
                }
                .onFailure { e ->
                    _state.update {
                        it.copy(
                            loading = false,
                            error = e.message ?: "Face check did not pass. Try again in better light.",
                            step = VoteStep.FACE,
                            livenessRetryToken = it.livenessRetryToken + 1
                        )
                    }
                }
        }
    }

    /** Unlock the camera for another photo (glasses, lighting, etc.). */
    fun retryLivenessCapture() {
        _state.update {
            it.copy(
                loading = false,
                error = null,
                step = VoteStep.FACE,
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

    /** Step 4 → 5 — "Send me the code". */
    fun sendOtp() {
        val s = _state.value
        val election = s.selectedElection ?: return
        val voter = s.voter ?: return
        val candidateId = s.selectedCandidateId ?: run {
            _state.update { it.copy(error = "Tap a candidate first.") }
            return
        }
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            repository.sendOtp(voter.voterId, election.id)
                .onSuccess { sentTo ->
                    _state.update {
                        it.copy(
                            loading = false,
                            step = VoteStep.CODE,
                            selectedCandidateId = candidateId,
                            codeSentTo = sentTo,
                            otpInput = "",
                            revealCandidate = false
                        )
                    }
                }
                .onFailure { e ->
                    _state.update {
                        it.copy(loading = false, error = e.message ?: "Could not send the code. Please try again.")
                    }
                }
        }
    }

    private val castGate = AtomicBoolean(false)

    /**
     * Call before any slow work (location lookup). A second tap while the
     * first ballot is in flight is ignored.
     */
    fun tryStartCast(): Boolean {
        val s = _state.value
        if (s.step == VoteStep.DONE || s.loading) return false
        if (!castGate.compareAndSet(false, true)) return false
        if (s.otpInput.length != 6) {
            castGate.set(false)
            _state.update { it.copy(error = "Enter the 6-digit code from your email.") }
            return false
        }
        _state.update { it.copy(loading = true, error = null) }
        return true
    }

    /** Step 5 → 6 — "Confirm my vote". */
    fun castVote(location: CoarseLocation? = null) {
        val s = _state.value
        val election = s.selectedElection ?: run {
            castGate.set(false)
            _state.update { it.copy(loading = false, error = "This election is not open yet.") }
            return
        }
        val voter = s.voter ?: run {
            castGate.set(false)
            _state.update { it.copy(loading = false, error = "Enter your voter ID first.") }
            return
        }
        val candidateId = s.selectedCandidateId?.toIntOrNull() ?: run {
            castGate.set(false)
            _state.update { it.copy(loading = false, error = "Tap a candidate first.") }
            return
        }
        val token = s.biometricToken.orEmpty()
        if (!castGate.get()) return
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            repository.castVote(
                voterId = voter.voterId,
                otp = s.otpInput,
                electionId = election.id,
                candidateId = candidateId,
                biometricToken = token,
                electionTitle = election.title,
                location = location
            ).onSuccess { receipt ->
                val verified = repository.verifyOnChain(receipt.hash).getOrNull()
                _state.update {
                    it.copy(
                        loading = false,
                        receipt = receipt.copy(onChainVerified = verified),
                        onChainVerified = verified,
                        step = VoteStep.DONE
                    )
                }
            }.onFailure { e ->
                castGate.set(false)
                _state.update {
                    it.copy(loading = false, error = e.message ?: "Your vote could not be recorded. Please try again.")
                }
            }
        }
    }

    fun goBack() {
        _state.update { s ->
            when (s.step) {
                VoteStep.VOTER_ID -> s.copy(step = VoteStep.ELECTION, error = null)
                VoteStep.SEAT -> s.copy(step = VoteStep.VOTER_ID, error = null)
                VoteStep.FACE -> s.copy(step = VoteStep.SEAT, error = null)
                VoteStep.BALLOT -> s.copy(step = VoteStep.FACE, error = null)
                VoteStep.CODE -> s.copy(step = VoteStep.BALLOT, error = null)
                else -> s
            }
        }
    }

    fun reset() {
        castGate.set(false)
        _state.value = VoteUiState()
    }
}
