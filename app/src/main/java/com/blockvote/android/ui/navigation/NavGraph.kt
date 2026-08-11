package com.blockvote.android.ui.navigation

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.navigation3.runtime.NavEntry
import androidx.navigation3.runtime.NavKey
import androidx.navigation3.ui.NavDisplay
import com.blockvote.android.ui.screens.dashboard.DashboardScreen
import com.blockvote.android.ui.screens.detail.ElectionDetailScreen
import com.blockvote.android.ui.screens.onboarding.OnboardingScreen
import com.blockvote.android.ui.screens.receipt.ReceiptScreen
import kotlinx.serialization.Serializable

@Serializable
sealed interface Route : NavKey {
    @Serializable
    data object Onboarding : Route
    @Serializable
    data object Dashboard : Route
    @Serializable
    data class ElectionDetail(val electionId: String) : Route
    @Serializable
    data class Receipt(val receiptId: String) : Route
}

@Composable
fun BlockVoteNavGraph() {
    val backStack = remember { mutableStateListOf<NavKey>(Route.Onboarding) }

    NavDisplay(
        backStack = backStack,
        onBack = { 
            if (backStack.size > 1) {
                backStack.removeLastOrNull() 
            }
        },
        entryProvider = { key ->
            when (key) {
                is Route.Onboarding -> NavEntry(key) {
                    OnboardingScreen(
                        onNavigateToDashboard = {
                            backStack.clear()
                            backStack.add(Route.Dashboard)
                        }
                    )
                }
                is Route.Dashboard -> NavEntry(key) {
                    DashboardScreen(
                        onNavigateToElection = { electionId ->
                            backStack.add(Route.ElectionDetail(electionId))
                        }
                    )
                }
                is Route.ElectionDetail -> NavEntry(key) {
                    ElectionDetailScreen(
                        electionId = key.electionId,
                        onNavigateToReceipt = { receiptId ->
                            backStack.add(Route.Receipt(receiptId))
                        },
                        onBack = {
                            if (backStack.size > 1) {
                                backStack.removeLastOrNull()
                            }
                        }
                    )
                }
                is Route.Receipt -> NavEntry(key) {
                    ReceiptScreen(
                        receiptId = key.receiptId,
                        onNavigateBackToDashboard = {
                            backStack.clear()
                            backStack.add(Route.Dashboard)
                        }
                    )
                }
                else -> NavEntry(key) { Text("Unknown Route") }
            }
        }
    )
}
