// Encryption key (must match Arduino)
const ENCRYPTION_KEY = "TRASHBOTSECRETKEY";

function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
}

async function decryptQRCode(encryptedHex) {
    try {
        console.log('Raw QR Code value:', encryptedHex);

        // Remove any whitespace and colons
        encryptedHex = encryptedHex.replace(/[:\s]/g, '');
        console.log('Cleaned hex:', encryptedHex);

        // Validate hex string format
        if (!/^[0-9A-Fa-f]+$/.test(encryptedHex)) {
            throw new Error('Invalid QR code format - must be hexadecimal');
        }

        // Start a Firestore transaction to handle both marking code as used and updating points atomically
        const result = await firebase.firestore().runTransaction(async (transaction) => {
            // Check if code has been used before within the transaction
            const usedCodesRef = firebase.firestore().collection('usedCodes').doc(encryptedHex);
            const usedCodeDoc = await transaction.get(usedCodesRef);
            
            console.log('Checking if code exists:', encryptedHex);
            console.log('Used code doc exists:', usedCodeDoc.exists);
            
            if (usedCodeDoc.exists) {
                const usedData = usedCodeDoc.data();
                console.log('Used code data:', usedData);
                
                // Check if usedAt exists and is valid
                if (!usedData.usedAt) {
                    throw new Error('Invalid QR code data - missing timestamp');
                }
                
                let formattedDate;
                try {
                    const usedAt = usedData.usedAt.toDate();
                    formattedDate = usedAt.toLocaleDateString() + ' ' + usedAt.toLocaleTimeString();
                } catch (error) {
                    console.error('Error formatting date:', error);
                    formattedDate = 'an unknown time';
                }
                
                // Get the user who used it
                let userName = 'Unknown User';
                try {
                    if (usedData.usedBy) {
                        const userRef = firebase.firestore().collection('users').doc(usedData.usedBy);
                        const userDoc = await transaction.get(userRef);
                        userName = userDoc.exists ? userDoc.data().fullName : 'Unknown User';
                    }
                } catch (error) {
                    console.error('Error getting user details:', error);
                }
                
                throw new Error(`This QR code has already been used on ${formattedDate} by ${userName}`);
            }

            // Decrypt and validate the code
            const bytes = hexToBytes(encryptedHex);
            let decrypted = '';
            for (let i = 0; i < bytes.length; i++) {
                decrypted += String.fromCharCode(bytes[i] ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length));
            }
            
            console.log('Decrypted text:', decrypted);

            if (!decrypted) {
                throw new Error('Decryption resulted in empty text');
            }

            // Split the timestamp from the data
            const [data, timestamp] = decrypted.split('|');

            // Extract points value
            const pointsMatch = data.match(/Points:(\d+)/);
            if (!pointsMatch) {
                throw new Error('Invalid data format');
            }

            const points = parseInt(pointsMatch[1]);
            if (isNaN(points)) {
                throw new Error('Invalid points value');
            }

            // Get current user
            const userId = firebase.auth().currentUser.uid;
            const userRef = firebase.firestore().collection('users').doc(userId);
            const userDoc = await transaction.get(userRef);

            if (!userDoc.exists) {
                throw new Error("User document does not exist!");
            }

            // Generate a unique ticket ID
            const ticketId = firebase.firestore().collection('dummy').doc().id;

            // Mark code as used and update points in the same transaction
            transaction.set(usedCodesRef, {
                usedAt: firebase.firestore.FieldValue.serverTimestamp(),
                points: points,
                usedBy: userId,
                originalTimestamp: timestamp ? parseInt(timestamp) : Math.floor(Date.now() / 1000)
            });

            const userData = userDoc.data();
            const currentPoints = userData.points || 0;
            const tickets = userData.tickets || [];

            // Calculate number of tickets (1 ticket per 10 points, discarding excess)
            const numberOfTickets = Math.floor(points / 10);
            
            // Add new tickets
            for (let i = 0; i < numberOfTickets; i++) {
                tickets.push({
                    id: firebase.firestore().collection('dummy').doc().id,
                    createdAt: new Date().toISOString()
                });
            }

            transaction.update(userRef, {
                points: currentPoints + points,
                tickets: tickets,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });

            return {
                data: data.trim(),
                points: points,
                timestamp: timestamp ? parseInt(timestamp) : Math.floor(Date.now() / 1000),
                isValid: true,
                rawText: decrypted,
                ticketId: ticketId
            };
        });

        // Return success response with the transaction result
        return {
            isValid: true,
            message: 'Points and ticket added successfully',
            ...result
        };

    } catch (error) {
        console.error('Decryption failed:', error);
        return {
            data: null,
            points: null,
            timestamp: null,
            isValid: false,
            error: error.message,
            rawValue: encryptedHex
        };
    }
} 