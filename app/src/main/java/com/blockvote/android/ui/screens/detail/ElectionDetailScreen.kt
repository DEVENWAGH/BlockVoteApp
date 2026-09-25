package com.blockvote.android.ui.screens.detail

import androidx.activity.compose.BackHandler
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.LocationOn
import androidx.compose.material.icons.rounded.Shield
import androidx.compose.material.icons.rounded.Speed
import androidx.compose.material.icons.rounded.Timeline
import androidx.compose.material.icons.rounded.Groups
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.blockvote.android.data.remote.dto.AnalyticsDataDto
import com.blockvote.android.data.remote.dto.ElectionDetailDto
import com.blockvote.android.ui.components.GlassCard
import com.blockvote.android.ui.theme.ElectricCyan
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ElectionDetailScreen(
    electionId: String,
    onNavigateToReceipt: (String) -> Unit = {},
    onBack: () -> Unit,
    viewModel: ElectionDetailViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    BackHandler { onBack() }

    LaunchedEffect(electionId) {
        viewModel.loadElection(electionId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Election Insights") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Rounded.ArrowBack, contentDescription = "Back")
                    }
                }
            )
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
                    ElectionInsightContent(data = state.data)
                }
                is ElectionDetailUiState.Error -> {
                    Text(
                        text = state.message,
                        modifier = Modifier
                            .align(Alignment.Center)
                            .padding(24.dp),
                        color = MaterialTheme.colorScheme.error
                    )
                }
            }
        }
    }
}

@Composable
private fun ElectionInsightContent(data: ElectionInsightUi) {
    val election = data.election
    val analytics = data.analytics
    val stats = analytics?.stats
    val demographics = analytics?.demographics

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            PhaseBadge(phase = election.phase)
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = election.title,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold
            )
            election.description?.takeIf { it.isNotBlank() }?.let {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = it,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            Spacer(modifier = Modifier.height(12.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                DateChip(label = "Starts", value = formatDate(election.startTime))
                DateChip(label = "Ends", value = formatDate(election.endTime))
            }
        }

        if (stats != null) {
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    MetricCard(
                        modifier = Modifier.weight(1f),
                        icon = Icons.Rounded.Groups,
                        label = "Turnout",
                        value = "${stats.totalVotes}/${stats.registeredVoterCount}",
                        subtext = "${stats.turnoutRate}% registered"
                    )
                    MetricCard(
                        modifier = Modifier.weight(1f),
                        icon = Icons.Rounded.Speed,
                        label = "Velocity",
                        value = "${stats.votesPerMinute}/min",
                        subtext = stats.peakHour?.hour?.let { "Peak ${formatHour(it)}" } ?: "Waiting for activity"
                    )
                }
            }
        }

        item {
            InsightPanel(title = "Chain Verification", icon = Icons.Rounded.Shield) {
                InfoRow("Election ID", shorten(election.electionId))
                election.orgName?.takeIf { it.isNotBlank() }?.let {
                    InfoRow("Organization", it)
                }
                election.txHash?.takeIf { it.isNotBlank() }?.let {
                    InfoRow("Creation Tx", shorten(it))
                }
                election.blockNumber?.let {
                    InfoRow("Block", it.toString())
                }
                Text(
                    text = "Aggregate analytics only. No voter identity or ballot choice is exposed.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        analytics?.hourlyDistribution?.takeIf { it.isNotEmpty() }?.let { hourly ->
            item {
                InsightPanel(title = "Participation Trend", icon = Icons.Rounded.Timeline) {
                    val max = hourly.maxOfOrNull { it.count }?.coerceAtLeast(1) ?: 1
                    hourly.takeLast(8).forEach { entry ->
                        Column(modifier = Modifier.padding(vertical = 4.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(formatHour(entry.hour), style = MaterialTheme.typography.labelSmall)
                                Text("${entry.count} votes", style = MaterialTheme.typography.labelSmall)
                            }
                            Spacer(modifier = Modifier.height(4.dp))
                            LinearProgressIndicator(
                                progress = { entry.count.toFloat() / max },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(6.dp),
                                color = ElectricCyan,
                                trackColor = MaterialTheme.colorScheme.surfaceVariant
                            )
                        }
                    }
                }
            }
        }

        demographics?.let { demo ->
            item {
                InsightPanel(title = "Geographic Footprint", icon = Icons.Rounded.LocationOn) {
                    BucketSection("States / regions", demo.regionBuckets)
                    BucketSection("Cities", demo.cityBuckets)
                    BucketSection("Villages / localities", demo.villageBuckets)
                    if (demo.regionBuckets.isEmpty() && demo.cityBuckets.isEmpty() && demo.villageBuckets.isEmpty()) {
                        Text(
                            text = "Location buckets appear after voters share coarse place labels during voting.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            item {
                InsightPanel(title = "Demographics", icon = Icons.Rounded.Groups) {
                    BucketSection("Age groups", demo.ageGroups)
                    BucketSection("Gender split", demo.genderSplit)
                    BucketSection("Urban / rural mix", demo.localityTypeBuckets)
                    BucketSection("City tiers", demo.cityTierBuckets)
                }
            }
        }

        election.canonicalVoteUrl?.takeIf { it.isNotBlank() }?.let { url ->
            item {
                InsightPanel(title = "Ballot Access", icon = Icons.Rounded.Shield) {
                    Text(
                        text = url,
                        style = MaterialTheme.typography.bodySmall,
                        fontFamily = FontFamily.Monospace
                    )
                }
            }
        }
    }
}

@Composable
private fun PhaseBadge(phase: Int) {
    val (label, color) = when (phase) {
        2 -> "Completed" to Color(0xFF10B981)
        1 -> "Voting Active" to Color(0xFFF59E0B)
        else -> "Registration" to ElectricCyan
    }
    Surface(
        color = color.copy(alpha = 0.15f),
        shape = RoundedCornerShape(999.dp)
    ) {
        Text(
            text = label.uppercase(),
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
            style = MaterialTheme.typography.labelSmall,
            color = color,
            fontWeight = FontWeight.Bold
        )
    }
}

@Composable
private fun DateChip(label: String, value: String) {
    GlassCard(modifier = Modifier) {
        Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun MetricCard(
    modifier: Modifier = Modifier,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    value: String,
    subtext: String
) {
    GlassCard(modifier = modifier) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, contentDescription = null, tint = ElectricCyan)
            Spacer(modifier = Modifier.width(8.dp))
            Text(label, style = MaterialTheme.typography.labelMedium)
        }
        Spacer(modifier = Modifier.height(8.dp))
        Text(value, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        Text(subtext, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun InsightPanel(
    title: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    content: @Composable () -> Unit
) {
    GlassCard(modifier = Modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, contentDescription = null, tint = ElectricCyan)
            Spacer(modifier = Modifier.width(8.dp))
            Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        }
        Spacer(modifier = Modifier.height(12.dp))
        content()
    }
}

@Composable
private fun InfoRow(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(
            value,
            style = MaterialTheme.typography.bodySmall,
            fontFamily = FontFamily.Monospace,
            modifier = Modifier.weight(1f),
            textAlign = androidx.compose.ui.text.style.TextAlign.End
        )
    }
}

@Composable
private fun BucketSection(title: String, buckets: Map<String, Int>) {
    val items = buckets.entries
        .filter { it.key.isNotBlank() && it.key != "Unknown" }
        .sortedByDescending { it.value }
        .take(6)
    if (items.isEmpty()) return

    Text(
        text = title,
        style = MaterialTheme.typography.labelMedium,
        fontWeight = FontWeight.SemiBold,
        modifier = Modifier.padding(bottom = 6.dp, top = 4.dp)
    )
    val max = items.maxOf { it.value }.coerceAtLeast(1)
    items.forEach { (label, count) ->
        Column(modifier = Modifier.padding(vertical = 4.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(label, style = MaterialTheme.typography.bodySmall)
                Text("$count", style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Bold)
            }
            Spacer(modifier = Modifier.height(4.dp))
            LinearProgressIndicator(
                progress = { count.toFloat() / max },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(5.dp),
                color = ElectricCyan
            )
        }
    }
}

private fun formatDate(raw: String?): String {
    if (raw.isNullOrBlank()) return "—"
    raw.toLongOrNull()?.let { epoch ->
        val millis = if (epoch < 1_000_000_000_000L) epoch * 1000 else epoch
        return SimpleDateFormat("MMM dd, yyyy HH:mm", Locale.getDefault()).format(Date(millis))
    }
    return raw
}

private fun formatHour(raw: String): String {
    return runCatching {
        SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).parse(raw)
    }.getOrNull()?.let {
        SimpleDateFormat("HH:mm", Locale.getDefault()).format(it)
    } ?: raw
}

private fun shorten(value: String): String {
    if (value.length <= 14) return value
    return "${value.take(6)}…${value.takeLast(4)}"
}
