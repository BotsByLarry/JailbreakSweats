const admin = require('firebase-admin');
const dotenv = require('dotenv');
dotenv.config();

// Initialize Firebase
try {
    const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    // Clean up the string if it was pasted with extra quotes or newlines
    const cleanedServiceAccount = rawServiceAccount.trim().replace(/^['"]|['"]$/g, '');
    const serviceAccount = JSON.parse(cleanedServiceAccount);

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase initialized successfully.');
} catch (error) {
    console.error('Firebase initialization failed:', error.message);
}

const db = admin.firestore();

/**
 * Gets user stats from Firestore
 * @param {string} userId 
 */
async function getUser(userId) {
    try {
        const doc = await db.collection('users').doc(userId).get();
        if (!doc.exists) {
            return {
                messages: 0,
                voiceMinutes: 0,
                lastVoiceJoin: null
            };
        }
        return doc.data();
    } catch (error) {
        console.error(`Error getting user ${userId}:`, error.message);
        // Return default stats if DB fails so the bot doesn't crash
        return { messages: 0, voiceMinutes: 0, lastVoiceJoin: null };
    }
}

/**
 * Updates user stats in Firestore
 * @param {string} userId 
 * @param {object} data 
 */
async function updateUser(userId, data) {
    await db.collection('users').doc(userId).set(data, { merge: true });
}

/**
 * Gets top users for the leaderboard
 * @param {number} limit 
 */
async function getTopUsers(limit = 10) {
    const snapshot = await db.collection('users').orderBy('messages', 'desc').limit(limit).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Resets all users' message counts
 */
async function resetAllUsers() {
    const snapshot = await db.collection('users').get();
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
        batch.update(doc.ref, { messages: 0, voiceMinutes: 0 });
    });
    await batch.commit();
}

module.exports = {
    getUser,
    updateUser,
    getTopUsers,
    resetAllUsers
};
