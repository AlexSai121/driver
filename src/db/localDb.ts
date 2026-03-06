import Dexie, { type Table } from 'dexie';
import type { Task } from '../components/TasksView';
import type { Transaction } from '../components/FinanceView';

export interface JournalEntry {
      id?: number;
      date: string;
      financeSummary: string[];
}

export class DailyDriverDatabase extends Dexie {
      tasks!: Table<Task>;
      transactions!: Table<Transaction>;
      journals!: Table<JournalEntry>;

      constructor() {
            super('DailyDriverDB');
            this.version(1).stores({
                  tasks: '++id, title, completed, scheduleDate, dueDate',
                  transactions: '++id, title, date, type, category',
                  journals: '++id, date'
            });
      }
}

export const localDb = new DailyDriverDatabase();
