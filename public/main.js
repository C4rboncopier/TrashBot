// Define milestones
const MILESTONES = [
    { points: 100, name: "Recycling Rookie" },
    { points: 500, name: "Eco Warrior" },
    { points: 1000, name: "Sustainability Champion" },
    { points: 2500, name: "Environmental Hero" },
    { points: 5000, name: "Planet Savior" }
];

// Points needed for one ticket
const POINTS_PER_TICKET = 10;

// QR Scanner instance
let html5QrcodeScanner = null;

// Wait for Firebase to initialize before checking auth state
async function initializeApp() {
    try {
        // Wait for Firebase to initialize
        await window.firebaseInitialized;

        // Now we can safely use Firebase services
        firebase.auth().onAuthStateChanged((user) => {
            if (!user) {
                window.location.href = '/index.html';
                return;
            }
            
            loadUserData();
            loadLeaderboard();

            // Set up real-time listener for points updates
            const userRef = firebase.firestore().collection('users').doc(user.uid);
            userRef.onSnapshot((doc) => {
                if (doc.exists) {
                    const userData = doc.data();
                    updatePointsDisplay(userData.points);
                    updateMilestoneProgress(userData.points);
                }
            });
        });
    } catch (error) {
        console.error('Error initializing app:', error);
        // Show error to user
        const container = document.querySelector('.container');
        container.innerHTML = '<div class="error">Error loading application. Please try again later.</div>';
    }
}

// Load user data
async function loadUserData() {
    const userId = firebase.auth().currentUser.uid;
    const userRef = firebase.firestore().collection('users').doc(userId);

    try {
        const doc = await userRef.get();
        if (doc.exists) {
            const userData = doc.data();
            
            // Update welcome message
            document.getElementById('welcomeMessage').textContent = `Welcome, ${userData.fullName}!`;
            
            // Update points and milestone
            updatePointsDisplay(userData.points);
            updateMilestoneProgress(userData.points);

            // Initialize tickets array if it doesn't exist
            if (!userData.tickets) {
                await userRef.update({
                    tickets: []
                });
            }
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

// Function to calculate and update tickets based on points
async function updateTickets(points) {
    const userId = firebase.auth().currentUser.uid;
    const userRef = firebase.firestore().collection('users').doc(userId);

    try {
        const doc = await userRef.get();
        if (doc.exists) {
            const userData = doc.data();
            const currentTickets = userData.tickets || [];
            const ticketsEarned = Math.floor(points / POINTS_PER_TICKET);
            
            // Calculate how many new tickets to add
            const newTicketsNeeded = ticketsEarned - currentTickets.length;
            
            if (newTicketsNeeded > 0) {
                const newTickets = Array.from({ length: newTicketsNeeded }, () => ({
                    id: Date.now() + Math.random().toString(36).substr(2, 9),
                    dateEarned: new Date().toISOString()
                }));
                
                await userRef.update({
                    tickets: [...currentTickets, ...newTickets]
                });
            }
        }
    } catch (error) {
        console.error('Error updating tickets:', error);
    }
}

// Function to display tickets
async function displayTickets() {
    const userId = firebase.auth().currentUser.uid;
    const userRef = firebase.firestore().collection('users').doc(userId);

    try {
        const doc = await userRef.get();
        if (doc.exists) {
            const userData = doc.data();
            const tickets = userData.tickets || [];
            
            const ticketDisplay = document.createElement('div');
            ticketDisplay.className = 'ticket-display';
            
            ticketDisplay.innerHTML = `
                <div class="ticket-container">
                    <h3><i class="fas fa-ticket-alt"></i> Your Tickets</h3>
                    <div class="ticket-count">
                        <span class="count">${tickets.length}</span>
                        <span class="label">Available Tickets</span>
                    </div>
                    <button onclick="closeTicketDisplay()">Close</button>
                </div>
            `;
            
            document.body.appendChild(ticketDisplay);
        }
    } catch (error) {
        console.error('Error displaying tickets:', error);
    }
}

// Function to close ticket display
window.closeTicketDisplay = () => {
    const ticketDisplay = document.querySelector('.ticket-display');
    if (ticketDisplay) {
        ticketDisplay.remove();
    }
};

// Update points display and trigger ticket update
function updatePointsDisplay(points) {
    document.getElementById('userPoints').textContent = points;
    updateTickets(points);
}

function updateMilestoneProgress(points) {
    // Find next milestone
    let nextMilestone = MILESTONES[0];
    for (let i = 0; i < MILESTONES.length; i++) {
        if (points < MILESTONES[i].points) {
            nextMilestone = MILESTONES[i];
            break;
        }
    }

    // Calculate progress percentage
    let progress = (points / nextMilestone.points) * 100;
    progress = Math.min(progress, 100); // Ensure progress doesn't exceed 100%

    // Update the progress bar
    const progressBar = document.getElementById('milestoneProgress');
    progressBar.style.width = `${progress}%`;

    // Update milestone text
    const milestoneText = document.getElementById('milestoneText');
    if (points < MILESTONES[0].points) {
        milestoneText.textContent = `Progress to ${nextMilestone.name} (${points}/${nextMilestone.points} points)`;
    } else if (points >= MILESTONES[MILESTONES.length - 1].points) {
        milestoneText.textContent = `${MILESTONES[MILESTONES.length - 1].name} (Max Level!)`;
    } else {
        let currentMilestone;
        for (let i = MILESTONES.length - 1; i >= 0; i--) {
            if (points >= MILESTONES[i].points) {
                currentMilestone = MILESTONES[i];
                break;
            }
        }
        milestoneText.textContent = `${currentMilestone.name} → ${nextMilestone.name} (${points}/${nextMilestone.points} points)`;
    }

    // Add animation class to progress bar
    progressBar.classList.remove('milestone-progress-animation');
    void progressBar.offsetWidth; // Trigger reflow
    progressBar.classList.add('milestone-progress-animation');
}

// Load leaderboard
function loadLeaderboard() {
    const leaderboardElement = document.getElementById('leaderboard');
    leaderboardElement.innerHTML = ''; // Clear existing entries

    // Set up real-time listener for leaderboard updates
    const unsubscribe = firebase.firestore().collection('users')
        .orderBy('points', 'desc')
        .limit(10)
        .onSnapshot((snapshot) => {
            leaderboardElement.innerHTML = ''; // Clear existing entries
            
            snapshot.docs.forEach((doc, index) => {
                const userData = doc.data();
                const entry = document.createElement('div');
                entry.className = 'leaderboard-entry';
                
                const rankClass = index < 3 ? `rank-${index + 1}` : '';
                
                entry.innerHTML = `
                    <div class="rank ${rankClass}">#${index + 1}</div>
                    <div class="user-details">
                        <div class="user-name">${userData.fullName}</div>
                        <div class="user-grade">Grade ${userData.grade}</div>
                    </div>
                    <div class="user-points">${userData.points} pts</div>
                `;
                
                leaderboardElement.appendChild(entry);
            });
        }, (error) => {
            console.error('Error loading leaderboard:', error);
        });

    // Clean up listener when user logs out
    document.getElementById('logout').addEventListener('click', () => {
        unsubscribe();
    });
}

// Scan QR Code button
document.getElementById('scanQR').addEventListener('click', () => {
    if (!firebase.auth().currentUser) {
        alert('Please log in to scan QR codes');
        window.location.href = '/index.html';
        return;
    }

    const qrReader = document.getElementById('qr-reader');
    if (qrReader) {
        qrReader.style.display = 'flex';
        if (!html5QrcodeScanner) {
            html5QrcodeScanner = new Html5QrcodeScanner(
                "qr-reader",
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1.0,
                    formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
                    experimentalFeatures: {
                        useBarCodeDetectorIfSupported: true
                    },
                    rememberLastUsedCamera: true,
                    showTorchButtonIfSupported: true,
                    defaultZoomValueIfSupported: 2,
                    showZoomSliderIfSupported: true,
                    // Hide the initial permission button
                    hideInitialButtons: true,
                    // Customize button names
                    buttonNames: {
                        fileSelectionButton: 'Upload QR Image',
                        closeButton: 'Close Scanner'
                    }
                }
            );
            
            html5QrcodeScanner.render(async (decodedText) => {
                try {
                    const result = await decryptQRCode(decodedText);
                    const resultDiv = document.getElementById('scan-result');
                    resultDiv.style.display = 'flex';
                    resultDiv.innerHTML = `
                        <div class="result-box">
                            <h3>${result.isValid ? 'Success!' : 'Error'}</h3>
                            ${result.isValid 
                                ? `<p><i class="fas fa-coins"></i> Points: ${result.points}</p>`
                                : `<p class="error"> ${result.error}</p>`
                            }
                            <button onclick="closeScanResult()"><i class="fas fa-times"></i> Close</button>
                        </div>
                    `;
                    
                    if (result.isValid) {
                        html5QrcodeScanner.clear();
                        html5QrcodeScanner = null;
                        qrReader.style.display = 'none';
                    }
                } catch (error) {
                    console.error('Error processing QR code:', error);
                }
            });

            // Automatically start the camera after a short delay
            setTimeout(() => {
                const cameraPermissionButton = document.getElementById('qr-reader__camera_permission_button');
                if (cameraPermissionButton) {
                    cameraPermissionButton.click();
                }
            }, 100);
        }
    } else {
        console.error('QR reader element not found');
    }
});

// Function to close scan result
window.closeScanResult = () => {
    const resultDiv = document.getElementById('scan-result');
    resultDiv.style.display = 'none';
    
    if (html5QrcodeScanner) {
        html5QrcodeScanner.clear();
        html5QrcodeScanner = null;
    }
    
    const qrReader = document.getElementById('qr-reader');
    if (qrReader) {
        qrReader.style.display = 'none';
    }
};

// Logout functionality
document.getElementById('logout').addEventListener('click', async () => {
    try {
        await firebase.auth().signOut();
        localStorage.clear();
        window.location.href = '/index.html';
    } catch (error) {
        console.error('Error signing out:', error);
    }
});

// Add event listener for tickets button
document.getElementById('viewTickets').addEventListener('click', displayTickets);

// Start the application
initializeApp(); 