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

module.exports = {
    getUser,
    updateUser
};
