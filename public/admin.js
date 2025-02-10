// Wait for Firebase to initialize
async function initializeApp() {
    try {
        await window.firebaseInitialized;

        // Check if user is admin
        firebase.auth().onAuthStateChanged(async (user) => {
            if (!user) {
                window.location.href = '/index.html';
                return;
            }

            // Check if the logged-in user is admin
            const userRef = firebase.firestore().collection('users').doc(user.uid);
            const userDoc = await userRef.get();
            
            if (!userDoc.exists || userDoc.data().username !== 'admin') {
                alert('Access denied. Admin only area.');
                window.location.href = '/main.html';
                return;
            }

            // Initialize admin dashboard
            loadUsers();
            loadRewards();
            setupEventListeners();
            setupRewardEventListeners();
            setupWheel();
        });
    } catch (error) {
        console.error('Error initializing app:', error);
    }
}

// Pagination state
let currentPage = 1;
let usersPerPage = 10;
let allUsers = [];

// Load all users
async function loadUsers() {
    try {
        const usersRef = firebase.firestore().collection('users');
        const snapshot = await usersRef.get();
        
        // Store all non-admin users
        allUsers = [];
        snapshot.forEach(doc => {
            const userData = doc.data();
            if (userData.username !== 'admin') {
                allUsers.push({
                    id: doc.id,
                    ...userData
                });
            }
        });

        // Sort users alphabetically by full name
        allUsers.sort((a, b) => a.fullName.localeCompare(b.fullName));

        // Update pagination controls
        updatePaginationControls();
        
        // Display current page
        displayCurrentPage();

        // Update total tickets count
        updateTotalTickets();
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

// Display current page of users
function displayCurrentPage() {
    const tableBody = document.getElementById('usersTableBody');
    tableBody.innerHTML = '';

    const startIndex = (currentPage - 1) * usersPerPage;
    const endIndex = startIndex + usersPerPage;
    const usersToDisplay = allUsers.slice(startIndex, endIndex);

    usersToDisplay.forEach(userData => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${userData.fullName}</td>
            <td>${userData.points || 0}</td>
            <td>
                <button class="view-details-btn" data-userid="${userData.id}">
                    <i class="fas fa-eye"></i> View Details
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });

    // Add event listeners to view details buttons
    document.querySelectorAll('.view-details-btn').forEach(button => {
        button.addEventListener('click', () => showUserDetails(button.dataset.userid));
    });
}

// Update pagination controls
function updatePaginationControls() {
    const totalPages = Math.ceil(allUsers.length / usersPerPage);
    
    document.getElementById('currentPage').textContent = currentPage;
    document.getElementById('totalPages').textContent = totalPages;
    
    const prevButton = document.getElementById('prevPage');
    const nextButton = document.getElementById('nextPage');
    
    prevButton.disabled = currentPage === 1;
    nextButton.disabled = currentPage === totalPages;
}

// Show user details in modal
async function showUserDetails(userId) {
    try {
        const userRef = firebase.firestore().collection('users').doc(userId);
        const doc = await userRef.get();
        
        if (doc.exists) {
            const userData = doc.data();
            const modal = document.getElementById('userDetailsModal');
            const modalBody = modal.querySelector('.modal-body');
            
            modalBody.innerHTML = `
                <div class="user-detail-item">
                    <div class="user-detail-label">Full Name</div>
                    <div class="user-detail-value">${userData.fullName}</div>
                </div>
                <div class="user-detail-item">
                    <div class="user-detail-label">Username</div>
                    <div class="user-detail-value">${userData.username}</div>
                </div>
                <div class="user-detail-item">
                    <div class="user-detail-label">Grade</div>
                    <div class="user-detail-value">${userData.grade}</div>
                </div>
                <div class="user-detail-item">
                    <div class="user-detail-label">Student ID</div>
                    <div class="user-detail-value">${userData.studentId}</div>
                </div>
                <div class="user-detail-item">
                    <div class="user-detail-label">Email</div>
                    <div class="user-detail-value">${userData.email}</div>
                </div>
                <div class="user-detail-item">
                    <div class="user-detail-label">Points</div>
                    <div class="user-detail-value">${userData.points || 0}</div>
                </div>
                <div class="user-detail-item">
                    <div class="user-detail-label">Tickets</div>
                    <div class="user-detail-value">${userData.tickets ? userData.tickets.length : 0}</div>
                </div>
            `;
            
            modal.classList.add('show');
        }
    } catch (error) {
        console.error('Error showing user details:', error);
    }
}

// Setup event listeners
function setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));
            document.getElementById(`${button.dataset.tab}-tab`).classList.remove('hidden');
        });
    });

    // User search with pagination reset
    document.getElementById('userSearch').addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        
        if (searchTerm === '') {
            currentPage = 1;
            displayCurrentPage();
            updatePaginationControls();
        } else {
            const tableBody = document.getElementById('usersTableBody');
            tableBody.innerHTML = '';
            
            // Filter and display all matching users without pagination
            allUsers.forEach(userData => {
                if (userData.fullName.toLowerCase().includes(searchTerm)) {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${userData.fullName}</td>
                        <td>${userData.points || 0}</td>
                        <td>
                            <button class="view-details-btn" data-userid="${userData.id}">
                                <i class="fas fa-eye"></i> View Details
                            </button>
                        </td>
                    `;
                    tableBody.appendChild(row);
                }
            });

            // Hide pagination controls during search
            document.querySelector('.pagination-controls').style.display = 'none';
        }
    });

    // Modal close button
    document.querySelector('.close-modal').addEventListener('click', () => {
        document.getElementById('userDetailsModal').classList.remove('show');
    });

    // Close modal when clicking outside
    document.getElementById('userDetailsModal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            e.target.classList.remove('show');
        }
    });

    // Logout
    document.getElementById('logout').addEventListener('click', () => {
        firebase.auth().signOut();
    });

    // Spin wheel button
    document.getElementById('spinWheel').addEventListener('click', spinTheWheel);

    // Close winner display
    document.getElementById('closeWinner').addEventListener('click', () => {
        document.getElementById('winner-display').classList.add('hidden');
    });

    // Pagination controls
    document.getElementById('prevPage').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            displayCurrentPage();
            updatePaginationControls();
        }
    });

    document.getElementById('nextPage').addEventListener('click', () => {
        const totalPages = Math.ceil(allUsers.length / usersPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            displayCurrentPage();
            updatePaginationControls();
        }
    });
}

// Wheel setup and animation
let wheel;
let wheelAnimationId;
const SPIN_DURATION = 5000; // 5 seconds

function setupWheel() {
    const canvas = document.getElementById('wheelCanvas');
    const ctx = canvas.getContext('2d');
    wheel = {
        segments: [],
        segmentAngle: 0,
        currentRotation: 0,
        isSpinning: false
    };

    // Set canvas size
    canvas.width = 600;
    canvas.height = 600;

    // Initial draw
    drawWheel(ctx);
    updateCurrentDraw();
}

async function updateTotalTickets() {
    try {
        const usersRef = firebase.firestore().collection('users');
        const snapshot = await usersRef.get();
        let totalTickets = 0;
        wheel.segments = [];

        snapshot.forEach(doc => {
            const userData = doc.data();
            if (userData.username !== 'admin' && userData.tickets) {
                totalTickets += userData.tickets.length;
                // Add user's tickets to wheel segments with ticket IDs
                userData.tickets.forEach(ticket => {
                    wheel.segments.push({
                        userId: doc.id,
                        userName: userData.fullName,
                        ticketId: ticket.id
                    });
                });
            }
        });

        document.getElementById('totalTickets').textContent = totalTickets;
        wheel.segmentAngle = (2 * Math.PI) / wheel.segments.length;
        drawWheel(document.getElementById('wheelCanvas').getContext('2d'));
    } catch (error) {
        console.error('Error updating total tickets:', error);
    }
}

function drawWheel(ctx) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    const centerX = ctx.canvas.width / 2;
    const centerY = ctx.canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 10;

    // Start wheel drawing with rotation
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(wheel.currentRotation);

    // Colors for the wheel segments
    const colors = [
        { main: '#2ecc71', border: '#27ae60' }, // Green
        { main: '#3498db', border: '#2980b9' }, // Blue
        { main: '#f1c40f', border: '#f39c12' }, // Yellow
        { main: '#e67e22', border: '#d35400' }, // Orange
        { main: '#1abc9c', border: '#16a085' }, // Turquoise
        { main: '#a8e6cf', border: '#79bd9a' }  // Light green
    ];

    // Draw outer circle
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw segments
    wheel.segments.forEach((segment, index) => {
        const startAngle = index * wheel.segmentAngle;
        const endAngle = startAngle + wheel.segmentAngle;
        const colorIndex = index % colors.length;

        // Draw segment
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = colors[colorIndex].main;
        ctx.strokeStyle = colors[colorIndex].border;
        ctx.lineWidth = 1;
        ctx.fill();
        ctx.stroke();

        // Draw decorative lines
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(
            Math.cos(startAngle + wheel.segmentAngle / 2) * radius,
            Math.sin(startAngle + wheel.segmentAngle / 2) * radius
        );
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw text
        ctx.save();
        ctx.rotate(startAngle + wheel.segmentAngle / 2);
        ctx.textAlign = 'right';
        ctx.fillStyle = 'white';
        ctx.font = 'bold 14px Poppins';
        // Add text shadow for better readability
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        ctx.fillText(segment.userName.substring(0, 15), radius - 30, 5);
        ctx.restore();
    });

    // Draw center circle with gradient
    const centerRadius = 25;
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, centerRadius);
    gradient.addColorStop(0, '#2c3e50');
    gradient.addColorStop(1, '#34495e');

    ctx.beginPath();
    ctx.arc(0, 0, centerRadius, 0, 2 * Math.PI);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Add a white border to center circle
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();

    // Draw the pointer last (after wheel) so it's always on top
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.beginPath();
    ctx.moveTo(radius - 25, 0);  // Move starting point inward
    ctx.lineTo(radius + 5, -15); // Point outward for the sides
    ctx.lineTo(radius + 5, 15);  // Point outward for the sides
    ctx.closePath();
    ctx.fillStyle = '#e74c3c';
    ctx.strokeStyle = '#c0392b';
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
}

// Show error popup function
function showErrorPopup(message) {
    const popup = document.getElementById('errorPopup');
    const messageEl = popup.querySelector('.error-message');
    messageEl.textContent = message;
    
    popup.classList.add('show');
    
    // Auto hide after 5 seconds
    setTimeout(() => {
        popup.classList.remove('show');
    }, 5000);
    
    // Close button functionality
    const closeBtn = popup.querySelector('.close-error');
    closeBtn.onclick = () => popup.classList.remove('show');
}

async function spinTheWheel() {
    // Check if there are any rewards first
    const rewardsRef = firebase.firestore().collection('rewards');
    const rewardsSnapshot = await rewardsRef.get();
    
    if (rewardsSnapshot.empty) {
        showErrorPopup('Cannot spin the wheel. No rewards have been created yet. Please create some rewards first.');
        return;
    }

    if (wheel.isSpinning || wheel.segments.length === 0) return;

    wheel.isSpinning = true;
    const spinButton = document.getElementById('spinWheel');
    spinButton.disabled = true;

    // Random number of full rotations (3-5) plus random segment
    const fullRotations = 3 + Math.floor(Math.random() * 3);
    const randomSegment = Math.floor(Math.random() * wheel.segments.length);
    const targetRotation = (fullRotations * 2 * Math.PI) + (randomSegment * wheel.segmentAngle);
    
    const startTime = Date.now();
    const startRotation = wheel.currentRotation;

    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / SPIN_DURATION, 1);
        
        // Easing function for smooth deceleration
        const easeOut = t => 1 - Math.pow(1 - t, 3);
        
        wheel.currentRotation = startRotation + (targetRotation * easeOut(progress));
        drawWheel(document.getElementById('wheelCanvas').getContext('2d'));

        if (progress < 1) {
            wheelAnimationId = requestAnimationFrame(animate);
        } else {
            wheel.isSpinning = false;
            spinButton.disabled = false;
            
            // Calculate which segment is at the pointer (top of wheel)
            const normalizedRotation = wheel.currentRotation % (2 * Math.PI);
            const segmentIndex = Math.floor(wheel.segments.length - (normalizedRotation / wheel.segmentAngle)) % wheel.segments.length;
            announceWinner(wheel.segments[segmentIndex]);
        }
    }

    animate();
}

// Function to get a random reward based on tier
async function getRandomReward(tier) {
    try {
        const rewardsRef = firebase.firestore().collection('rewards');
        const snapshot = await rewardsRef.where('type', '==', `${tier}-star`).get();
        
        if (snapshot.empty) {
            throw new Error(`No ${tier}-star rewards available`);
        }

        const rewards = [];
        snapshot.forEach(doc => {
            rewards.push({ id: doc.id, ...doc.data() });
        });

        return rewards[Math.floor(Math.random() * rewards.length)];
    } catch (error) {
        console.error('Error getting random reward:', error);
        throw error;
    }
}

// Function to determine prize tier based on draw count
async function determinePrizeTier() {
    try {
        // Get or create the wheel counter document
        const counterRef = firebase.firestore().collection('system').doc('wheel_counter');
        const doc = await counterRef.get();
        
        let currentDraw = 1;
        if (doc.exists) {
            currentDraw = doc.data().current_draw || 1;
        } else {
            await counterRef.set({ current_draw: 1 });
        }

        // Determine prize tier based on current draw
        let guaranteedTier = 3;
        let fiveStarChance = 0.006; // 0.6% chance

        if (currentDraw === 10) {
            guaranteedTier = 4;
            fiveStarChance = 0.1; // 10% chance
        } else if (currentDraw === 15) {
            guaranteedTier = 5;
            fiveStarChance = 1; // 100% chance
        } else if (currentDraw >= 11 && currentDraw <= 14) {
            guaranteedTier = 3;
            fiveStarChance = 0.006;
        }

        // Try for 5-star prize if not guaranteed
        if (guaranteedTier !== 5 && Math.random() < fiveStarChance) {
            guaranteedTier = 5;
        }

        // Increment counter
        let nextDraw = currentDraw + 1;
        if (currentDraw === 15) {
            nextDraw = 1; // Reset counter after 15th draw
        }
        await counterRef.update({ current_draw: nextDraw });

        return guaranteedTier;
    } catch (error) {
        console.error('Error determining prize tier:', error);
        throw error;
    }
}

// Function to send notification to winner
async function notifyWinner(userId, reward) {
    try {
        const notificationsRef = firebase.firestore()
            .collection('users')
            .doc(userId)
            .collection('notifications');

        await notificationsRef.add({
            title: '🎉 Congratulations! You Won!',
            message: `You have won a ${reward.type} prize: ${reward.name}!`,
            read: false,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error('Error sending winner notification:', error);
    }
}

// Function to update current draw display
async function updateCurrentDraw() {
    try {
        const counterRef = firebase.firestore().collection('system').doc('wheel_counter');
        const doc = await counterRef.get();
        
        let currentDraw = 1;
        if (doc.exists) {
            currentDraw = doc.data().current_draw || 1;
        }

        document.getElementById('currentDraw').textContent = currentDraw;
    } catch (error) {
        console.error('Error updating current draw:', error);
    }
}

// Modify announceWinner function to update draw counter display
async function announceWinner(winner) {
    try {
        const userRef = firebase.firestore().collection('users').doc(winner.userId);
        const userDoc = await userRef.get();
        const userData = userDoc.data();

        // Determine prize tier and get random reward
        const prizeTier = await determinePrizeTier();
        const reward = await getRandomReward(prizeTier);

        // Send notification to winner
        await notifyWinner(winner.userId, reward);

        // Remove the used ticket from the user's tickets array
        const tickets = userData.tickets || [];
        const updatedTickets = tickets.filter(ticket => ticket.id !== winner.ticketId);
        await userRef.update({ tickets: updatedTickets });

        const winnerDisplay = document.getElementById('winner-display');
        const winnerInfo = winnerDisplay.querySelector('.winner-info');
        
        winnerInfo.innerHTML = `
            <div class="winner-header">
                <i class="fas fa-trophy" style="color: #f1c40f; font-size: 48px; margin-bottom: 15px;"></i>
                <h4>${userData.fullName}</h4>
            </div>
            <div class="winner-details">
                <p><i class="fas fa-graduation-cap"></i> Grade: ${userData.grade}</p>
                <p><i class="fas fa-coins"></i> Points: ${userData.points}</p>
                <p><i class="fas fa-ticket-alt"></i> Remaining Tickets: ${updatedTickets.length}</p>
                <div class="prize-info">
                    <p><i class="fas fa-gift"></i> Prize Won:</p>
                    <p class="prize-name">${reward.name}</p>
                    <p class="prize-tier">${'⭐'.repeat(parseInt(reward.type))}</p>
                </div>
            </div>
        `;

        winnerDisplay.classList.remove('hidden');

        // Update the wheel display and current draw
        await Promise.all([
            updateTotalTickets(),
            updateCurrentDraw()
        ]);
    } catch (error) {
        console.error('Error announcing winner:', error);
    }
}

// Load rewards
async function loadRewards() {
    try {
        const rewardsRef = firebase.firestore().collection('rewards');
        const snapshot = await rewardsRef.get();
        const rewardsGrid = document.getElementById('rewardsGrid');
        rewardsGrid.innerHTML = '';

        snapshot.forEach(doc => {
            const rewardData = doc.data();
            const card = document.createElement('div');
            card.className = 'reward-card';
            
            // Create star icons based on reward type
            const starCount = parseInt(rewardData.type.charAt(0));
            const stars = '<i class="fas fa-star"></i>'.repeat(starCount);
            
            card.innerHTML = `
                <div class="reward-header">
                    <span class="reward-type ${rewardData.type.toLowerCase()}">
                        ${rewardData.type}
                    </span>
                    <button class="delete-reward-btn" data-reward-id="${doc.id}">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
                <div class="reward-name-container">
                    <div class="reward-name">${rewardData.name}</div>
                    <div class="reward-stars">${stars}</div>
                </div>
            `;
            
            rewardsGrid.appendChild(card);
        });

        // Add event listeners to delete buttons
        document.querySelectorAll('.delete-reward-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm('Are you sure you want to delete this reward?')) {
                    const rewardId = button.dataset.rewardId;
                    try {
                        await firebase.firestore().collection('rewards').doc(rewardId).delete();
                        loadRewards(); // Reload the rewards grid
                    } catch (error) {
                        console.error('Error deleting reward:', error);
                    }
                }
            });
        });
    } catch (error) {
        console.error('Error loading rewards:', error);
    }
}

// Add reward functionality
function setupRewardEventListeners() {
    const addRewardBtn = document.getElementById('addRewardBtn');
    const addRewardModal = document.getElementById('addRewardModal');
    const addRewardForm = document.getElementById('addRewardForm');
    const closeModalBtn = addRewardModal.querySelector('.close-modal');

    // Open modal
    addRewardBtn.addEventListener('click', () => {
        addRewardModal.classList.add('show');
    });

    // Close modal
    closeModalBtn.addEventListener('click', () => {
        addRewardModal.classList.remove('show');
    });

    // Close modal when clicking outside
    addRewardModal.addEventListener('click', (e) => {
        if (e.target === addRewardModal) {
            addRewardModal.classList.remove('show');
        }
    });

    // Handle form submission
    addRewardForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const rewardName = document.getElementById('rewardName').value;
        const rewardType = document.getElementById('rewardType').value;

        try {
            // Add reward to Firestore
            await firebase.firestore().collection('rewards').add({
                name: rewardName,
                type: rewardType,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Reset form and close modal
            addRewardForm.reset();
            addRewardModal.classList.remove('show');

            // Reload rewards
            loadRewards();
        } catch (error) {
            console.error('Error adding reward:', error);
        }
    });
}

// Initialize the app
initializeApp(); 