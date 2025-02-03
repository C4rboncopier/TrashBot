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

// Notifications functionality
let notifications = [];
let unreadCount = 0;

// Wait for Firebase to initialize before checking auth state
async function initializeApp() {
    try {
        // Wait for Firebase to initialize
        await window.firebaseInitialized;

        // Now we can safely use Firebase services
        firebase.auth().onAuthStateChanged(async (user) => {
            if (!user) {
                window.location.href = '/index.html';
                return;
            }

            // Check if user is admin
            const userRef = firebase.firestore().collection('users').doc(user.uid);
            const userDoc = await userRef.get();
            
            if (userDoc.exists && userDoc.data().username === 'admin') {
                window.location.href = '/admin.html';
                return;
            }
            
            loadUserData();
            loadLeaderboard();
            initializeNotifications();
            setupNotificationListeners();

            // Set up real-time listener for points updates
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
            // Initialize tickets array if it doesn't exist
            if (!userData.tickets) {
                await userRef.update({
                    tickets: []
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
                    <p class="ticket-info">Earn tickets by recycling trash!</p>
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

// Update points display
function updatePointsDisplay(points) {
    document.getElementById('userPoints').textContent = points;
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
        .limit(20) // Increased limit to account for potential ties
        .onSnapshot((snapshot) => {
            leaderboardElement.innerHTML = ''; // Clear existing entries
            
            let lastPoints = -1;  // Track last points for tie detection
            let currentRank = 0;  // Track current rank
            let displayedCount = 0;  // Track number of displayed entries
            
            snapshot.docs.forEach((doc) => {
                const userData = doc.data();
                
                // Skip admin account
                if (userData.username === 'admin') {
                    return;
                }
                
                // If points are different from last entry, increment rank
                if (userData.points !== lastPoints) {
                    currentRank = displayedCount + 1;
                }
                
                // Only show if within top 5 ranks
                if (currentRank <= 5) {
                    const entry = document.createElement('div');
                    entry.className = 'leaderboard-entry';
                    
                    const rankClass = currentRank <= 3 ? `rank-${currentRank}` : '';
                    
                    entry.innerHTML = `
                        <div class="rank ${rankClass}">#${currentRank}</div>
                        <div class="user-details">
                            <div class="user-name">${userData.fullName}</div>
                            <div class="user-grade">Grade ${userData.grade}</div>
                        </div>
                        <div class="user-points">${userData.points} pts</div>
                    `;
                    
                    leaderboardElement.appendChild(entry);
                    displayedCount++;
                }
                
                lastPoints = userData.points;
            });
        }, (error) => {
            console.error('Error loading leaderboard:', error);
        });

    // Clean up listener when user logs out
    document.getElementById('logout').addEventListener('click', () => {
        unsubscribe();
    });
}

// Function to stop and hide QR scanner
function stopAndHideScanner() {
    const qrReader = document.getElementById('qr-reader');
    if (qrReader) {
        qrReader.style.display = 'none';
        if (html5QrcodeScanner) {
            html5QrcodeScanner.clear();
            html5QrcodeScanner = null;  // Reset the scanner instance
        }
    }
}

// Function to display scan result
function displayScanResult(result) {
    const resultDiv = document.getElementById('scan-result');
    resultDiv.style.display = 'flex';
    
    resultDiv.innerHTML = `
        <div class="result-box">
            <h3>${result.isValid ? 'Success!' : 'Error'}</h3>
            ${result.isValid 
                ? `
                    <p><i class="fas fa-coins"></i> Points: ${result.points}</p>
                    <p><i class="fas fa-ticket-alt"></i> New ticket added!</p>
                    <p class="ticket-info">Use your ticket for a chance to win prizes in the raffle!</p>
                `
                : `<p class="error">${result.error}</p>`
            }
            <button onclick="closeScanResult()"><i class="fas fa-times"></i> Close</button>
        </div>
    `;
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
        if (qrReader.style.display === 'none' || !qrReader.style.display) {
            qrReader.style.display = 'flex';
            if (!html5QrcodeScanner) {
                html5QrcodeScanner = new Html5QrcodeScanner(
                    "qr-reader",
                    {
                        fps: 10,
                        qrbox: { width: 250, height: 250 },
                        aspectRatio: 1.0,
                        formatsToSupport: [ Html5QrcodeSupportedFormats.QR_CODE ],
                        experimentalFeatures: {
                            useBarCodeDetectorIfSupported: true
                        },
                        rememberLastUsedCamera: true,
                        showTorchButtonIfSupported: true,
                        defaultZoomValueIfSupported: 2,
                        showZoomSliderIfSupported: true
                    }
                );
                
                html5QrcodeScanner.render(async (decodedText) => {
                    try {
                        // Stop scanning immediately to prevent multiple scans
                        await html5QrcodeScanner.pause();
                        
                        const result = await decryptQRCode(decodedText);
                        stopAndHideScanner();
                        displayScanResult(result);
                    } catch (error) {
                        console.error('Error processing QR code:', error);
                        html5QrcodeScanner.resume(); // Resume scanning if there was an error
                    }
                });
            }
        } else {
            stopAndHideScanner();
        }
    }
});

// Function to close scan result
window.closeScanResult = () => {
    const resultDiv = document.getElementById('scan-result');
    if (resultDiv) {
        resultDiv.style.display = 'none';
    }
};

// Logout functionality
document.getElementById('logout').addEventListener('click', () => {
    stopAndHideScanner();
    firebase.auth().signOut();
});

// Add event listeners to other buttons to hide scanner
document.getElementById('viewTickets').addEventListener('click', () => {
    stopAndHideScanner();
    displayTickets();
});

document.getElementById('notificationsBtn').addEventListener('click', () => {
    stopAndHideScanner();
});

// Initialize notifications
async function initializeNotifications() {
    const user = firebase.auth().currentUser;
    if (!user) return;

    const notificationsRef = firebase.firestore()
        .collection('users')
        .doc(user.uid)
        .collection('notifications');

    // Listen for real-time updates
    notificationsRef.orderBy('timestamp', 'desc')
        .onSnapshot((snapshot) => {
            notifications = [];
            unreadCount = 0;

            snapshot.forEach((doc) => {
                const notification = {
                    id: doc.id,
                    ...doc.data()
                };
                notifications.push(notification);
                if (!notification.read) {
                    unreadCount++;
                }
            });

            updateNotificationBadge();
            if (document.getElementById('notificationsModal').classList.contains('show')) {
                displayNotifications();
            }
        });
}

// Update notification badge
function updateNotificationBadge() {
    const badge = document.getElementById('notificationBadge');
    badge.textContent = unreadCount;
    badge.style.display = unreadCount > 0 ? 'flex' : 'none';
}

// Display notifications in modal
function displayNotifications() {
    const notificationsList = document.getElementById('notificationsList');
    notificationsList.innerHTML = '';

    if (notifications.length === 0) {
        notificationsList.innerHTML = '<div class="notification-item">No notifications yet</div>';
        return;
    }

    notifications.forEach(notification => {
        const notificationElement = document.createElement('div');
        notificationElement.className = `notification-item${notification.read ? '' : ' unread'}`;
        
        const timestamp = notification.timestamp?.toDate() || new Date();
        const timeAgo = formatTimeAgo(timestamp);

        notificationElement.innerHTML = `
            <div class="notification-header">
                <div class="notification-title">${notification.title}</div>
                <div class="notification-time">${timeAgo}</div>
            </div>
            <div class="notification-message">${notification.message}</div>
        `;

        notificationsList.appendChild(notificationElement);

        // Mark as read when clicked
        if (!notification.read) {
            notificationElement.addEventListener('click', () => markAsRead(notification.id));
        }
    });
}

// Mark notification as read
async function markAsRead(notificationId) {
    const user = firebase.auth().currentUser;
    if (!user) return;

    try {
        await firebase.firestore()
            .collection('users')
            .doc(user.uid)
            .collection('notifications')
            .doc(notificationId)
            .update({
                read: true
            });
    } catch (error) {
        console.error('Error marking notification as read:', error);
    }
}

// Format time ago
function formatTimeAgo(date) {
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return date.toLocaleDateString();
}

// Clear all notifications
async function clearInbox() {
    const user = firebase.auth().currentUser;
    if (!user) return;

    try {
        const notificationsRef = firebase.firestore()
            .collection('users')
            .doc(user.uid)
            .collection('notifications');

        // Get all notifications
        const snapshot = await notificationsRef.get();
        
        // Delete each notification
        const batch = firebase.firestore().batch();
        snapshot.forEach(doc => {
            batch.delete(notificationsRef.doc(doc.id));
        });
        
        await batch.commit();
        
        // Update UI
        notifications = [];
        unreadCount = 0;
        updateNotificationBadge();
        displayNotifications();
    } catch (error) {
        console.error('Error clearing inbox:', error);
    }
}

// Setup notification event listeners
function setupNotificationListeners() {
    const notificationsBtn = document.getElementById('notificationsBtn');
    const notificationsModal = document.getElementById('notificationsModal');
    const clearInboxModal = document.getElementById('clearInboxModal');
    const closeModal = notificationsModal.querySelector('.close-modal');
    const clearInboxBtn = document.getElementById('clearInbox');
    const confirmClearBtn = document.getElementById('confirmClear');
    const cancelClearBtn = document.getElementById('cancelClear');

    notificationsBtn.addEventListener('click', () => {
        notificationsModal.classList.add('show');
        displayNotifications();
    });

    closeModal.addEventListener('click', () => {
        notificationsModal.classList.remove('show');
    });

    notificationsModal.addEventListener('click', (e) => {
        if (e.target === notificationsModal) {
            notificationsModal.classList.remove('show');
        }
    });

    // Clear inbox button
    clearInboxBtn.addEventListener('click', () => {
        if (notifications.length === 0) return;
        clearInboxModal.classList.add('show');
    });

    // Confirm clear button
    confirmClearBtn.addEventListener('click', async () => {
        confirmClearBtn.disabled = true;
        await clearInbox();
        confirmClearBtn.disabled = false;
        clearInboxModal.classList.remove('show');
    });

    // Cancel clear button
    cancelClearBtn.addEventListener('click', () => {
        clearInboxModal.classList.remove('show');
    });

    // Close confirmation modal when clicking outside
    clearInboxModal.addEventListener('click', (e) => {
        if (e.target === clearInboxModal) {
            clearInboxModal.classList.remove('show');
        }
    });
}

// Start the application
initializeApp(); 