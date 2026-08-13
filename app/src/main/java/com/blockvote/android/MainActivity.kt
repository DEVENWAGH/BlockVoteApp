package com.blockvote.android

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
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.fragment.app.FragmentActivity
import com.blockvote.android.ui.navigation.BlockVoteNavGraph
import com.blockvote.android.ui.theme.BlockVoteTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : FragmentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            var deepLinkElectionId by remember {
                mutableStateOf(parseElectionId(intent?.data))
            }
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

    private fun parseElectionId(uri: Uri?): String? {
        if (uri == null) return null
        // blockvote://vote/{electionId}
        if (uri.scheme == "blockvote" && uri.host == "vote") {
            return uri.pathSegments.firstOrNull()?.takeIf { it.isNotBlank() }
        }
        // https://host/go/{electionId} (if App Links are configured later)
        if (uri.host != null && uri.pathSegments.firstOrNull() == "go") {
            return uri.pathSegments.getOrNull(1)?.takeIf { it.isNotBlank() }
        }
        return null
    }
}
