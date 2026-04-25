const admin = require('firebase-admin');
const dotenv = require('dotenv');
dotenv.config();

// Initialize Firebase
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

/**
 * Gets user stats from Firestore
 * @param {string} userId 
 */
async function getUser(userId) {
    const doc = await db.collection('users').doc(userId).get();
    if (!doc.exists) {
        return {
            messages: 0,
            voiceMinutes: 0,
            lastVoiceJoin: null
        };
    }
    return doc.data();
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
