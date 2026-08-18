package com.blockvote.android.ui.screens.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.blockvote.android.domain.model.Election
import com.blockvote.android.domain.repository.ElectionRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.onStart
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

data class DashboardUiState(
    val elections: List<Election> = emptyList(),
    val loading: Boolean = true,
    val error: String? = null
)

@HiltViewModel
class DashboardViewModel @Inject constructor(
    private val electionRepository: ElectionRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(DashboardUiState())
    val uiState: StateFlow<DashboardUiState> = _uiState.asStateFlow()

    /** Kept for previews / simple collectors. */
    val elections: StateFlow<List<Election>> = electionRepository.getElections()
        .catch { }
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = emptyList()
        )

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(loading = true, error = null)
            electionRepository.getElections()
                .onStart { }
                .catch { e ->
                    _uiState.value = DashboardUiState(
                        loading = false,
                        error = e.message ?: "Could not load live elections"
                    )
                }
                .collect { list ->
                    _uiState.value = DashboardUiState(
                        elections = list,
                        loading = false,
                        error = null
                    )
                }
        }
    }
}
