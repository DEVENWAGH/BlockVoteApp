package com.blockvote.android.ui.screens.detail

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.blockvote.android.domain.model.Candidate
import com.blockvote.android.domain.model.Election
import com.blockvote.android.domain.model.ElectionStatus
import com.blockvote.android.ui.components.ElectionStatusBadge
import com.blockvote.android.ui.components.GlassCard
import com.blockvote.android.ui.components.PrimaryGradientButton
import com.blockvote.android.ui.components.VoteConfirmationDialog
import com.blockvote.android.ui.theme.BlockVoteTheme
import com.blockvote.android.ui.theme.ElectricCyan
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun ElectionDetailScreen(
    electionId: String,
    onNavigateToReceipt: (String) -> Unit,
    onBack: () -> Unit,
    viewModel: ElectionDetailViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val selectedCandidateId by viewModel.selectedCandidateId.collectAsState()
    val isVoting by viewModel.isVoting.collectAsState()
    val voteResult by viewModel.voteResult.collectAsState(initial = null)
    
    var showConfirmation by remember { mutableStateOf(false) }

    BackHandler { onBack() }

    LaunchedEffect(electionId) {
        viewModel.loadElection(electionId)
    }

    LaunchedEffect(voteResult) {
        voteResult?.let { onNavigateToReceipt(it) }
    }

    Scaffold(
        topBar = {
            @OptIn(ExperimentalMaterial3Api::class)
            TopAppBar(
                title = { Text("Election Details") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Rounded.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        },
        bottomBar = {
            if (uiState is ElectionDetailUiState.Success) {
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    tonalElevation = 8.dp,
                    shadowElevation = 16.dp
                ) {
                    Box(modifier = Modifier.padding(24.dp).navigationBarsPadding()) {
                        PrimaryGradientButton(
                            text = if (isVoting) "Signing Vote..." else "Cast Encrypted Vote",
                            onClick = { showConfirmation = true },
                            modifier = Modifier.fillMaxWidth(),
                            enabled = selectedCandidateId != null && !isVoting
                        )
                    }
                }
            }
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            when (val state = uiState) {
                is ElectionDetailUiState.Loading -> {
                    CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                }
                is ElectionDetailUiState.Success -> {
                    ElectionDetailContent(
                        election = state.election,
                        selectedCandidateId = selectedCandidateId,
                        onCandidateSelect = { viewModel.selectCandidate(it) }
                    )
                    
                    if (showConfirmation) {
                        val candidate = state.election.candidates.find { it.id == selectedCandidateId }
                        candidate?.let {
                            VoteConfirmationDialog(
                                candidate = it,
                                onConfirm = {
                                    showConfirmation = false
                                    viewModel.castVote(electionId)
                                },
                                onDismiss = { showConfirmation = false }
                            )
                        }
                    }
                }
                is ElectionDetailUiState.Error -> {
                    Text(
                        text = state.message,
                        modifier = Modifier.align(Alignment.Center),
                        color = MaterialTheme.colorScheme.error
                    )
                }
            }
        }
    }
}

@Composable
fun ElectionDetailContent(
    election: Election,
    selectedCandidateId: String?,
    onCandidateSelect: (String) -> Unit
) {
    val dateFormat = remember { SimpleDateFormat("MMM dd, yyyy HH:mm", Locale.getDefault()) }
    
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Column {
                ElectionStatusBadge(status = election.status)
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = election.title,
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = election.description,
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(16.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "Ends on: ",
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = dateFormat.format(Date(election.endDate)),
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.Bold,
                        color = ElectricCyan
                    )
                }
            }
        }
        
        item {
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Candidates",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )
        }
        
        items(election.candidates) { candidate ->
            CandidateItem(
                candidate = candidate,
                isSelected = candidate.id == selectedCandidateId,
                onClick = { onCandidateSelect(candidate.id) }
            )
        }
        
        item {
            Spacer(modifier = Modifier.height(80.dp)) // Padding for bottom bar
        }
    }
}

@Composable
fun CandidateItem(
    candidate: Candidate,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    val borderWidth by animateDpAsState(if (isSelected) 2.dp else 0.dp, label = "border")
    val borderColor = if (isSelected) ElectricCyan else Color.Transparent

    GlassCard(
        modifier = Modifier
            .fillMaxWidth()
            .border(borderWidth, borderColor, RoundedCornerShape(24.dp)),
        onClick = onClick
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Placeholder for candidate image
            Box(
                modifier = Modifier
                    .size(60.dp)
                    .clip(CircleShape)
                    .border(1.dp, MaterialTheme.colorScheme.onSurface.copy(alpha = 0.2f), CircleShape)
                    .padding(4.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = candidate.name.take(1),
                    style = MaterialTheme.typography.headlineSmall,
                    color = ElectricCyan
                )
            }
            
            Spacer(modifier = Modifier.width(16.dp))
            
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = candidate.name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = candidate.party,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            
            AnimatedVisibility(visible = isSelected) {
                Icon(
                    imageVector = Icons.Rounded.CheckCircle,
                    contentDescription = "Selected",
                    tint = ElectricCyan,
                    modifier = Modifier.size(24.dp)
                )
            }
        }
    }
}

@Preview(showBackground = true, backgroundColor = 0xFF0A0F1D)
@Composable
fun ElectionDetailPreview() {
    val mockCandidate = Candidate("1", "John Doe", "Progressive Party", "", "", "Vision for progress.")
    val mockElection = Election(
        id = "1",
        title = "Presidential Election 2026",
        description = "General election for the president of the community. Make your voice heard and decide the future of our governance.",
        status = ElectionStatus.LIVE,
        candidates = listOf(
            mockCandidate,
            Candidate("2", "Jane Smith", "Conservative Party", "", "", "Stability and growth.")
        ),
        endDate = System.currentTimeMillis() + 86400000
    )
    
    BlockVoteTheme(darkTheme = true) {
        Surface(color = MaterialTheme.colorScheme.background) {
            ElectionDetailContent(
                election = mockElection,
                selectedCandidateId = "1",
                onCandidateSelect = {}
            )
        }
    }
}
