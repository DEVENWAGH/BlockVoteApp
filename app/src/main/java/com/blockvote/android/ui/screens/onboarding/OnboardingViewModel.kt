package com.blockvote.android.ui.screens.onboarding

import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.ViewModel
import com.blockvote.android.ui.security.BiometricAuthenticator
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject

@HiltViewModel
class OnboardingViewModel @Inject constructor(
    private val biometricAuthenticator: BiometricAuthenticator
) : ViewModel() {

    private val _authState = MutableStateFlow<AuthState>(AuthState.Idle)
    val authState = _authState.asStateFlow()

    fun authenticate(activity: FragmentActivity, onAuthenticated: () -> Unit) {
        _authState.value = AuthState.Authenticating
        biometricAuthenticator.authenticate(activity) { success ->
            if (success) {
                _authState.value = AuthState.Authenticated
                onAuthenticated()
            } else {
                _authState.value = AuthState.Error("Authentication failed")
            }
        }
    }

    sealed interface AuthState {
        data object Idle : AuthState
        data object Authenticating : AuthState
        data object Authenticated : AuthState
        data class Error(val message: String) : AuthState
    }
}
