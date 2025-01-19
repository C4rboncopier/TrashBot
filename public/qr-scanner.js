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

        // Start a Firestore transaction to handle both marking code as used and updating points atomically
        await firebase.firestore().runTransaction(async (transaction) => {
            // Check if code has been used before within the transaction
            const usedCodesRef = firebase.firestore().collection('usedCodes').doc(encryptedHex);
            const usedCodeDoc = await transaction.get(usedCodesRef);
            
            if (usedCodeDoc.exists) {
                throw new Error('This QR code has already been used');
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

            // Mark code as used and update points in the same transaction
            transaction.set(usedCodesRef, {
                usedAt: firebase.firestore.FieldValue.serverTimestamp(),
                points: points,
                usedBy: userId,
                originalTimestamp: timestamp ? parseInt(timestamp) : Math.floor(Date.now() / 1000)
            });

            const currentPoints = userDoc.data().points || 0;
            transaction.update(userRef, {
                points: currentPoints + points,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });

            return {
                data: data.trim(),
                points: points,
                timestamp: timestamp ? parseInt(timestamp) : Math.floor(Date.now() / 1000),
                isValid: true,
                rawText: decrypted
            };
        });

        return {
            isValid: true,
            message: 'Points added successfully'
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