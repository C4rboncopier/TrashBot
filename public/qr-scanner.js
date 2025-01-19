// Encryption key (must match Arduino)
const ENCRYPTION_KEY = "TRASHBOTSECRETKEY";

function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
}

async function checkIfCodeUsed(encryptedCode) {
    const usedCodesRef = firebase.firestore().collection('usedCodes');
    const snapshot = await usedCodesRef.doc(encryptedCode).get();
    return snapshot.exists;
}

async function markCodeAsUsed(encryptedCode, data) {
    const usedCodesRef = firebase.firestore().collection('usedCodes');
    await usedCodesRef.doc(encryptedCode).set({
        usedAt: firebase.firestore.FieldValue.serverTimestamp(),
        points: data.points,
        usedBy: firebase.auth().currentUser.uid,
        originalTimestamp: data.timestamp
    });
}

async function updateUserPoints(points) {
    const userId = firebase.auth().currentUser.uid;
    const userRef = firebase.firestore().collection('users').doc(userId);

    // Use a transaction to safely update points
    await firebase.firestore().runTransaction(async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) {
            throw new Error("User document does not exist!");
        }

        const currentPoints = userDoc.data().points || 0;
        const newPoints = currentPoints + points;

        transaction.update(userRef, { 
            points: newPoints,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
    });
}

async function decryptQRCode(encryptedHex) {
    try {
        console.log('Raw QR Code value:', encryptedHex);

        // Remove any whitespace and colons
        encryptedHex = encryptedHex.replace(/[:\s]/g, '');
        console.log('Cleaned hex:', encryptedHex);

        // Check if code has been used before
        const isUsed = await checkIfCodeUsed(encryptedHex);
        if (isUsed) {
            throw new Error('This QR code has already been used');
        }

        // Convert hex to bytes
        const bytes = hexToBytes(encryptedHex);
        
        // Decrypt using XOR
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

        // Mark code as used and update user points
        await markCodeAsUsed(encryptedHex, { points, timestamp });
        await updateUserPoints(points);

        return {
            data: data.trim(),
            points: points,
            timestamp: timestamp ? parseInt(timestamp) : Math.floor(Date.now() / 1000),
            isValid: true,
            rawText: decrypted
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