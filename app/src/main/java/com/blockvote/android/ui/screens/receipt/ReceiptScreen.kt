package com.blockvote.android.ui.screens.receipt

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.blockvote.android.R
import com.blockvote.android.domain.model.VoteReceipt
import com.blockvote.android.ui.components.GlassCard
import com.blockvote.android.ui.components.PrimaryGradientButton
import com.blockvote.android.ui.theme.BlockVoteTheme
import com.blockvote.android.ui.theme.ElectricCyan
import com.blockvote.android.ui.theme.EmeraldGreen
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun ReceiptScreen(
    receiptId: String,
    onBack: () -> Unit = {},
    onNavigateBackToDashboard: () -> Unit,
    viewModel: ReceiptViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    BackHandler { onBack() }

    LaunchedEffect(receiptId) {
        viewModel.loadReceipt(receiptId)
    }

    Scaffold(
        topBar = {
            @OptIn(ExperimentalMaterial3Api::class)
            TopAppBar(
                title = { Text("Vote receipt") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            Icons.AutoMirrored.Rounded.ArrowBack,
                            contentDescription = "Back"
                        )
                    }
                }
            )
        },
        bottomBar = {
            Box(modifier = Modifier.padding(24.dp).navigationBarsPadding()) {
                OutlinedButton(
                    onClick = onNavigateBackToDashboard,
                    modifier = Modifier.fillMaxWidth(),
                    shape = androidx.compose.foundation.shape.RoundedCornerShape(12.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, ElectricCyan)
                ) {
                    Text("Back to Dashboard", color = ElectricCyan)
                }
            }
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            when (val state = uiState) {
                is ReceiptUiState.Loading -> {
                    CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                }
                is ReceiptUiState.Success -> {
                    ReceiptContent(receipt = state.receipt)
                }
                is ReceiptUiState.Error -> {
                    Text(
                        text = "Failed to load receipt",
                        modifier = Modifier.align(Alignment.Center),
                        color = MaterialTheme.colorScheme.error
                    )
                }
            }
        }
    }
}

@Composable
fun ReceiptContent(receipt: VoteReceipt) {
    val dateFormat = remember { SimpleDateFormat("MMM dd, yyyy HH:mm:ss", Locale.getDefault()) }
    val clipboardManager = LocalClipboardManager.current

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(modifier = Modifier.height(32.dp))
        
        Icon(
            imageVector = Icons.Rounded.CheckCircle,
            contentDescription = "Success",
            tint = EmeraldGreen,
            modifier = Modifier.size(80.dp)
        )
        
        Spacer(modifier = Modifier.height(16.dp))
        
        Text(
            text = "Vote Successfully Cast",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold,
            color = EmeraldGreen
        )
        
        Spacer(modifier = Modifier.height(32.dp))
        
        GlassCard(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.fillMaxWidth()) {
                ReceiptDetailItem(
                    label = "Transaction ID",
                    value = receipt.transactionId,
                    onCopy = { clipboardManager.setText(AnnotatedString(receipt.transactionId)) }
                )
                
                HorizontalDivider(modifier = Modifier.padding(vertical = 12.dp), color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.1f))
                
                ReceiptDetailItem(
                    label = "Cryptographic Hash",
                    value = receipt.hash.take(12) + "..." + receipt.hash.takeLast(12),
                    onCopy = { clipboardManager.setText(AnnotatedString(receipt.hash)) }
                )
                
                HorizontalDivider(modifier = Modifier.padding(vertical = 12.dp), color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.1f))
                
                ReceiptDetailItem(
                    label = "Timestamp",
                    value = dateFormat.format(Date(receipt.timestamp))
                )
            }
        }
        
        Spacer(modifier = Modifier.height(24.dp))
        
        GlassCard(
            modifier = Modifier.size(200.dp),
            contentPadding = 0.dp
        ) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Icon(
                    painter = androidx.compose.ui.res.painterResource(id = R.drawable.ic_qr_code),
                    contentDescription = "QR Code",
                    tint = ElectricCyan.copy(alpha = 0.5f),
                    modifier = Modifier.size(120.dp)
                )
            }
        }
        
        Spacer(modifier = Modifier.height(24.dp))
        
        Surface(
            color = ElectricCyan.copy(alpha = 0.1f),
            shape = androidx.compose.foundation.shape.RoundedCornerShape(16.dp),
            border = androidx.compose.foundation.BorderStroke(1.dp, ElectricCyan.copy(alpha = 0.5f))
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    painter = androidx.compose.ui.res.painterResource(id = R.drawable.ic_shield),
                    contentDescription = null,
                    tint = ElectricCyan,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Immutable Audit Trail",
                    color = ElectricCyan,
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

@Composable
fun ReceiptDetailItem(
    label: String,
    value: String,
    onCopy: (() -> Unit)? = null
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = value,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium,
                modifier = Modifier.weight(1f)
            )
            if (onCopy != null) {
                IconButton(onClick = onCopy) {
                    Icon(
                        painter = androidx.compose.ui.res.painterResource(id = R.drawable.ic_copy),
                        contentDescription = "Copy",
                        tint = ElectricCyan,
                        modifier = Modifier.size(18.dp)
                    )
                }
            }
        }
    }
}

@Preview(showBackground = true, backgroundColor = 0xFF0A0F1D)
@Composable
fun ReceiptPreview() {
    val mockReceipt = VoteReceipt(
        transactionId = "TX-8829-XJ2",
        voterId = "voter_123",
        electionId = "1",
        candidateId = "1",
        timestamp = System.currentTimeMillis(),
        hash = "0x8fa23b2c9e1d4f5a6b7c8d9e0f1a2b3c4d5e6f7a"
    )
    
    BlockVoteTheme(darkTheme = true) {
        Surface(color = MaterialTheme.colorScheme.background) {
            ReceiptContent(receipt = mockReceipt)
        }
    }
}
