package com.blockvote.android.ui.screens.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.fragment.app.FragmentActivity
import androidx.hilt.navigation.compose.hiltViewModel
import com.blockvote.android.R
import com.blockvote.android.ui.components.PrimaryGradientButton
import com.blockvote.android.ui.theme.BlockVoteTheme
import com.blockvote.android.ui.theme.ElectricCyan

@Composable
fun OnboardingScreen(
    onNavigateToDashboard: () -> Unit,
    viewModel: OnboardingViewModel = hiltViewModel()
) {
    val authState by viewModel.authState.collectAsState()
    val context = LocalContext.current

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            painter = androidx.compose.ui.res.painterResource(id = R.drawable.ic_shield),
            contentDescription = "BlockVote Logo",
            tint = ElectricCyan,
            modifier = Modifier.size(120.dp)
        )
        
        Spacer(modifier = Modifier.height(24.dp))
        
        Text(
            text = "BlockVote",
            style = MaterialTheme.typography.displayMedium,
            color = MaterialTheme.colorScheme.onBackground,
            fontWeight = FontWeight.Black
        )
        
        Text(
            text = "Secure, Immutable, Decentralized Voting.",
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f),
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(horizontal = 32.dp)
        )
        
        Spacer(modifier = Modifier.height(64.dp))
        
        PrimaryGradientButton(
            text = "Verify Identity & Unlock Wallet",
            onClick = {
                (context as? FragmentActivity)?.let { activity ->
                    viewModel.authenticate(activity, onNavigateToDashboard)
                }
            },
            modifier = Modifier.fillMaxWidth(),
            icon = androidx.compose.ui.res.painterResource(id = R.drawable.ic_fingerprint)
        )
        
        if (authState is OnboardingViewModel.AuthState.Error) {
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = (authState as OnboardingViewModel.AuthState.Error).message,
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodySmall
            )
        }
    }
}

@Preview(showBackground = true, device = "spec:width=411dp,height=891dp")
@Composable
fun OnboardingScreenPreview() {
    BlockVoteTheme {
        OnboardingScreen(onNavigateToDashboard = {})
    }
}
