package com.blockvote.android.ui.screens.vote

import android.Manifest
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
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.blockvote.android.domain.model.Candidate
import com.blockvote.android.domain.model.Election
import com.blockvote.android.ui.components.FaceCaptureCamera
import com.blockvote.android.ui.components.PrimaryGradientButton
import com.blockvote.android.ui.theme.DeepNavy
import com.blockvote.android.ui.theme.ElectricCyan
import com.blockvote.android.ui.theme.EmeraldGreen
import com.blockvote.android.ui.theme.NeonIndigo
import com.blockvote.android.ui.vote.VoteStep
import com.blockvote.android.ui.vote.VoteUiState
import com.blockvote.android.ui.vote.VoteViewModel
import com.google.accompanist.permissions.ExperimentalPermissionsApi
import com.google.accompanist.permissions.isGranted
import com.google.accompanist.permissions.rememberPermissionState

@OptIn(ExperimentalPermissionsApi::class)
@Composable
fun VotePortalScreen(
    initialElectionId: String? = null,
    onFinished: () -> Unit,
    viewModel: VoteViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsState()

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
                onBack = {
                    when (state.step) {
                        VoteStep.ELECTION, VoteStep.SUCCESS -> onFinished()
                        else -> viewModel.goBack()
                    }
                }
            )
            Spacer(modifier = Modifier.height(16.dp))
            StepIndicator(state.step)
            Spacer(modifier = Modifier.height(20.dp))

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
                    VoteStep.EMAIL -> EmailStep(state, viewModel)
                    VoteStep.FACE -> FaceStep(state, viewModel)
                    VoteStep.CANDIDATE -> CandidateStep(state, viewModel)
                    VoteStep.OTP -> OtpStep(state, viewModel)
                    VoteStep.SUCCESS -> SuccessStep(state, onDone = {
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
private fun VoteHeader(state: VoteUiState, onBack: () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        IconButton(onClick = onBack) {
            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = Color.White)
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = state.selectedElection?.title ?: "BlockVote",
                style = MaterialTheme.typography.titleLarge,
                color = Color.White,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = when (state.step) {
                    VoteStep.ELECTION -> "Open election from invite link"
                    VoteStep.EMAIL -> "Verify registered email"
                    VoteStep.FACE -> "Liveness + face match"
                    VoteStep.CANDIDATE -> "Select your candidate"
                    VoteStep.OTP -> "Confirm with email OTP"
                    VoteStep.SUCCESS -> "Vote recorded on-chain"
                },
                style = MaterialTheme.typography.bodySmall,
                color = Color.White.copy(alpha = 0.65f)
            )
        }
        Icon(Icons.Default.HowToVote, contentDescription = null, tint = ElectricCyan)
    }
}

@Composable
private fun StepIndicator(step: VoteStep) {
    val steps = listOf(
        VoteStep.ELECTION, VoteStep.EMAIL,
        VoteStep.FACE, VoteStep.CANDIDATE, VoteStep.OTP, VoteStep.SUCCESS
    )
    val index = steps.indexOf(step).coerceAtLeast(0)
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
            text = "Continue to vote",
            onClick = { viewModel.openElection() },
            modifier = Modifier.fillMaxWidth()
        )
    }
}

@Composable
private fun EmailStep(state: VoteUiState, viewModel: VoteViewModel) {
    Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
        Text(
            text = "Use the email your election admin registered for ${state.selectedElection?.title.orEmpty()}.",
            color = Color.White.copy(alpha = 0.75f)
        )
        Spacer(modifier = Modifier.height(16.dp))
        OutlinedTextField(
            value = state.emailInput,
            onValueChange = viewModel::onEmailChange,
            label = { Text("Registered email") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            modifier = Modifier.fillMaxWidth()
        )
        ErrorText(state.error)
        Spacer(modifier = Modifier.height(20.dp))
        PrimaryGradientButton(
            text = "Continue",
            onClick = viewModel::submitEmail,
            modifier = Modifier.fillMaxWidth()
        )
    }
}

@OptIn(ExperimentalPermissionsApi::class)
@Composable
private fun FaceStep(state: VoteUiState, viewModel: VoteViewModel) {
    val cameraPermission = rememberPermissionState(Manifest.permission.CAMERA)

    // Ask for camera as soon as this step opens
    LaunchedEffect(Unit) {
        if (!cameraPermission.status.isGranted) {
            cameraPermission.launchPermissionRequest()
        }
    }

    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = "Liveness check: one face, eyes open, no glasses. We do not match against a stored photo.",
            color = Color.White.copy(alpha = 0.75f),
            style = MaterialTheme.typography.bodySmall
        )
        Spacer(modifier = Modifier.height(12.dp))
        if (!cameraPermission.status.isGranted) {
            PrimaryGradientButton(
                text = "Allow Camera Access",
                onClick = { cameraPermission.launchPermissionRequest() },
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Camera permission is required to continue.",
                color = Color(0xFFFF8A80),
                style = MaterialTheme.typography.bodySmall
            )
        } else {
            // Keep preview outside verticalScroll so CameraX gets a real surface size
            FaceCaptureCamera(
                enabled = !state.loading,
                onCaptured = viewModel::onFaceVerified,
                onError = { msg -> viewModel.setFaceError(msg) },
                modifier = Modifier.fillMaxWidth()
            )
        }
        ErrorText(state.error)
    }
}

@Composable
private fun CandidateStep(state: VoteUiState, viewModel: VoteViewModel) {
    Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
        state.candidates.forEach { candidate ->
            CandidateRow(
                candidate = candidate,
                selected = state.selectedCandidateId == candidate.id,
                onClick = { viewModel.selectCandidate(candidate.id) }
            )
            Spacer(modifier = Modifier.height(10.dp))
        }
        ErrorText(state.error)
        Spacer(modifier = Modifier.height(16.dp))
        PrimaryGradientButton(
            text = "Send Email OTP",
            onClick = viewModel::sendOtp,
            modifier = Modifier.fillMaxWidth()
        )
    }
}

@Composable
private fun CandidateRow(candidate: Candidate, selected: Boolean, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(if (selected) NeonIndigo.copy(alpha = 0.25f) else Color.White.copy(alpha = 0.06f))
            .border(
                1.dp,
                if (selected) ElectricCyan else Color.White.copy(alpha = 0.12f),
                RoundedCornerShape(14.dp)
            )
            .clickable(onClick = onClick)
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(44.dp)
                .clip(CircleShape)
                .background(ElectricCyan.copy(alpha = 0.2f)),
            contentAlignment = Alignment.Center
        ) {
            Text(candidate.name.take(1), color = ElectricCyan, fontWeight = FontWeight.Bold)
        }
        Spacer(modifier = Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(candidate.name, color = Color.White, fontWeight = FontWeight.SemiBold)
            Text(
                candidate.party.ifBlank { "Independent" },
                color = Color.White.copy(alpha = 0.6f),
                style = MaterialTheme.typography.bodySmall
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
    }
}

@Composable
private fun OtpStep(state: VoteUiState, viewModel: VoteViewModel) {
    val selected = state.candidates.find { it.id == state.selectedCandidateId }
    Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
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
                    "Voting for: ${selected?.name ?: "—"}"
                } else {
                    "Voting for: ••••••••"
                },
                color = Color.White,
                modifier = Modifier.weight(1f)
            )
            IconButton(onClick = viewModel::toggleRevealCandidate) {
                Icon(
                    if (state.revealCandidate) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                    contentDescription = "Toggle candidate visibility",
                    tint = ElectricCyan
                )
            }
        }
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            "Shoulder-surfing protection: candidate stays hidden while you enter OTP.",
            color = Color.White.copy(alpha = 0.55f),
            style = MaterialTheme.typography.labelSmall
        )
        Spacer(modifier = Modifier.height(16.dp))
        OutlinedTextField(
            value = state.otpInput,
            onValueChange = viewModel::onOtpChange,
            label = { Text("6-digit OTP") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
            modifier = Modifier.fillMaxWidth()
        )
        ErrorText(state.error)
        Spacer(modifier = Modifier.height(20.dp))
        PrimaryGradientButton(
            text = "Cast Gasless Vote",
            onClick = viewModel::castVote,
            modifier = Modifier.fillMaxWidth()
        )
    }
}

@Composable
private fun SuccessStep(state: VoteUiState, onDone: () -> Unit) {
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
            "Vote relayed on-chain",
            color = Color.White,
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold
        )
        Text(
            "Receipt-free: this screen does not restate your candidate choice.",
            color = Color.White.copy(alpha = 0.6f),
            textAlign = TextAlign.Center,
            style = MaterialTheme.typography.bodySmall,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
        )
        if (receipt != null) {
            Text(
                receipt.electionTitle.ifBlank { "Election" },
                color = ElectricCyan,
                fontWeight = FontWeight.SemiBold
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = receipt.hash,
                color = Color.White.copy(alpha = 0.85f),
                style = MaterialTheme.typography.labelMedium,
                textAlign = TextAlign.Center
            )
            IconButton(onClick = { clipboard.setText(AnnotatedString(receipt.hash)) }) {
                Icon(Icons.Default.ContentCopy, contentDescription = "Copy tx hash", tint = ElectricCyan)
            }
            Text(
                text = when (state.onChainVerified) {
                    true -> "On-chain verification: confirmed"
                    false -> "On-chain verification: pending / not found yet"
                    null -> "On-chain verification: skipped"
                },
                color = if (state.onChainVerified == true) EmeraldGreen else Color.White.copy(alpha = 0.6f),
                style = MaterialTheme.typography.bodySmall
            )
        }
        Spacer(modifier = Modifier.height(24.dp))
        PrimaryGradientButton(text = "Done", onClick = onDone, modifier = Modifier.fillMaxWidth())
    }
}

@Composable
private fun ErrorText(error: String?) {
    if (error.isNullOrBlank()) return
    Spacer(modifier = Modifier.height(12.dp))
    Text(error, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
}
