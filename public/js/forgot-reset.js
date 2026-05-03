// ===== PASSWORD RESET SCRIPT v2 (external) =====
const VERSION = Date.now();

function checkPasswordStrength(password) {
    const strengthBar = document.getElementById('password-strength');
    if (!strengthBar) return;
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;
    const widths = ['0%', '20%', '40%', '60%', '80%', '100%'];
    const colors = ['bg-danger', 'bg-warning', 'bg-warning', 'bg-info', 'bg-success', 'bg-success'];
    strengthBar.style.width = widths[strength];
    strengthBar.className = 'progress-bar ' + colors[strength];
}

function showAlert(message, type = 'danger') {
    const alertDiv = document.getElementById('messageAlert');
    if (!alertDiv) return;
    alertDiv.innerHTML = `<div class="alert alert-${type} alert-dismissible fade show" role="alert">
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>`;
}

function showSpinner(btnId) {
    const textEl = document.getElementById(btnId + 'Text');
    const spinnerEl = document.getElementById(btnId + 'Spinner');
    if (textEl) textEl.classList.add('d-none');
    if (spinnerEl) spinnerEl.classList.remove('d-none');
}

function hideSpinner(btnId) {
    const textEl = document.getElementById(btnId + 'Text');
    const spinnerEl = document.getElementById(btnId + 'Spinner');
    if (textEl) textEl.classList.remove('d-none');
    if (spinnerEl) spinnerEl.classList.add('d-none');
}

function hideAllSteps() {
    ['step1', 'step2', 'step3', 'step4'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('d-none');
    });
}

function showStep(stepNum) {
    hideAllSteps();
    const el = document.getElementById('step' + stepNum);
    if (el) el.classList.remove('d-none');
}

let currentEmail = '';

// Try immediate binding
function initializeForm() {
    const sendOtpBtn = document.getElementById('sendOtpBtn');
    
    if (sendOtpBtn) {
        sendOtpBtn.onclick = async function(e) {
            e.preventDefault();
            const email = document.getElementById('email').value;
            
            if (!email) {
                showAlert('Please enter your email', 'warning');
                return;
            }
            
            currentEmail = email;
            showSpinner('sendOtp');
            
            try {
                const response = await fetch('/auth/forgot-reset/send-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    showAlert('OTP sent to your email!', 'success');
                    document.getElementById('emailDisplay').textContent = email;
                    setTimeout(() => showStep(2), 1000);
                } else {
                    showAlert(data.message || 'Error sending OTP', 'danger');
                }
            } catch (error) {
                console.error('❌ Error:', error);
                showAlert('Error: ' + error.message, 'danger');
            } finally {
                hideSpinner('sendOtp');
            }
        };
        
    } else {
        console.error('sendOtpBtn not found!');
    }
    
    const verifyOtpBtn = document.getElementById('verifyOtpBtn');
    if (verifyOtpBtn) {
        verifyOtpBtn.onclick = async function(e) {
            e.preventDefault();
            const email = currentEmail;
            const otp = document.getElementById('otp').value;
            if (!otp || otp.length !== 6) {
                showAlert('Please enter a valid 6-digit OTP', 'warning');
                return;
            }
            showSpinner('verifyOtp');
            try {
                const response = await fetch('/auth/forgot-reset/verify-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, otp })
                });
                const data = await response.json();
                if (response.ok) {
                    showAlert('OTP verified successfully!', 'success');
                    setTimeout(() => showStep(3), 1000);
                } else {
                    showAlert(data.message || 'Invalid OTP', 'danger');
                }
            } catch (error) {
                showAlert('Error: ' + error.message, 'danger');
            } finally {
                hideSpinner('verifyOtp');
            }
        };
    }
    
    const resetPasswordBtn = document.getElementById('resetPasswordBtn');
    if (resetPasswordBtn) {
        resetPasswordBtn.onclick = async function(e) {
            e.preventDefault();
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            if (!newPassword || newPassword.length < 6) {
                showAlert('Password must be at least 6 characters', 'warning');
                return;
            }
            if (newPassword !== confirmPassword) {
                showAlert('Passwords do not match', 'warning');
                return;
            }
            showSpinner('resetPassword');
            try {
                const response = await fetch('/auth/forgot-reset/reset-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ newPassword })
                });
                const data = await response.json();
                if (response.ok) {
                    showAlert('Password reset successfully!', 'success');
                    setTimeout(() => showStep(4), 1000);
                } else {
                    showAlert(data.message || 'Error resetting password', 'danger');
                }
            } catch (error) {
                showAlert('Error: ' + error.message, 'danger');
            } finally {
                hideSpinner('resetPassword');
            }
        };
    }
    
    const resendOtpBtn = document.getElementById('resendOtpBtn');
    if (resendOtpBtn) {
        resendOtpBtn.onclick = async function(e) {
            e.preventDefault();
            showSpinner('resendOtp');
            try {
                const response = await fetch('/auth/forgot-reset/send-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: currentEmail })
                });
                const data = await response.json();
                if (response.ok) {
                    showAlert(' OTP resent to your email!', 'success');
                } else {
                    showAlert(data.message || 'Error resending OTP', 'danger');
                }
            } catch (error) {
                showAlert('Error: ' + error.message, 'danger');
            } finally {
                hideSpinner('resendOtp');
            }
        };
    }
    
    const otpInput = document.getElementById('otp');
    if (otpInput) {
        otpInput.onkeypress = function(e) {
            if (!/[0-9]/.test(e.key)) {
                e.preventDefault();
            }
        };
    }
}

// Initialize immediately
initializeForm();

// Also try with setTimeout as fallback
setTimeout(() => {
    initializeForm();
}, 500);

// Also try with DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    initializeForm();
});
