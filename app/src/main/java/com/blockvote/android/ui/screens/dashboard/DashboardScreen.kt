package com.blockvote.android.ui.screens.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.rounded.HowToVote
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.blockvote.android.domain.model.Election
import com.blockvote.android.domain.model.ElectionStatus
import com.blockvote.android.ui.WebPortalLinks
import com.blockvote.android.ui.components.ElectionStatusBadge
import com.blockvote.android.ui.components.PrimaryGradientButton
import com.blockvote.android.ui.theme.BlockVoteTheme
import com.blockvote.android.ui.theme.DarkSurface
import com.blockvote.android.ui.theme.ElectricCyan
import com.blockvote.android.ui.theme.EmeraldGreen
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.TimeUnit

@Composable
fun DashboardScreen(
    onNavigateToElection: (String) -> Unit,
    onNavigateToVote: () -> Unit = {},
    onBack: (() -> Unit)? = null,
    viewModel: DashboardViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsState()
    val live = state.elections.filter { it.status == ElectionStatus.LIVE }
    val other = state.elections.filter { it.status != ElectionStatus.LIVE }
    val context = LocalContext.current

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(horizontal = 20.dp)
    ) {
        Spacer(modifier = Modifier.height(12.dp))

        LiveVotingHeader(
            liveCount = live.size,
            loading = state.loading,
            onRefresh = viewModel::refresh,
            onBack = onBack
        )

        Spacer(modifier = Modifier.height(16.dp))

        PrimaryGradientButton(
            text = "Open Secure Voter Portal",
            onClick = onNavigateToVote,
            modifier = Modifier.fillMaxWidth()
        )

        TextButton(
            onClick = { WebPortalLinks.open(context) },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(
                text = "Vote on web (beta)",
                color = ElectricCyan
            )
        }

        Spacer(modifier = Modifier.height(24.dp))

        when {
            state.loading && state.elections.isEmpty() -> {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = ElectricCyan)
                }
            }
            state.error != null && state.elections.isEmpty() -> {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Text(
                        text = state.error ?: "Error",
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodyMedium
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    TextButton(onClick = viewModel::refresh) {
                        Text("Retry")
                    }
                }
            }
            else -> {
                Text(
                    text = "Live on chain",
                    style = MaterialTheme.typography.titleLarge,
                    color = MaterialTheme.colorScheme.onBackground,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "Guardian-approved elections in voting phase",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.55f)
                )

                Spacer(modifier = Modifier.height(12.dp))

                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    contentPadding = PaddingValues(bottom = 28.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    if (live.isEmpty()) {
                        item {
                            EmptyLiveCard()
                        }
                    } else {
                        items(live, key = { it.id }) { election ->
                            LiveElectionRow(
                                election = election,
                                onClick = { onNavigateToElection(election.id) }
                            )
                        }
                    }

                    if (other.isNotEmpty()) {
                        item {
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = "Other elections",
                                style = MaterialTheme.typography.titleMedium,
                                color = MaterialTheme.colorScheme.onBackground,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                        items(other, key = { it.id }) { election ->
                            LiveElectionRow(
                                election = election,
                                onClick = { onNavigateToElection(election.id) }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun LiveVotingHeader(
    liveCount: Int,
    loading: Boolean,
    onRefresh: () -> Unit,
    onBack: (() -> Unit)? = null
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        if (onBack != null) {
            IconButton(onClick = onBack) {
                Icon(
                    Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = "Back",
                    tint = ElectricCyan
                )
            }
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "BlockVote",
                style = MaterialTheme.typography.labelMedium,
                color = ElectricCyan,
                fontWeight = FontWeight.SemiBold
            )
            Text(
                text = if (loading) "Syncing elections…" else "$liveCount live election${if (liveCount == 1) "" else "s"}",
                style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.onBackground,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "Pulled from your connected backend + chain",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.55f)
            )
        }
        IconButton(onClick = onRefresh) {
            Icon(
                Icons.Rounded.Refresh,
                contentDescription = "Refresh",
                tint = ElectricCyan
            )
        }
    }
}

@Composable
private fun EmptyLiveCard() {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .border(1.dp, MaterialTheme.colorScheme.onSurface.copy(alpha = 0.12f), RoundedCornerShape(16.dp))
            .background(DarkSurface)
            .padding(20.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            Icons.Rounded.HowToVote,
            contentDescription = null,
            tint = ElectricCyan.copy(alpha = 0.7f),
            modifier = Modifier.size(36.dp)
        )
        Spacer(modifier = Modifier.height(10.dp))
        Text(
            text = "No live elections right now",
            color = Color.White,
            fontWeight = FontWeight.SemiBold
        )
        Text(
            text = "When an admin opens voting and guardians approve, it appears here.",
            color = Color.White.copy(alpha = 0.55f),
            style = MaterialTheme.typography.bodySmall,
            modifier = Modifier.padding(top = 4.dp)
        )
    }
}

@Composable
private fun LiveElectionRow(
    election: Election,
    onClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .border(1.dp, MaterialTheme.colorScheme.onSurface.copy(alpha = 0.12f), RoundedCornerShape(16.dp))
            .background(DarkSurface)
            .clickable(onClick = onClick)
            .padding(16.dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            ElectionStatusBadge(status = election.status)
            if (election.status == ElectionStatus.LIVE) {
                Box(
                    modifier = Modifier
                        .size(8.dp)
                        .clip(RoundedCornerShape(50))
                        .background(EmeraldGreen)
                )
            }
        }
        Spacer(modifier = Modifier.height(10.dp))
        Text(
            text = election.title,
            style = MaterialTheme.typography.titleMedium,
            color = Color.White,
            fontWeight = FontWeight.Bold,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis
        )
        if (election.description.isNotBlank()) {
            Text(
                text = election.description,
                style = MaterialTheme.typography.bodySmall,
                color = Color.White.copy(alpha = 0.55f),
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(top = 4.dp)
            )
        }
        Spacer(modifier = Modifier.height(10.dp))
        Text(
            text = formatElectionTiming(election),
            style = MaterialTheme.typography.labelMedium,
            color = ElectricCyan.copy(alpha = 0.9f)
        )
        Text(
            text = "ID ${election.id}",
            style = MaterialTheme.typography.labelSmall,
            color = Color.White.copy(alpha = 0.35f),
            modifier = Modifier.padding(top = 2.dp)
        )
    }
}

private fun formatElectionTiming(election: Election): String {
    if (election.endDate <= 0L) return "End time on chain"
    val now = System.currentTimeMillis()
    return when {
        election.status == ElectionStatus.LIVE && election.endDate > now -> {
            val hours = TimeUnit.MILLISECONDS.toHours(election.endDate - now)
            if (hours >= 48) {
                val days = hours / 24
                "Ends in $days days · ${formatDate(election.endDate)}"
            } else if (hours >= 1) {
                "Ends in ${hours}h · ${formatDate(election.endDate)}"
            } else {
                val mins = TimeUnit.MILLISECONDS.toMinutes(election.endDate - now).coerceAtLeast(1)
                "Ends in ${mins}m · ${formatDate(election.endDate)}"
            }
        }
        election.endDate <= now -> "Ended ${formatDate(election.endDate)}"
        else -> "Ends ${formatDate(election.endDate)}"
    }
}

private fun formatDate(ms: Long): String =
    SimpleDateFormat("MMM d, yyyy HH:mm", Locale.getDefault()).format(Date(ms))

@Preview(showBackground = true, device = "spec:width=411dp,height=891dp")
@Composable
fun DashboardScreenPreview() {
    BlockVoteTheme {
        DashboardScreen(onNavigateToElection = {}, onNavigateToVote = {})
    }
}
