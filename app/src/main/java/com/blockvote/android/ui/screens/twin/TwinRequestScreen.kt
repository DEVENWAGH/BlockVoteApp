package com.blockvote.android.ui.screens.twin

import androidx.compose.foundation.background
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
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.blockvote.android.ui.components.GlassCard
import com.blockvote.android.ui.components.PrimaryGradientButton
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

    androidx.compose.runtime.LaunchedEffect(initialElectionId, initialEmail) {
        if (!initialElectionId.isNullOrBlank()) {
            viewModel.onElectionIdChange(initialElectionId)
        }
        if (!initialEmail.isNullOrBlank()) {
            viewModel.onEmailChange(initialEmail)
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
                        text = "Twin Verification",
                        style = MaterialTheme.typography.titleLarge,
                        color = Color.White,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Request admin review for identical faces",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color.White.copy(alpha = 0.65f)
                    )
                }
                Icon(Icons.Default.Groups, contentDescription = null, tint = ElectricCyan)
            }

            Spacer(modifier = Modifier.height(20.dp))

            Column(
                modifier = Modifier
                    .weight(1f)
                    .verticalScroll(rememberScrollState())
            ) {
                GlassCard(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        text = "If you and a sibling share very similar facial features, our system may flag you as a duplicate voter. Submit a request so an election admin can verify you are distinct people.",
                        color = Color.White.copy(alpha = 0.85f),
                        style = MaterialTheme.typography.bodyMedium
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                if (state.submitted) {
                    SuccessPanel(state, viewModel)
                } else {
                    FormPanel(state, viewModel)
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
private fun FormPanel(state: TwinRequestUiState, viewModel: TwinRequestViewModel) {
    OutlinedTextField(
        value = state.electionIdInput,
        onValueChange = viewModel::onElectionIdChange,
        label = { Text("Election ID") },
        singleLine = true,
        modifier = Modifier.fillMaxWidth()
    )
    Spacer(modifier = Modifier.height(12.dp))
    OutlinedTextField(
        value = state.emailInput,
        onValueChange = viewModel::onEmailChange,
        label = { Text("Registered email") },
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
        modifier = Modifier.fillMaxWidth()
    )
    Spacer(modifier = Modifier.height(12.dp))
    OutlinedTextField(
        value = state.notesInput,
        onValueChange = viewModel::onNotesChange,
        label = { Text("Notes for admin (optional)") },
        minLines = 3,
        modifier = Modifier.fillMaxWidth()
    )
    ErrorText(state.error)
    Spacer(modifier = Modifier.height(20.dp))
    PrimaryGradientButton(
        text = "Submit Twin Verification Request",
        onClick = viewModel::submitRequest,
        modifier = Modifier.fillMaxWidth()
    )
}

@Composable
private fun SuccessPanel(state: TwinRequestUiState, viewModel: TwinRequestViewModel) {
    GlassCard(modifier = Modifier.fillMaxWidth()) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                text = state.successMessage ?: "Request submitted",
                color = EmeraldGreen,
                fontWeight = FontWeight.Bold,
                style = MaterialTheme.typography.titleMedium
            )
            Text(
                text = "Your request is now visible to election admins in their dashboard. You'll be able to register and vote once approved.",
                color = Color.White.copy(alpha = 0.8f),
                style = MaterialTheme.typography.bodySmall
            )
            StatusBadge(state.twinStatus)
        }
    }
    Spacer(modifier = Modifier.height(16.dp))
    PrimaryGradientButton(
        text = "Refresh Status",
        onClick = viewModel::refreshStatus,
        modifier = Modifier.fillMaxWidth()
    )
    Spacer(modifier = Modifier.height(8.dp))
    PrimaryGradientButton(
        text = "Submit Another Request",
        onClick = viewModel::reset,
        modifier = Modifier.fillMaxWidth()
    )
}

@Composable
private fun StatusBadge(status: String?) {
    val (label, color) = when (status) {
        "approved" -> "Approved — you may proceed with biometric registration" to EmeraldGreen
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
    Spacer(modifier = Modifier.height(8.dp))
    Text(
        text = message,
        color = Color(0xFFFF8A80),
        style = MaterialTheme.typography.bodySmall
    )
}
