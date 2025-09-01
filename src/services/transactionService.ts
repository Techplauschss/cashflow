import { ref, push, onValue, off, query, orderByChild, startAt, endAt, update, remove } from 'firebase/database';
import { database } from '../firebase';
import type { Transaction, TransactionFormData } from '../types/Transaction';

// Funktion zum Hinzufügen einer neuen Transaktion
export const addTransaction = async (transactionData: TransactionFormData): Promise<string> => {
  const transactionsRef = ref(database, 'transactions');
  
  // Konvertiere den Betrag von String zu Number
  const amount = parseFloat(transactionData.amount.replace(/\./g, '').replace(',', '.'));
  
  const transaction: Omit<Transaction, 'id'> = {
    type: transactionData.type,
    amount: amount,
    description: transactionData.description,
    location: transactionData.location,
    date: new Date().toISOString().split('T')[0], // YYYY-MM-DD Format
    timestamp: Date.now(),
  };

  try {
    const newTransactionRef = await push(transactionsRef, transaction);
    return newTransactionRef.key!;
  } catch (error) {
    console.error('Error adding transaction:', error);
    throw new Error('Fehler beim Hinzufügen der Transaktion');
  }
};

// Funktion zum Abrufen aller Transaktionen
export const subscribeToTransactions = (callback: (transactions: Transaction[]) => void): (() => void) => {
  const transactionsRef = ref(database, 'transactions');
  
  const unsubscribe = onValue(transactionsRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      const transactions: Transaction[] = Object.entries(data).map(([id, transaction]) => ({
        id,
        ...(transaction as Omit<Transaction, 'id'>),
      }));
      callback(transactions);
    } else {
      callback([]);
    }
  }, (error) => {
    console.error('Error fetching transactions:', error);
  });

  // Rückgabe einer Funktion zum Beenden des Abonnements
  return () => off(transactionsRef, 'value', unsubscribe);
};

// Funktion zum Abrufen von Transaktionen für einen bestimmten Monat
export const getTransactionsForMonth = async (year: number, month: number): Promise<Transaction[]> => {
  const transactionsRef = ref(database, 'transactions');
  
  // Erstelle Start- und Enddatum für den Monat
  const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
  const endDate = new Date(year, month, 0).toISOString().split('T')[0];
  
  const monthQuery = query(
    transactionsRef,
    orderByChild('date'),
    startAt(startDate),
    endAt(endDate)
  );
  
  return new Promise((resolve, reject) => {
    onValue(monthQuery, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const transactions: Transaction[] = Object.entries(data).map(([id, transaction]) => ({
          id,
          ...(transaction as Omit<Transaction, 'id'>),
        }));
        resolve(transactions);
      } else {
        resolve([]);
      }
    }, (error) => {
      console.error('Error fetching transactions for month:', error);
      reject(error);
    }, { onlyOnce: true });
  });
};

// Funktion zum Abrufen aller verfügbaren Monate (nur Metadaten)
export const getAvailableMonths = async (): Promise<Array<{ year: number; month: number; monthYear: string; count: number }>> => {
  const transactionsRef = ref(database, 'transactions');
  
  return new Promise((resolve, reject) => {
    onValue(transactionsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const transactions: Transaction[] = Object.entries(data).map(([id, transaction]) => ({
          id,
          ...(transaction as Omit<Transaction, 'id'>),
        }));
        
        // Gruppiere nach Monat und zähle
        const monthCounts = new Map<string, { year: number; month: number; count: number }>();
        
        transactions.forEach(transaction => {
          const date = new Date(transaction.date);
          const year = date.getFullYear();
          const month = date.getMonth() + 1;
          const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
          
          if (monthCounts.has(monthKey)) {
            monthCounts.get(monthKey)!.count++;
          } else {
            monthCounts.set(monthKey, { year, month, count: 1 });
          }
        });
        
        // Konvertiere zu Array und sortiere (neueste zuerst)
        const result = Array.from(monthCounts.entries()).map(([, data]) => ({
          ...data,
          monthYear: new Date(data.year, data.month - 1, 1).toLocaleDateString('de-DE', {
            month: 'long',
            year: 'numeric',
          })
        })).sort((a, b) => {
          return (b.year * 12 + b.month) - (a.year * 12 + a.month);
        });
        
        resolve(result);
      } else {
        resolve([]);
      }
    }, (error) => {
      console.error('Error fetching available months:', error);
      reject(error);
    }, { onlyOnce: true });
  });
};

// Funktion zum Aktualisieren des Kilometerstandes einer Transaktion
export const updateKilometerstand = async (transactionId: string, kilometerstand: number): Promise<void> => {
  const transactionRef = ref(database, `transactions/${transactionId}`);
  
  try {
    await update(transactionRef, { kilometerstand });
  } catch (error) {
    console.error('Error updating kilometerstand:', error);
    throw new Error('Fehler beim Aktualisieren des Kilometerstandes');
  }
};

// Funktion zum Aktualisieren der Liter einer Transaktion
export const updateLiter = async (transactionId: string, liter: number): Promise<void> => {
  const transactionRef = ref(database, `transactions/${transactionId}`);
  
  try {
    await update(transactionRef, { liter });
  } catch (error) {
    console.error('Error updating liter:', error);
    throw new Error('Fehler beim Aktualisieren der Liter');
  }
};

// Funktion zum Löschen einer Transaktion
export const deleteTransaction = async (transactionId: string): Promise<void> => {
  const transactionRef = ref(database, `transactions/${transactionId}`);
  
  try {
    await remove(transactionRef);
  } catch (error) {
    console.error('Error deleting transaction:', error);
    throw new Error('Fehler beim Löschen der Transaktion');
  }
};

// Funktion zum Aktualisieren einer Transaktion
export const updateTransaction = async (
  transactionId: string, 
  updatedData: {
    description: string;
    amount: number;
    location: string;
    type: 'income' | 'expense';
  }
): Promise<void> => {
  const transactionRef = ref(database, `transactions/${transactionId}`);
  
  try {
    await update(transactionRef, {
      description: updatedData.description,
      amount: updatedData.amount,
      location: updatedData.location,
      type: updatedData.type,
      // Aktualisiere auch den Timestamp für die Sortierung
      lastModified: Date.now()
    });
  } catch (error) {
    console.error('Error updating transaction:', error);
    throw new Error('Fehler beim Aktualisieren der Transaktion');
  }
};
