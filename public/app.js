// Form switching functionality
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const showRegisterLink = document.getElementById('showRegister');
const showLoginLink = document.getElementById('showLogin');

showRegisterLink.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
});

showLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    registerForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
});

async function initializeApp() {
    try {
        // Wait for Firebase to initialize
        await window.firebaseInitialized;

        // Form submission handling
        document.getElementById('login').addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('loginUsername').value;
            const password = document.getElementById('loginPassword').value;
            const submitButton = e.target.querySelector('button[type="submit"]');
            const loadingOverlay = document.getElementById('loadingOverlay');
            const loadingText = loadingOverlay.querySelector('.loading-text');

            try {
                // Disable submit button and show loading overlay
                submitButton.disabled = true;
                loadingText.textContent = 'Logging in...';
                loadingOverlay.classList.remove('hidden');

                // Query Firestore to find user with matching username
                const usersRef = firebase.firestore().collection('users');
                const snapshot = await usersRef.where('username', '==', username).get();

                if (snapshot.empty) {
                    showError('Username not found. Please check your username and try again.');
                    return;
                }

                const userDoc = snapshot.docs[0];
                const userData = userDoc.data();

                try {
                    // Sign in with email and password
                    const result = await firebase.auth().signInWithEmailAndPassword(userData.email, password);
                    
                    if (result.user) {
                        // Store user data in localStorage
                        localStorage.setItem('userId', userDoc.id);
                        localStorage.setItem('userData', JSON.stringify(userData));
                        
                        // Redirect based on user type
                        if (userData.username === 'admin') {
                            window.location.href = '/admin.html';
                        } else {
                            window.location.href = '/main.html';
                        }
                    }
                } catch (authError) {
                    // Handle specific Firebase auth errors
                    switch (authError.code) {
                        case 'auth/wrong-password':
                            showError('Incorrect password. Please try again.');
                            break;
                        case 'auth/too-many-requests':
                            showError('Too many failed login attempts. Please try again later.');
                            break;
                        case 'auth/user-disabled':
                            showError('This account has been disabled. Please contact support.');
                            break;
                        default:
                            showError('Login failed. Please check your credentials and try again.');
                    }
                }
            } catch (error) {
                showError('An error occurred. Please try again later.');
                console.error('Login error:', error);
            } finally {
                // Re-enable submit button and hide loading overlay
                submitButton.disabled = false;
                loadingOverlay.classList.add('hidden');
            }
        });

        document.getElementById('register').addEventListener('submit', async (e) => {
            e.preventDefault();
            const fullName = document.getElementById('fullName').value;
            const grade = document.getElementById('grade').value;
            const studentId = document.getElementById('studentId').value;
            const email = document.getElementById('email').value;
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            const submitButton = e.target.querySelector('button[type="submit"]');
            const loadingOverlay = document.getElementById('loadingOverlay');
            const loadingText = loadingOverlay.querySelector('.loading-text');

            if (password !== confirmPassword) {
                showError('Passwords do not match');
                return;
            }

            try {
                // Disable submit button and show loading overlay
                submitButton.disabled = true;
                loadingText.textContent = 'Registering...';
                loadingOverlay.classList.remove('hidden');
                
                // Check if username already exists
                const usernameCheck = await firebase.firestore().collection('users')
                    .where('username', '==', username).get();
                
                if (!usernameCheck.empty) {
                    showError('Username already exists');
                    return;
                }

                // Create auth user
                const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
                
                // Create user document in Firestore
                const userData = {
                    fullName,
                    grade,
                    studentId,
                    email,
                    username,
                    points: 0,
                    milestones: [],
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };

                await firebase.firestore().collection('users').doc(userCredential.user.uid).set(userData);

                showSuccess('Registration successful! Please login.');
                
                // Switch to login form
                registerForm.classList.add('hidden');
                loginForm.classList.remove('hidden');
            } catch (error) {
                showError(error.message);
            } finally {
                // Re-enable submit button and hide loading overlay
                submitButton.disabled = false;
                loadingOverlay.classList.add('hidden');
            }
        });
    } catch (error) {
        console.error('Error initializing app:', error);
        // Show error to user
        const container = document.querySelector('.container');
        container.innerHTML = '<div class="error">Error loading application. Please try again later.</div>';
    }
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error';
    errorDiv.textContent = message;
    
    // Remove any existing error messages
    document.querySelectorAll('.error').forEach(el => el.remove());
    
    // Add new error message
    document.querySelector('.container').appendChild(errorDiv);
    
    // Remove error after 3 seconds
    setTimeout(() => errorDiv.remove(), 3000);
}

function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success';
    successDiv.textContent = message;
    
    // Remove any existing success messages
    document.querySelectorAll('.success').forEach(el => el.remove());
    
    // Add new success message
    document.querySelector('.container').appendChild(successDiv);
    
    // Remove success message after 3 seconds
    setTimeout(() => successDiv.remove(), 3000);
}

// Start the application
initializeApp(); 