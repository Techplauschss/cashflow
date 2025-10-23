import { ref, push, onValue, off, query, orderByChild, startAt, endAt, update, remove } from 'firebase/database';
import { database } from '../firebase';
import type { Transaction, TransactionFormData } from '../types/Transaction';

// Funktion zum Hinzufügen einer neuen Transaktion (normale, nicht geplante)
export const addTransaction = async (transactionData: TransactionFormData): Promise<string> => {
  const transactionsRef = ref(database, 'transactions');
  
  // Konvertiere den Betrag von String zu Number
  const amount = parseFloat(transactionData.amount.replace(/\./g, '').replace(',', '.'));
  
  const transaction: Omit<Transaction, 'id'> = {
    type: transactionData.type,
    amount: amount,
    description: transactionData.description,
    location: transactionData.location,
    date: new Date().toISOString().split('T')[0], // Immer aktuelles Datum für normale Transaktionen
    timestamp: Date.now(),
    isPlanned: false, // Normale Transaktionen sind nicht geplant
    isBusiness: transactionData.isBusiness || false, // Business-Flag hinzufügen
  };

  try {
    const newTransactionRef = await push(transactionsRef, transaction);
    return newTransactionRef.key!;
  } catch (error) {
    console.error('Error adding transaction:', error);
    throw new Error('Fehler beim Hinzufügen der Transaktion');
  }
};

// Funktion zum Abrufen aller Transaktionen (ohne geplante)
export const subscribeToTransactions = (callback: (transactions: Transaction[]) => void): (() => void) => {
  const transactionsRef = ref(database, 'transactions');
  
  const unsubscribe = onValue(transactionsRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      const transactions: Transaction[] = Object.entries(data)
        .map(([id, transaction]) => ({
          id,
          ...(transaction as Omit<Transaction, 'id'>),
        }))
        .filter(transaction => !transaction.isPlanned); // Filtere geplante Transaktionen aus
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

// Funktion zum Abrufen von Transaktionen für einen bestimmten Monat (ohne geplante)
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
        const transactions: Transaction[] = Object.entries(data)
          .map(([id, transaction]) => ({
            id,
            ...(transaction as Omit<Transaction, 'id'>),
          }))
          .filter(transaction => !transaction.isPlanned); // Filtere geplante Transaktionen aus
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
        
        // Filtere H+M Transaktionen aus (basierend auf Description)
        const filteredTransactions = transactions.filter(transaction => 
          !transaction.description.startsWith('H+') && !transaction.description.startsWith('M+')
        );
        
        // Gruppiere nach Monat und zähle
        const monthCounts = new Map<string, { year: number; month: number; count: number }>();
        
        filteredTransactions.forEach(transaction => {
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
    date: string;
    isBusiness?: boolean;
  }
): Promise<void> => {
  const transactionRef = ref(database, `transactions/${transactionId}`);
  
  try {
    await update(transactionRef, {
      description: updatedData.description,
      amount: updatedData.amount,
      location: updatedData.location,
      type: updatedData.type,
      date: updatedData.date,
      isBusiness: updatedData.isBusiness || false,
      // Aktualisiere auch den Timestamp für die Sortierung
      lastModified: Date.now()
    });
  } catch (error) {
    console.error('Error updating transaction:', error);
    throw new Error('Fehler beim Aktualisieren der Transaktion');
  }
};

// ===== GEPLANTE TRANSAKTIONEN =====

// Funktion zum Hinzufügen einer geplanten Transaktion
export const addPlannedTransaction = async (transactionData: TransactionFormData): Promise<string> => {
  const plannedTransactionsRef = ref(database, 'plannedTransactions');
  
  // Konvertiere den Betrag von String zu Number
  const amount = parseFloat(transactionData.amount.replace(/\./g, '').replace(',', '.'));
  
  const transaction: Omit<Transaction, 'id'> = {
    type: transactionData.type,
    amount: amount,
    description: transactionData.description,
    location: transactionData.location,
    date: transactionData.date || new Date().toISOString().split('T')[0], // Verwende das übergebene Datum oder heute
    timestamp: Date.now(),
    isPlanned: true,
    isBusiness: transactionData.isBusiness || false, // Business-Flag hinzufügen
  };

  try {
    const newTransactionRef = await push(plannedTransactionsRef, transaction);
    return newTransactionRef.key!;
  } catch (error) {
    console.error('Error adding planned transaction:', error);
    throw new Error('Fehler beim Hinzufügen der geplanten Transaktion');
  }
};

// Funktion zum Abrufen aller geplanten Transaktionen
export const getPlannedTransactions = async (): Promise<Transaction[]> => {
  const plannedTransactionsRef = ref(database, 'plannedTransactions');
  
  return new Promise((resolve, reject) => {
    onValue(plannedTransactionsRef, (snapshot) => {
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
      console.error('Error fetching planned transactions:', error);
      reject(error);
    }, { onlyOnce: true });
  });
};

// Funktion zum Löschen einer geplanten Transaktion
export const deletePlannedTransaction = async (transactionId: string): Promise<void> => {
  const plannedTransactionRef = ref(database, `plannedTransactions/${transactionId}`);
  
  try {
    await remove(plannedTransactionRef);
  } catch (error) {
    console.error('Error deleting planned transaction:', error);
    throw new Error('Fehler beim Löschen der geplanten Transaktion');
  }
};

// Funktion zum Konvertieren einer geplanten Transaktion zu einer echten Transaktion
export const convertPlannedToRealTransaction = async (plannedTransactionId: string): Promise<string> => {
  try {
    // Hole die geplante Transaktion
    const plannedTransactionRef = ref(database, `plannedTransactions/${plannedTransactionId}`);
    
    return new Promise((resolve, reject) => {
      onValue(plannedTransactionRef, async (snapshot) => {
        const plannedTransaction = snapshot.val();
        if (!plannedTransaction) {
          reject(new Error('Geplante Transaktion nicht gefunden'));
          return;
        }

        // Erstelle eine neue echte Transaktion
        const realTransactionData: TransactionFormData = {
          type: plannedTransaction.type,
          amount: plannedTransaction.amount.toString(),
          description: plannedTransaction.description,
          location: plannedTransaction.location,
        };

        try {
          // Füge die echte Transaktion hinzu
          const newTransactionId = await addTransaction(realTransactionData);
          
          // Lösche die geplante Transaktion
          await deletePlannedTransaction(plannedTransactionId);
          
          resolve(newTransactionId);
        } catch (error) {
          reject(error);
        }
      }, { onlyOnce: true });
    });
  } catch (error) {
    console.error('Error converting planned transaction:', error);
    throw new Error('Fehler beim Konvertieren der geplanten Transaktion');
  }
};

// Funktion zum Abrufen aller Transaktionen (nicht geplante)
export const getAllTransactions = async (): Promise<Transaction[]> => {
  const transactionsRef = ref(database, 'transactions');
  
  return new Promise((resolve, reject) => {
    onValue(transactionsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const transactions: Transaction[] = Object.entries(data)
          .map(([id, transaction]) => ({
            id,
            ...(transaction as Omit<Transaction, 'id'>),
          }))
          .filter(transaction => !transaction.isPlanned) // Filtere geplante Transaktionen aus
          .sort((a, b) => b.timestamp - a.timestamp); // Sortiere nach Timestamp, neueste zuerst
        resolve(transactions);
      } else {
        resolve([]);
      }
    }, (error) => {
      console.error('Error fetching all transactions:', error);
      reject(error);
    }, { onlyOnce: true });
  });
};
