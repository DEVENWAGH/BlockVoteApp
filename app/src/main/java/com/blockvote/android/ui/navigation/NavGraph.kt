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
    val start: NavKey = if (!deepLinkElectionId.isNullOrBlank()) {
        Route.VotePortal(deepLinkElectionId)
    } else {
        Route.Onboarding
    }
    val backStack = remember(deepLinkElectionId) { mutableStateListOf(start) }

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
                        },
                        onNavigateToVote = {
                            backStack.clear()
                            backStack.add(Route.VotePortal())
                        },
                        onNavigateToTwinRequest = {
                            backStack.add(Route.TwinRequest())
                        }
                    )
                }
                is Route.Dashboard -> NavEntry(key) {
                    DashboardScreen(
                        onNavigateToElection = { electionId ->
                            backStack.add(Route.ElectionDetail(electionId))
                        },
                        onNavigateToVote = {
                            backStack.add(Route.VotePortal())
                        }
                    )
                }
                is Route.VotePortal -> NavEntry(key) {
                    VotePortalScreen(
                        initialElectionId = key.electionId.ifBlank { null },
                        onFinished = {
                            if (backStack.size > 1) {
                                backStack.removeLastOrNull()
                            } else {
                                backStack.clear()
                                backStack.add(Route.Dashboard)
                            }
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
                is Route.TwinRequest -> NavEntry(key) {
                    TwinRequestScreen(
                        initialElectionId = key.electionId.ifBlank { null },
                        initialEmail = key.email.ifBlank { null },
                        onBack = {
                            if (backStack.size > 1) {
                                backStack.removeLastOrNull()
                            }
                        }
                    )
                }
                else -> NavEntry(key) { Text("Unknown Route") }
            }
        }
    )
}
