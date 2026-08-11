package com.blockvote.android.ui.theme

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

fun Modifier.glassmorphism(
    shape: Shape,
    blurRadius: Dp = 12.dp,
    borderWidth: Dp = 1.dp
): Modifier = this
    .clip(shape)
    .blur(blurRadius)
    .background(
        Brush.verticalGradient(
            colors = listOf(
                Color.White.copy(alpha = 0.15f),
                Color.White.copy(alpha = 0.05f)
            )
        )
    )
    .border(
        width = borderWidth,
        brush = Brush.verticalGradient(
            colors = listOf(
                Color.White.copy(alpha = 0.2f),
                Color.White.copy(alpha = 0.05f)
            )
        ),
        shape = shape
    )
