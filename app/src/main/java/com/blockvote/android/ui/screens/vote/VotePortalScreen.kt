package com.blockvote.android.ui.screens.vote

import android.Manifest
import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.HowToVote
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import com.blockvote.android.data.remote.AssetUrlResolver
import com.blockvote.android.domain.model.Candidate
import com.blockvote.android.ui.components.CameraScanMode
import com.blockvote.android.ui.components.FaceCaptureCamera
import com.blockvote.android.ui.components.PrimaryGradientButton
import com.blockvote.android.ui.theme.DeepNavy
import com.blockvote.android.ui.theme.ElectricCyan
import com.blockvote.android.ui.theme.EmeraldGreen
import com.blockvote.android.ui.theme.FluentBlue
import com.blockvote.android.ui.theme.NeonIndigo
import com.blockvote.android.ui.vote.VoteStep
import com.blockvote.android.ui.vote.VoteUiState
import com.blockvote.android.ui.vote.VoteViewModel
import com.blockvote.android.util.CoarseLocationHelper
import com.google.accompanist.permissions.ExperimentalPermissionsApi
import com.google.accompanist.permissions.isGranted
import com.google.accompanist.permissions.rememberPermissionState
import kotlinx.coroutines.launch

@OptIn(ExperimentalPermissionsApi::class)
@Composable
fun VotePortalScreen(
    initialElectionId: String? = null,
    onFinished: () -> Unit,
    onNavigateToElectionDetail: (String) -> Unit = {},
    onNavigateToTwinRequest: (electionId: String, voterId: String) -> Unit = { _, _ -> },
    viewModel: VoteViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsState()

    fun handleBack() {
        when (state.step) {
            VoteStep.ELECTION, VoteStep.DONE -> onFinished()
            else -> viewModel.goBack()
        }
    }

    // Gesture / system back: previous step, then leave the screen
    BackHandler { handleBack() }

    LaunchedEffect(initialElectionId) {
        if (!initialElectionId.isNullOrBlank() && state.selectedElection == null) {
            viewModel.onElectionIdChange(initialElectionId)
            viewModel.openElection(initialElectionId)
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    listOf(DeepNavy, Color(0xFF12182A), DeepNavy)
                )
            )
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(20.dp)
        ) {
            VoteHeader(
                state = state,
                onBack = { handleBack() },
                onOpenElectionDetail = onNavigateToElectionDetail
            )
            Spacer(modifier = Modifier.height(16.dp))
            if (state.step != VoteStep.ELECTION) {
                StepIndicator(state.step)
                Spacer(modifier = Modifier.height(20.dp))
            }

            AnimatedContent(
                targetState = state.step,
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
                transitionSpec = {
                    (slideInHorizontally { it / 3 } + fadeIn()) togetherWith
                        (slideOutHorizontally { -it / 3 } + fadeOut())
                },
                label = "vote-step"
            ) { step ->
                when (step) {
                    VoteStep.ELECTION -> ElectionIdStep(state, viewModel)
                    VoteStep.VOTER_ID -> VoterIdStep(state, viewModel, onNavigateToTwinRequest)
                    VoteStep.SEAT -> SeatStep(state, viewModel)
                    VoteStep.FACE -> FaceStep(state, viewModel, onNavigateToTwinRequest)
                    VoteStep.BALLOT -> BallotStep(state, viewModel)
                    VoteStep.CODE -> CodeStep(state, viewModel)
                    VoteStep.DONE -> DoneStep(state, onDone = {
                        viewModel.reset()
                        onFinished()
                    })
                }
            }
        }

        if (state.loading) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.35f)),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = ElectricCyan)
            }
        }
    }
}

@Composable
private fun VoteHeader(
    state: VoteUiState,
    onBack: () -> Unit,
    onOpenElectionDetail: (String) -> Unit
) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        IconButton(onClick = onBack) {
            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = Color.White)
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = state.selectedElection?.title ?: "Block Vote",
                style = MaterialTheme.typography.titleLarge,
                color = Color.White,
                fontWeight = FontWeight.Bold
            )
            val stepNo = VoteStep.VOTER_STEPS.indexOf(state.step) + 1
            Text(
                text = if (stepNo > 0) "Step $stepNo of ${VoteStep.VOTER_STEPS.size} · ${state.step.label}" else state.step.hint,
                style = MaterialTheme.typography.bodySmall,
                color = Color.White.copy(alpha = 0.65f)
            )
        }
        IconButton(
            onClick = {
                val electionId = state.selectedElection?.id ?: state.electionIdInput.ifBlank { null }
                if (electionId != null) {
                    onOpenElectionDetail(electionId)
                }
            }
        ) {
            Icon(
                Icons.Default.HowToVote,
                contentDescription = "About this election",
                tint = ElectricCyan
            )
        }
    }
}

/** Six bars, one per voter step, with the current step's plain label beneath. */
@Composable
private fun StepIndicator(step: VoteStep) {
    val steps = VoteStep.VOTER_STEPS
    val index = steps.indexOf(step).coerceAtLeast(0)
    Column {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            steps.forEachIndexed { i, _ ->
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .height(4.dp)
                        .clip(RoundedCornerShape(2.dp))
                        .background(
                            if (i <= index) ElectricCyan else Color.White.copy(alpha = 0.15f)
                        )
                )
            }
        }
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = step.hint,
            color = Color.White.copy(alpha = 0.75f),
            style = MaterialTheme.typography.bodyMedium
        )
    }
}

@Composable
private fun ElectionIdStep(state: VoteUiState, viewModel: VoteViewModel) {
    Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
        Text(
            text = "Open the link from your invite email, or paste the election ID here.",
            color = Color.White.copy(alpha = 0.75f),
            style = MaterialTheme.typography.bodyMedium
        )
        Spacer(modifier = Modifier.height(16.dp))
        OutlinedTextField(
            value = state.electionIdInput,
            onValueChange = viewModel::onElectionIdChange,
            label = { Text("Election ID") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
        ErrorText(state.error)
        Spacer(modifier = Modifier.height(20.dp))
        PrimaryGradientButton(
            text = "Start",
            onClick = { viewModel.openElection() },
            modifier = Modifier.fillMaxWidth()
        )
    }
}

@Composable
private fun VoterIdStep(
    state: VoteUiState,
    viewModel: VoteViewModel,
    onNavigateToTwinRequest: (String, String) -> Unit
) {
    Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
        val hours = state.selectedElection?.votingHours.orEmpty()
        Text(
            text = buildString {
                append("Type the voter ID exactly as printed on your voter card, for example ABC1234567. ")
                if (hours.isNotBlank()) append("Voting hours: $hours.")
            },
            color = Color.White.copy(alpha = 0.75f)
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "You will see the candidates of your home area, wherever you are. You can change your vote once in the app; a vote at a polling booth is final.",
            color = Color.White.copy(alpha = 0.55f),
            style = MaterialTheme.typography.bodySmall
        )
        Spacer(modifier = Modifier.height(16.dp))
        OutlinedTextField(
            value = state.voterIdInput,
            onValueChange = viewModel::onVoterIdChange,
            label = { Text("Voter ID") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.Ascii,
                capitalization = KeyboardCapitalization.Characters
            ),
            modifier = Modifier.fillMaxWidth()
        )
        ErrorText(state.error)
        Spacer(modifier = Modifier.height(20.dp))
        PrimaryGradientButton(
            text = "Find me on the list",
            onClick = viewModel::submitVoterId,
            modifier = Modifier.fillMaxWidth()
        )
        TwinRequestLink(
            electionId = state.selectedElection?.id ?: state.electionIdInput,
            voterId = state.voterIdInput,
            onNavigate = onNavigateToTwinRequest
        )
    }
}

/** "Is this you?" — the voter slip from the roll, with the home area they vote for. */
@Composable
private fun SeatStep(state: VoteUiState, viewModel: VoteViewModel) {
    val voter = state.voter
    Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
        Text(
            text = "Is this you?",
            color = Color.White,
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(12.dp))
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(Color.White.copy(alpha = 0.06f))
                .border(1.dp, Color.White.copy(alpha = 0.12f), RoundedCornerShape(16.dp))
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            SlipRow("Name", voter?.name.orEmpty().ifBlank { "—" })
            SlipRow("Voter ID", voter?.maskedVoterId.orEmpty().ifBlank { "—" }, mono = true)
            SlipRow("Email", voter?.maskedEmail.orEmpty().ifBlank { "—" }, mono = true)
            SlipRow("Home place", voter?.homePlace.orEmpty().ifBlank { "—" })
            if (!voter?.homePollingStation.isNullOrBlank()) {
                SlipRow("Home booth", voter?.homePollingStation.orEmpty())
            }
        }
        Spacer(modifier = Modifier.height(12.dp))
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(FluentBlue.copy(alpha = 0.16f))
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(Icons.Default.Place, contentDescription = null, tint = ElectricCyan)
            Spacer(modifier = Modifier.width(12.dp))
            Column {
                Text("Your area", color = Color.White.copy(alpha = 0.65f), style = MaterialTheme.typography.labelMedium)
                Text(
                    voter?.seatName.orEmpty().ifBlank { state.selectedElection?.title.orEmpty() },
                    color = Color.White,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    "You will see the candidates for this area, wherever you are right now.",
                    color = Color.White.copy(alpha = 0.6f),
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }
        if (voter?.hasVoted == true) {
            Spacer(modifier = Modifier.height(10.dp))
            Text(
                text = if (voter.stationVoteFinal) {
                    "A vote has already been cast at a polling booth for this voter. No more votes are allowed."
                } else {
                    "You have already voted once in the app. You can change it one time."
                },
                color = if (voter.stationVoteFinal) MaterialTheme.colorScheme.error else Color(0xFFFFB74D),
                style = MaterialTheme.typography.bodySmall
            )
        }
        ErrorText(state.error)
        Spacer(modifier = Modifier.height(20.dp))
        PrimaryGradientButton(
            text = "Yes, this is me",
            enabled = voter?.stationVoteFinal != true,
            onClick = viewModel::confirmSeat,
            modifier = Modifier.fillMaxWidth()
        )
        TextButton(onClick = viewModel::rejectSeat, modifier = Modifier.fillMaxWidth()) {
            Text("Not me — enter a different voter ID", color = Color.White.copy(alpha = 0.7f))
        }
    }
}

@Composable
private fun SlipRow(label: String, value: String, mono: Boolean = false) {
    Row(modifier = Modifier.fillMaxWidth()) {
        Text(
            label,
            color = Color.White.copy(alpha = 0.6f),
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.width(100.dp)
        )
        Text(
            value,
            color = Color.White,
            style = MaterialTheme.typography.bodyMedium,
            fontFamily = if (mono) FontFamily.Monospace else null,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.weight(1f)
        )
    }
}

@OptIn(ExperimentalPermissionsApi::class)
@Composable
private fun FaceStep(
    state: VoteUiState,
    viewModel: VoteViewModel,
    onNavigateToTwinRequest: (String, String) -> Unit
) {
    val cameraPermission = rememberPermissionState(Manifest.permission.CAMERA)

    LaunchedEffect(Unit) {
        if (!cameraPermission.status.isGranted) {
            cameraPermission.launchPermissionRequest()
        }
    }

    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = "Hold the phone at arm's length so the camera sees you clearly, then turn your head slowly to one side. If someone else appears, the check restarts.",
            color = Color.White.copy(alpha = 0.75f),
            style = MaterialTheme.typography.bodySmall
        )
        Spacer(modifier = Modifier.height(12.dp))
        if (!cameraPermission.status.isGranted) {
            PrimaryGradientButton(
                text = "Allow the camera",
                onClick = { cameraPermission.launchPermissionRequest() },
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "The face check needs the camera to continue.",
                color = Color(0xFFFF8A80),
                style = MaterialTheme.typography.bodySmall
            )
        } else {
            FaceCaptureCamera(
                mode = CameraScanMode.LIVENESS_ROTATE,
                enabled = !state.loading,
                retryToken = state.livenessRetryToken,
                onCaptured = viewModel::onLivenessCaptured,
                onError = { msg -> viewModel.setFaceError(msg) },
                onScanWarning = { msg -> viewModel.showLivenessMessage(msg) },
                modifier = Modifier.fillMaxWidth()
            )
        }
        ErrorText(state.error)
        if (!state.error.isNullOrBlank() && !state.loading) {
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = "Tip: take off glasses, keep your eyes open, and find brighter light.",
                color = Color.White.copy(alpha = 0.7f),
                style = MaterialTheme.typography.labelSmall
            )
            Spacer(modifier = Modifier.height(8.dp))
            PrimaryGradientButton(
                text = "Try again",
                onClick = viewModel::retryLivenessCapture,
                modifier = Modifier.fillMaxWidth()
            )
        }
        TwinRequestLink(
            electionId = state.selectedElection?.id ?: state.electionIdInput,
            voterId = state.voter?.voterId ?: state.voterIdInput,
            onNavigate = onNavigateToTwinRequest,
            highlight = !state.error.isNullOrBlank() &&
                (state.error!!.contains("duplicate", ignoreCase = true) ||
                    state.error!!.contains("twin", ignoreCase = true) ||
                    state.error!!.contains("match", ignoreCase = true))
        )
    }
}

/** Symbol-first ballot: only the candidates of the voter's home area. */
@Composable
private fun BallotStep(state: VoteUiState, viewModel: VoteViewModel) {
    val seatName = state.ballot?.seatName.orEmpty().ifBlank { state.voter?.seatName.orEmpty() }
    Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
        if (seatName.isNotBlank()) {
            Text(
                text = "Candidates for $seatName",
                color = Color.White,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold
            )
            Spacer(modifier = Modifier.height(10.dp))
        }
        state.candidates.forEach { candidate ->
            CandidateCard(
                candidate = candidate,
                selected = state.selectedCandidateId == candidate.id,
                onClick = { viewModel.selectCandidate(candidate.id) }
            )
            Spacer(modifier = Modifier.height(10.dp))
        }
        if (state.candidates.isEmpty()) {
            Text(
                "No candidates are listed for your area yet.",
                color = Color.White.copy(alpha = 0.7f)
            )
        }
        ErrorText(state.error)
        Spacer(modifier = Modifier.height(16.dp))
        PrimaryGradientButton(
            text = "Send me the code",
            enabled = state.selectedCandidateId != null,
            onClick = viewModel::sendOtp,
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            "We will email a 6-digit code to confirm it is you.",
            color = Color.White.copy(alpha = 0.55f),
            style = MaterialTheme.typography.labelSmall,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth()
        )
    }
}

@Composable
private fun CandidateCard(candidate: Candidate, selected: Boolean, onClick: () -> Unit) {
    val symbolUrl = when {
        candidate.symbolUrl.isNotBlank() -> AssetUrlResolver.resolve(candidate.symbolUrl)
        candidate.imageUrl.isNotBlank() -> AssetUrlResolver.resolve(candidate.imageUrl)
        else -> ""
    }.takeIf { it.startsWith("http") }.orEmpty()
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(if (selected) NeonIndigo.copy(alpha = 0.22f) else Color.White.copy(alpha = 0.06f))
            .border(
                if (selected) 2.dp else 1.dp,
                if (selected) ElectricCyan else Color.White.copy(alpha = 0.12f),
                RoundedCornerShape(16.dp)
            )
            .clickable(onClick = onClick)
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(72.dp)
                .clip(CircleShape)
                .background(Color.White),
            contentAlignment = Alignment.Center
        ) {
            if (symbolUrl.isNotBlank()) {
                AsyncImage(
                    model = symbolUrl,
                    contentDescription = "${candidate.party.ifBlank { candidate.name }} symbol",
                    modifier = Modifier
                        .fillMaxSize()
                        .clip(CircleShape)
                        .padding(6.dp),
                    contentScale = ContentScale.Fit
                )
            } else {
                Text(
                    candidate.party.ifBlank { candidate.name }.take(1),
                    color = FluentBlue,
                    fontWeight = FontWeight.Bold,
                    style = MaterialTheme.typography.headlineSmall
                )
            }
        }
        Spacer(modifier = Modifier.width(14.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                candidate.name,
                color = Color.White,
                fontWeight = FontWeight.SemiBold,
                style = MaterialTheme.typography.titleMedium
            )
            Text(
                candidate.party.ifBlank { "Independent" },
                color = Color.White.copy(alpha = 0.7f),
                style = MaterialTheme.typography.bodyMedium
            )
            if (candidate.description.isNotBlank()) {
                Text(
                    candidate.description,
                    color = Color.White.copy(alpha = 0.5f),
                    style = MaterialTheme.typography.labelSmall,
                    maxLines = 2
                )
            }
        }
        if (selected) {
            Icon(Icons.Default.CheckCircle, contentDescription = "Selected", tint = ElectricCyan)
        }
    }
}

@OptIn(ExperimentalPermissionsApi::class)
@Composable
private fun CodeStep(state: VoteUiState, viewModel: VoteViewModel) {
    val selected = state.candidates.find { it.id == state.selectedCandidateId }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val locationPermission = rememberPermissionState(Manifest.permission.ACCESS_COARSE_LOCATION)

    LaunchedEffect(Unit) {
        if (!locationPermission.status.isGranted) {
            locationPermission.launchPermissionRequest()
        }
    }

    Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
        Text(
            text = "We sent a 6-digit code to ${state.codeSentTo.ifBlank { "your email" }}. It works for 5 minutes.",
            color = Color.White.copy(alpha = 0.8f)
        )
        Spacer(modifier = Modifier.height(12.dp))
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(Color.White.copy(alpha = 0.06f))
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = if (state.revealCandidate) {
                    "Your choice: ${selected?.name ?: "—"}"
                } else {
                    "Your choice: ••••••••"
                },
                color = Color.White,
                modifier = Modifier.weight(1f)
            )
            IconButton(onClick = viewModel::toggleRevealCandidate) {
                Icon(
                    if (state.revealCandidate) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                    contentDescription = "Show or hide your choice",
                    tint = ElectricCyan
                )
            }
        }
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            "Your choice stays hidden while you type the code, so nobody looking over your shoulder can see it.",
            color = Color.White.copy(alpha = 0.55f),
            style = MaterialTheme.typography.labelSmall
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            "Allowing rough location only helps public turnout charts (village, city, state). Exact GPS is never stored, and it never changes which candidates you see.",
            color = Color.White.copy(alpha = 0.55f),
            style = MaterialTheme.typography.labelSmall
        )
        Spacer(modifier = Modifier.height(16.dp))
        OutlinedTextField(
            value = state.otpInput,
            onValueChange = viewModel::onOtpChange,
            label = { Text("6-digit code") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
            modifier = Modifier.fillMaxWidth()
        )
        ErrorText(state.error)
        Spacer(modifier = Modifier.height(20.dp))
        PrimaryGradientButton(
            text = if (state.loading) "Recording your vote…" else "Confirm my vote",
            enabled = !state.loading && state.otpInput.length == 6,
            onClick = {
                if (!viewModel.tryStartCast()) return@PrimaryGradientButton
                scope.launch {
                    val location = try {
                        if (CoarseLocationHelper.hasPermission(context)) {
                            CoarseLocationHelper.resolve(context)
                        } else {
                            null
                        }
                    } catch (_: Exception) {
                        null
                    }
                    viewModel.castVote(location)
                }
            },
            modifier = Modifier.fillMaxWidth()
        )
        TextButton(onClick = viewModel::sendOtp, enabled = !state.loading, modifier = Modifier.fillMaxWidth()) {
            Text("Send the code again", color = Color.White.copy(alpha = 0.7f))
        }
    }
}

@Composable
private fun DoneStep(state: VoteUiState, onDone: () -> Unit) {
    val clipboard = LocalClipboardManager.current
    val receipt = state.receipt
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            Icons.Default.CheckCircle,
            contentDescription = null,
            tint = EmeraldGreen,
            modifier = Modifier.size(72.dp)
        )
        Spacer(modifier = Modifier.height(12.dp))
        Text(
            "Your vote is recorded",
            color = Color.White,
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold
        )
        Text(
            "For your privacy, this screen does not show who you voted for.",
            color = Color.White.copy(alpha = 0.6f),
            textAlign = TextAlign.Center,
            style = MaterialTheme.typography.bodySmall,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
        )
        if (receipt != null) {
            if (receipt.statusMessage.isNotBlank()) {
                Text(
                    receipt.statusMessage,
                    color = Color.White.copy(alpha = 0.8f),
                    textAlign = TextAlign.Center,
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
                )
            }
            Text(
                receipt.electionTitle.ifBlank { "Election" },
                color = ElectricCyan,
                fontWeight = FontWeight.SemiBold
            )
            Spacer(modifier = Modifier.height(16.dp))
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(Color.White.copy(alpha = 0.06f))
                    .border(1.dp, Color.White.copy(alpha = 0.12f), RoundedCornerShape(16.dp))
                    .padding(16.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    "Your receipt code",
                    color = Color.White.copy(alpha = 0.65f),
                    style = MaterialTheme.typography.labelMedium
                )
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = receipt.receiptCode,
                    color = Color.White,
                    fontFamily = FontFamily.Monospace,
                    style = MaterialTheme.typography.bodySmall,
                    textAlign = TextAlign.Center
                )
                IconButton(onClick = { clipboard.setText(AnnotatedString(receipt.receiptCode)) }) {
                    Icon(Icons.Default.ContentCopy, contentDescription = "Copy receipt code", tint = ElectricCyan)
                }
                Text(
                    "Keep this code. Anyone can use it to check that your vote was counted — it never shows your choice. A copy was emailed to you.",
                    color = Color.White.copy(alpha = 0.6f),
                    textAlign = TextAlign.Center,
                    style = MaterialTheme.typography.labelSmall
                )
            }
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = when (state.onChainVerified) {
                    true -> "Checked: your vote is on the public record."
                    false -> "Still being written to the public record. Check again in a minute."
                    null -> "The public record check was skipped."
                },
                color = if (state.onChainVerified == true) EmeraldGreen else Color.White.copy(alpha = 0.6f),
                style = MaterialTheme.typography.bodySmall,
                textAlign = TextAlign.Center
            )
        }
        Spacer(modifier = Modifier.height(24.dp))
        PrimaryGradientButton(text = "Done", onClick = onDone, modifier = Modifier.fillMaxWidth())
    }
}

@Composable
private fun TwinRequestLink(
    electionId: String,
    voterId: String,
    onNavigate: (String, String) -> Unit,
    highlight: Boolean = false
) {
    Spacer(modifier = Modifier.height(16.dp))
    Text(
        text = if (highlight) {
            "Did the camera confuse you with someone else? Ask staff to approve you."
        } else {
            "Have a twin or look-alike? Ask staff to approve you"
        },
        color = if (highlight) Color(0xFFFFB74D) else Color.White.copy(alpha = 0.55f),
        style = MaterialTheme.typography.labelMedium,
        textAlign = TextAlign.Center,
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onNavigate(electionId, voterId) }
            .padding(vertical = 8.dp)
    )
}

@Composable
private fun ErrorText(error: String?) {
    if (error.isNullOrBlank()) return
    Spacer(modifier = Modifier.height(12.dp))
    Text(error, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
}
