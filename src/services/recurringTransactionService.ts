import { get, off, onValue, push, ref, remove, update } from 'firebase/database';
import { database } from '../firebase';
import { addTransaction, deleteTransaction } from './transactionService';
import type { RecurrenceInterval, RecurringTransaction } from '../types/Transaction';

type RecurringTransactionRecord = Omit<RecurringTransaction, 'id'>;

export type RecurringTransactionInput = {
  type: 'income' | 'expense';
  amount: number;
  description: string;
  location: string;
  interval: RecurrenceInterval;
  nextDueDate: string;
  isBusiness?: boolean;
  sourceExchangeType?: string;
  affectsBalance?: boolean;
};

const mapRecurringTransactions = (data: Record<string, RecurringTransactionRecord>): RecurringTransaction[] =>
  Object.entries(data).map(([id, transaction]) => ({
    id,
    ...transaction,
  }));

const addMonths = (date: Date, months: number) => {
  const result = new Date(date);
  const day = result.getDate();
  result.setMonth(result.getMonth() + months);

  if (result.getDate() !== day) {
    result.setDate(0);
  }

  return result;
};

const formatDate = (date: Date) => date.toISOString().split('T')[0];

export const calculateNextDueDate = (dateString: string, interval: RecurrenceInterval): string => {
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Ungültiges Fälligkeitsdatum');
  }

  if (interval === 'weekly') {
    date.setDate(date.getDate() + 7);
    return formatDate(date);
  }

  if (interval === 'monthly') {
    return formatDate(addMonths(date, 1));
  }

  date.setFullYear(date.getFullYear() + 1);
  return formatDate(date);
};

export const subscribeToRecurringTransactions = (
  callback: (transactions: RecurringTransaction[]) => void,
): (() => void) => {
  const recurringRef = ref(database, 'recurringTransactions');
  const unsubscribe = onValue(recurringRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) {
      callback([]);
      return;
    }

    const transactions = mapRecurringTransactions(data as Record<string, RecurringTransactionRecord>)
      .sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate));
    callback(transactions);
  }, (error) => {
    console.error('Error loading recurring transactions:', error);
  });

  return () => off(recurringRef, 'value', unsubscribe);
};

export const addRecurringTransaction = async (input: RecurringTransactionInput): Promise<string> => {
  if (!input.description.trim() || !input.location.trim()) {
    throw new Error('Beschreibung und Ort sind erforderlich.');
  }

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error('Bitte geben Sie einen gültigen Betrag ein.');
  }

  const recurringRef = ref(database, 'recurringTransactions');
  const newRef = await push(recurringRef, {
    ...input,
    description: input.description.trim(),
    location: input.location.trim(),
    startDate: input.nextDueDate,
    timestamp: Date.now(),
    isActive: true,
    affectsBalance: input.affectsBalance ?? true,
  });

  return newRef.key!;
};

export const deleteRecurringTransaction = async (id: string): Promise<void> => {
  await remove(ref(database, `recurringTransactions/${id}`));
};

export const toggleRecurringTransactionActive = async (id: string, isActive: boolean): Promise<void> => {
  await update(ref(database, `recurringTransactions/${id}`), { isActive });
};

export const bookRecurringTransaction = async (id: string): Promise<string> => {
  const recurringRef = ref(database, `recurringTransactions/${id}`);
  const snapshot = await get(recurringRef);
  if (!snapshot.exists()) {
    throw new Error('Wiederkehrende Transaktion nicht gefunden.');
  }

  const recurring = {
    id,
    ...(snapshot.val() as RecurringTransactionRecord),
  };

  if (!recurring.isActive) {
    throw new Error('Diese wiederkehrende Transaktion ist deaktiviert.');
  }

  const transactionId = await addTransaction({
    type: recurring.type,
    amount: recurring.amount.toFixed(2).replace('.', ','),
    description: recurring.description,
    location: recurring.location,
    date: recurring.nextDueDate,
    isBusiness: recurring.isBusiness,
    sourceExchangeType: recurring.sourceExchangeType,
    affectsBalance: recurring.affectsBalance,
  });

  try {
    await update(recurringRef, {
      lastBookedDate: recurring.nextDueDate,
      nextDueDate: calculateNextDueDate(recurring.nextDueDate, recurring.interval),
    });
  } catch (error) {
    console.error('Error updating recurring transaction after booking:', error);
    await deleteTransaction(transactionId);
    throw error;
  }

  return transactionId;
};
