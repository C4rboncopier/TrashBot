// Fetch Firebase configuration from server
async function initializeFirebase() {
    try {
        const response = await fetch('/firebase-config');
        const firebaseConfig = await response.json();
        
        // Initialize Firebase with the fetched configuration
        firebase.initializeApp(firebaseConfig);
        return true;
    } catch (error) {
        console.error('Error initializing Firebase:', error);
        return false;
    }
}

// Initialize Firebase when the script loads and expose the promise
window.firebaseInitialized = initializeFirebase(); 