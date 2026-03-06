import { localDb } from '../db/localDb';
import type { Transaction } from '../components/FinanceView';

export const addTransaction = async (transaction: Omit<Transaction, 'id'>) => {
      try {
            // 1. Add the transaction to the transactions collection
            const id = await localDb.transactions.add(transaction as Transaction);

            // 2. Sync to today's journal entry
            await appendTransactionToJournal(transaction);

            return id;
      } catch (error) {
            console.error("Error adding transaction:", error);
            throw error;
      }
};

const appendTransactionToJournal = async (transaction: Omit<Transaction, 'id'>) => {
      const today = new Date().toISOString().split('T')[0];

      try {
            const entry = await localDb.journals.where("date").equals(today).first();
            const summaryText = `${transaction.type === 'expense' ? '-' : '+'}$${transaction.amount} (${transaction.category})${transaction.note ? ' - ' + transaction.note : ''}`;

            if (!entry) {
                  await localDb.journals.add({
                        date: today,
                        financeSummary: [summaryText]
                  });
            } else {
                  if (entry.id) {
                        await localDb.journals.update(entry.id, {
                              financeSummary: [...entry.financeSummary, summaryText]
                        });
                  }
            }
      } catch (error) {
            console.error("Error updating journal with transaction:", error);
      }
};
