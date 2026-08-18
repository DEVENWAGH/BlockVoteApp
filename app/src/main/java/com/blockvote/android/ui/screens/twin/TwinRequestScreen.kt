package com.blockvote.android.ui.screens.twin

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.blockvote.android.ui.components.PrimaryGradientButton
import com.blockvote.android.ui.theme.DarkSurface
import com.blockvote.android.ui.theme.DeepNavy
import com.blockvote.android.ui.theme.ElectricCyan
import com.blockvote.android.ui.theme.EmeraldGreen

@Composable
fun TwinRequestScreen(
    initialElectionId: String? = null,
    initialEmail: String? = null,
    onBack: () -> Unit,
    viewModel: TwinRequestViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsState()

    BackHandler { onBack() }

    androidx.compose.runtime.LaunchedEffect(initialElectionId, initialEmail) {
        if (!initialElectionId.isNullOrBlank()) {
            viewModel.onElectionIdChange(initialElectionId)
        }
        if (!initialEmail.isNullOrBlank()) {
            viewModel.onEmailChange(initialEmail)
        }
    }

    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedBorderColor = ElectricCyan,
        unfocusedBorderColor = Color.White.copy(alpha = 0.2f),
        focusedLabelColor = ElectricCyan,
        unfocusedLabelColor = Color.White.copy(alpha = 0.55f),
        cursorColor = ElectricCyan,
        focusedTextColor = Color.White,
        unfocusedTextColor = Color.White
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(DeepNavy)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 20.dp, vertical = 12.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) {
                    Icon(
                        Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "Back",
                        tint = Color.White
                    )
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Twin verification",
                        style = MaterialTheme.typography.titleLarge,
                        color = Color.White,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Admin review for similar faces",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color.White.copy(alpha = 0.6f)
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            Column(
                modifier = Modifier
                    .weight(1f)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Text(
                    text = "If face scan flagged you as a duplicate (e.g. identical twin), submit a request. Your election admin reviews it in the web dashboard and can approve you to continue.",
                    color = Color.White.copy(alpha = 0.75f),
                    style = MaterialTheme.typography.bodyMedium
                )

                StepHint(number = "1", text = "Enter election ID + registered email")
                StepHint(number = "2", text = "Admin sees the request under Twin Overrides")
                StepHint(number = "3", text = "After approval, retry face registration / vote")

                if (state.submitted) {
                    SuccessPanel(state, viewModel)
                } else {
                    OutlinedTextField(
                        value = state.electionIdInput,
                        onValueChange = viewModel::onElectionIdChange,
                        label = { Text("Election ID") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        colors = fieldColors
                    )
                    OutlinedTextField(
                        value = state.emailInput,
                        onValueChange = viewModel::onEmailChange,
                        label = { Text("Registered email") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                        modifier = Modifier.fillMaxWidth(),
                        colors = fieldColors
                    )
                    OutlinedTextField(
                        value = state.notesInput,
                        onValueChange = viewModel::onNotesChange,
                        label = { Text("Notes for admin (optional)") },
                        minLines = 3,
                        modifier = Modifier.fillMaxWidth(),
                        colors = fieldColors
                    )
                    ErrorText(state.error)
                    PrimaryGradientButton(
                        text = "Submit request",
                        onClick = viewModel::submitRequest,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        }

        if (state.loading) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.45f)),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = ElectricCyan)
            }
        }
    }
}

@Composable
private fun StepHint(number: String, text: String) {
    Row(
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(8.dp))
                .background(ElectricCyan.copy(alpha = 0.15f))
                .border(1.dp, ElectricCyan.copy(alpha = 0.35f), RoundedCornerShape(8.dp))
                .padding(horizontal = 8.dp, vertical = 4.dp)
        ) {
            Text(text = number, color = ElectricCyan, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelMedium)
        }
        Text(
            text = text,
            color = Color.White.copy(alpha = 0.7f),
            style = MaterialTheme.typography.bodySmall,
            modifier = Modifier.padding(top = 4.dp)
        )
    }
}

@Composable
private fun SuccessPanel(state: TwinRequestUiState, viewModel: TwinRequestViewModel) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(DarkSurface)
            .border(1.dp, EmeraldGreen.copy(alpha = 0.35f), RoundedCornerShape(16.dp))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Text(
            text = state.successMessage ?: "Request submitted",
            color = EmeraldGreen,
            fontWeight = FontWeight.Bold,
            style = MaterialTheme.typography.titleMedium
        )
        Text(
            text = "Visible to election admins under Twin Verification Overrides. Refresh status after they decide.",
            color = Color.White.copy(alpha = 0.75f),
            style = MaterialTheme.typography.bodySmall
        )
        StatusBadge(state.twinStatus)
    }
    PrimaryGradientButton(
        text = "Refresh status",
        onClick = viewModel::refreshStatus,
        modifier = Modifier.fillMaxWidth()
    )
    TextButton(onClick = viewModel::reset, modifier = Modifier.fillMaxWidth()) {
        Text("Submit another request", color = Color.White.copy(alpha = 0.7f))
    }
}

@Composable
private fun StatusBadge(status: String?) {
    val (label, color) = when (status) {
        "approved" -> "Approved — continue biometric registration" to EmeraldGreen
        "rejected" -> "Rejected — contact your election admin" to Color(0xFFFF8A80)
        "pending" -> "Pending admin review" to Color(0xFFFFB74D)
        else -> "Submitted" to ElectricCyan
    }
    Text(
        text = label,
        color = color,
        fontWeight = FontWeight.SemiBold,
        modifier = Modifier
            .fillMaxWidth()
            .background(color.copy(alpha = 0.12f), RoundedCornerShape(8.dp))
            .padding(12.dp),
        textAlign = TextAlign.Center,
        style = MaterialTheme.typography.labelLarge
    )
}

@Composable
private fun ErrorText(message: String?) {
    if (message.isNullOrBlank()) return
    Text(
        text = message,
        color = Color(0xFFFF8A80),
        style = MaterialTheme.typography.bodySmall
    )
}
