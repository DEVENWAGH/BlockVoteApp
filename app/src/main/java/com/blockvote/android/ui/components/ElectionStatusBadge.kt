package com.blockvote.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.blockvote.android.domain.model.ElectionStatus
import com.blockvote.android.domain.model.label
import com.blockvote.android.ui.theme.CyberAmber
import com.blockvote.android.ui.theme.EmeraldGreen

/** Same words as the web: Not open / Voting open / Closed. */
@Composable
fun ElectionStatusBadge(
    status: ElectionStatus,
    modifier: Modifier = Modifier
) {
    val label = status.label()
    val (backgroundColor, textColor) = when (status) {
        ElectionStatus.LIVE -> EmeraldGreen.copy(alpha = 0.2f) to EmeraldGreen
        ElectionStatus.UPCOMING -> CyberAmber.copy(alpha = 0.2f) to CyberAmber
        ElectionStatus.CLOSED ->
            MaterialTheme.colorScheme.onSurface.copy(alpha = 0.1f) to
                MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
    }

    Box(
        modifier = modifier
            .background(backgroundColor, RoundedCornerShape(8.dp))
            .padding(horizontal = 8.dp, vertical = 4.dp)
    ) {
        Text(
            text = label,
            color = textColor,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.5.sp
        )
    }
}
