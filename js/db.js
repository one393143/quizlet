import { db } from './firebase-config.js';
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";

const SETS_COLLECTION = 'study_sets';

export const dbService = {
    // Create a new study set
    async createSet(title, description, cards) {
        try {
            const docRef = await addDoc(collection(db, SETS_COLLECTION), {
                title,
                description,
                cards,
                createdAt: serverTimestamp()
            });
            console.log("Document written with ID: ", docRef.id);
            return docRef.id;
        } catch (e) {
            console.error("Error adding document: ", e);
            throw e;
        }
    },

    // Fetch all study sets
    async getSets() {
        const q = query(collection(db, SETS_COLLECTION), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        const sets = [];
        querySnapshot.forEach((doc) => {
            sets.push({ id: doc.id, ...doc.data() });
        });
        return sets;
    },

    // Update an existing study set
    async updateSet(id, title, description, cards) {
        try {
            const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js");
            const docRef = doc(db, SETS_COLLECTION, id);
            await updateDoc(docRef, {
                title,
                description,
                cards,
                updatedAt: serverTimestamp()
            });
            console.log("Document updated");
        } catch (e) {
            console.error("Error updating document: ", e);
            throw e;
        }
    },

    // Delete a study set
    async deleteSet(id) {
        try {
            const { doc, deleteDoc } = await import("https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js");
            const docRef = doc(db, SETS_COLLECTION, id);
            await deleteDoc(docRef);
            console.log("Document deleted");
        } catch (e) {
            console.error("Error deleting document: ", e);
            throw e;
        }
    },

    // Update progress for a set
    async updateProgress(setId, progressData) {
        try {
            const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js");
            const docRef = doc(db, SETS_COLLECTION, setId);

            // We use dot notation to update nested fields without overwriting the whole map if possible,
            // but for simplicity here we might be passing the whole progress object or specific keys.
            // Let's assume progressData is an object like { "progress.learn": ... } or we merge manually.

            await updateDoc(docRef, {
                progress: progressData, // Expecting the full progress object or a merged one from app logic
                updatedAt: serverTimestamp()
            });
            console.log("Progress updated");
        } catch (e) {
            console.error("Error updating progress: ", e);
            // Don't throw for progress updates to avoid blocking user flow if offline/error
        }
    }
};
