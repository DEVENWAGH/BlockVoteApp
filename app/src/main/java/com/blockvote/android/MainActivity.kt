package com.blockvote.android

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.fragment.app.FragmentActivity
import com.blockvote.android.ui.navigation.BlockVoteNavGraph
import com.blockvote.android.ui.theme.BlockVoteTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : FragmentActivity() {
    private val incomingVoteElectionId = mutableStateOf<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        incomingVoteElectionId.value = parseIncomingVote(intent?.data)
        enableEdgeToEdge()
        setContent {
            val deepLinkElectionId by incomingVoteElectionId
            BlockVoteTheme {
                Scaffold(modifier = Modifier.fillMaxSize()) { innerPadding ->
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(innerPadding)
                    ) {
                        BlockVoteNavGraph(deepLinkElectionId = deepLinkElectionId)
                    }
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        incomingVoteElectionId.value = parseIncomingVote(intent.data)
    }

    /**
     * @return null for a normal cold start; election id (possibly empty) when the
     * intent should open the in-app vote portal.
     */
    private fun parseIncomingVote(uri: Uri?): String? {
        if (uri == null) return null
        if (uri.scheme == "blockvote" && (uri.host == "vote" || uri.host == "portal")) {
            return uri.pathSegments.firstOrNull().orEmpty()
        }
        val segments = uri.pathSegments
        val first = segments.firstOrNull() ?: return null
        if (first == "go" || first == "portal") {
            return segments.getOrNull(1).orEmpty()
        }
        if (first == "org") {
            val electionIndex = segments.indexOf("election")
            if (electionIndex != -1) {
                return segments.getOrNull(electionIndex + 2).orEmpty()
            }
        }
        return null
    }
}
