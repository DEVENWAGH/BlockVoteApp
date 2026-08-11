package com.blockvote.android.ui.screens.receipt

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.blockvote.android.domain.model.VoteReceipt
import com.blockvote.android.domain.repository.ElectionRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed interface ReceiptUiState {
    data object Loading : ReceiptUiState
    data class Success(val receipt: VoteReceipt) : ReceiptUiState
    data object Error : ReceiptUiState
}

@HiltViewModel
class ReceiptViewModel @Inject constructor(
    private val electionRepository: ElectionRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<ReceiptUiState>(ReceiptUiState.Loading)
    val uiState: StateFlow<ReceiptUiState> = _uiState.asStateFlow()

    fun loadReceipt(receiptId: String) {
        viewModelScope.launch {
            electionRepository.getReceiptById(receiptId)
                .collect { receipt ->
                    if (receipt != null) {
                        _uiState.value = ReceiptUiState.Success(receipt)
                    } else {
                        _uiState.value = ReceiptUiState.Error
                    }
                }
        }
    }
}
