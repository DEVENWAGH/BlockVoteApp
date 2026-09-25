package com.blockvote.android.ui.navigation

import androidx.activity.compose.BackHandler
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
import com.blockvote.android.ui.screens.twin.TwinRequestScreen
import com.blockvote.android.ui.screens.vote.VotePortalScreen
import kotlinx.serialization.Serializable

@Serializable
sealed interface Route : NavKey {
    @Serializable
    data object Onboarding : Route
    @Serializable
    data object Dashboard : Route
    @Serializable
    data class VotePortal(val electionId: String = "") : Route
    @Serializable
    data class ElectionDetail(val electionId: String) : Route
    @Serializable
    data class Receipt(val receiptId: String) : Route
    @Serializable
    data class TwinRequest(
        val electionId: String = "",
        val email: String = ""
    ) : Route
}

@Composable
fun BlockVoteNavGraph(deepLinkElectionId: String? = null) {
    val start: NavKey = if (deepLinkElectionId != null) {
        Route.VotePortal(deepLinkElectionId)
    } else {
        Route.Onboarding
    }
    val backStack = remember(deepLinkElectionId) { mutableStateListOf(start) }

    fun popOrHome() {
        if (backStack.size > 1) {
            backStack.removeLastOrNull()
        } else {
            backStack.clear()
            backStack.add(Route.Onboarding)
        }
    }

    // Edge swipe / system back when there is somewhere to go
    BackHandler(enabled = backStack.size > 1) {
        backStack.removeLastOrNull()
    }

    NavDisplay(
        backStack = backStack,
        onBack = { popOrHome() },
        entryProvider = { key ->
            when (key) {
                is Route.Onboarding -> NavEntry(key) {
                    OnboardingScreen(
                        onNavigateToDashboard = {
                            backStack.add(Route.Dashboard)
                        },
                        onNavigateToVote = {
                            backStack.add(Route.VotePortal())
                        },
                        onNavigateToTwinRequest = {
                            backStack.add(Route.TwinRequest())
                        }
                    )
                }
                is Route.Dashboard -> NavEntry(key) {
                    DashboardScreen(
                        onBack = { popOrHome() },
                        onNavigateToElection = { electionId ->
                            backStack.add(Route.VotePortal(electionId))
                        },
                        onNavigateToVote = {
                            backStack.add(Route.VotePortal())
                        }
                    )
                }
                is Route.VotePortal -> NavEntry(key) {
                    VotePortalScreen(
                        initialElectionId = key.electionId.ifBlank { null },
                        onFinished = { popOrHome() },
                        onNavigateToElectionDetail = { electionId ->
                            backStack.add(Route.ElectionDetail(electionId))
                        },
                        onNavigateToTwinRequest = { electionId, email ->
                            backStack.add(Route.TwinRequest(electionId, email))
                        }
                    )
                }
                is Route.ElectionDetail -> NavEntry(key) {
                    ElectionDetailScreen(
                        electionId = key.electionId,
                        onNavigateToReceipt = { receiptId ->
                            backStack.add(Route.Receipt(receiptId))
                        },
                        onBack = { popOrHome() }
                    )
                }
                is Route.Receipt -> NavEntry(key) {
                    ReceiptScreen(
                        receiptId = key.receiptId,
                        onBack = { popOrHome() },
                        onNavigateBackToDashboard = {
                            backStack.clear()
                            backStack.add(Route.Dashboard)
                        }
                    )
                }
                is Route.TwinRequest -> NavEntry(key) {
                    TwinRequestScreen(
                        initialElectionId = key.electionId.ifBlank { null },
                        initialEmail = key.email.ifBlank { null },
                        onBack = { popOrHome() }
                    )
                }
                else -> NavEntry(key) { Text("Unknown Route") }
            }
        }
    )
}
