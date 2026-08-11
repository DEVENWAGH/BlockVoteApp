package com.blockvote.android.ui.screens.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.blockvote.android.domain.model.Election
import com.blockvote.android.domain.model.ElectionStatus
import com.blockvote.android.ui.components.ElectionStatusBadge
import com.blockvote.android.ui.components.GlassCard
import com.blockvote.android.ui.components.SecurityShieldHeader
import com.blockvote.android.ui.theme.BlockVoteTheme

@Composable
fun DashboardScreen(
    onNavigateToElection: (String) -> Unit,
    viewModel: DashboardViewModel = hiltViewModel()
) {
    val elections by viewModel.elections.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(horizontal = 20.dp)
    ) {
        Spacer(modifier = Modifier.height(24.dp))
        SecurityShieldHeader()
        
        Spacer(modifier = Modifier.height(32.dp))
        
        Text(
            text = "Active Elections",
            style = MaterialTheme.typography.titleLarge,
            color = MaterialTheme.colorScheme.onBackground,
            fontWeight = FontWeight.Bold
        )
        
        Spacer(modifier = Modifier.height(16.dp))
        
        ActiveElectionsCarousel(
            elections = elections.filter { it.status == ElectionStatus.LIVE },
            onElectionClick = onNavigateToElection
        )
        
        Spacer(modifier = Modifier.height(32.dp))
        
        Text(
            text = "Recent Activity",
            style = MaterialTheme.typography.titleLarge,
            color = MaterialTheme.colorScheme.onBackground,
            fontWeight = FontWeight.Bold
        )
        
        Spacer(modifier = Modifier.height(16.dp))
        
        RecentActivityList(
            elections = elections.filter { it.status != ElectionStatus.LIVE }
        )
    }
}

@Composable
fun ActiveElectionsCarousel(
    elections: List<Election>,
    onElectionClick: (String) -> Unit
) {
    LazyRow(
        horizontalArrangement = Arrangement.spacedBy(16.dp),
        contentPadding = PaddingValues(end = 20.dp)
    ) {
        items(elections) { election ->
            ElectionCard(
                election = election,
                onClick = { onElectionClick(election.id) }
            )
        }
    }
}

@Composable
fun ElectionCard(
    election: Election,
    onClick: () -> Unit
) {
    GlassCard(
        modifier = Modifier
            .width(280.dp)
            .height(160.dp),
        onClick = onClick
    ) {
        Column(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Column {
                ElectionStatusBadge(status = election.status)
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = election.title,
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                    fontWeight = FontWeight.Bold
                )
            }
            Text(
                text = "Ends in 2 days", // Mock end time
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
            )
        }
    }
}

@Composable
fun RecentActivityList(elections: List<Election>) {
    LazyColumn(
        verticalArrangement = Arrangement.spacedBy(12.dp),
        modifier = Modifier.fillMaxWidth(),
        contentPadding = PaddingValues(bottom = 24.dp)
    ) {
        items(elections) { election ->
            GlassCard(modifier = Modifier.fillMaxWidth()) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column {
                        Text(
                            text = election.title,
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurface,
                            fontWeight = FontWeight.Medium
                        )
                        Text(
                            text = "Vote confirmed on blockchain",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                        )
                    }
                    ElectionStatusBadge(status = election.status)
                }
            }
        }
    }
}

@Preview(showBackground = true, device = "spec:width=411dp,height=891dp")
@Composable
fun DashboardScreenPreview() {
    BlockVoteTheme {
        DashboardScreen(onNavigateToElection = {})
    }
}
