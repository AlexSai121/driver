import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc, getDocs, query, where, arrayUnion } from 'firebase/firestore';

export type Transaction = {
      id?: string;
      title: string;
      amount: number;
      type: 'income' | 'expense';
      category: string;
      paymentMethod: string;
      note?: string;
      date: string;
};

export const addTransaction = async (transaction: Omit<Transaction, 'id'>) => {
      if (!db) {
            console.warn("Firebase not configured. Transaction not saved.");
            return null;
      }

      try {
            // 1. Add the transaction to the transactions collection
            const docRef = await addDoc(collection(db, 'transactions'), transaction);

            // 2. Sync to today's journal entry
            await appendTransactionToJournal(transaction);

            return docRef.id;
      } catch (error) {
            console.error("Error adding transaction:", error);
            throw error;
      }
};

const appendTransactionToJournal = async (transaction: Omit<Transaction, 'id'>) => {
      if (!db) return;
      const today = new Date().toISOString().split('T')[0];

      try {
            // Check if journal entry exists for today
            const journalsRef = collection(db, 'journals');
            const q = query(journalsRef, where("date", "==", today));
            const querySnapshot = await getDocs(q);

            const summaryText = `${transaction.type === 'expense' ? '-' : '+'}$${transaction.amount} (${transaction.category}) ${transaction.note ? '- ' + transaction.note : ''}`;

            if (querySnapshot.empty) {
                  // Create new journal entry for today
                  await addDoc(journalsRef, {
                        date: today,
                        financeSummary: [summaryText],
                        createdAt: new Date().toISOString()
                  });
            } else {
                  // Append to existing entry
                  const journalDocId = querySnapshot.docs[0].id;
                  await updateDoc(doc(db, 'journals', journalDocId), {
                        financeSummary: arrayUnion(summaryText)
                  });
            }
      } catch (error) {
            console.error("Error updating journal with transaction:", error);
      }
};
