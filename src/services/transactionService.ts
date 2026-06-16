import { ref, push, onValue, off, query, orderByChild, startAt, endAt, update, remove, get, runTransaction } from 'firebase/database';
import { database } from '../firebase';
import type { Transaction, TransactionFormData } from '../types/Transaction';

type ExchangeType = keyof typeof EXCHANGE_NAME_GROUPS;
type TransactionRecord = Omit<Transaction, 'id'>;
type ExchangeRecord = Omit<Exchange, 'id'>;
type TransactionUpdateData = {
  description?: string;
  amount?: number;
  location?: string;
  type?: 'income' | 'expense';
  date?: string;
  isBusiness?: boolean;
  affectsBalance?: boolean;
  addedToMain?: boolean;
  isOneTimeInvestment?: boolean;
  kilometerstand?: number;
  liter?: number;
  vehicle?: 'Auto' | 'Moped' | 'Skoda' | 'Sonstige';
  sourceExchangeId?: string | null;
};

const EXCHANGE_NAME_GROUPS: Record<'TR' | 'SP' | 'B' | 'V', string[]> = {
  TR: ['tagesgeld', 'trade republic', 'trade-republic', 'trade republic tagesgeld', 'tr'],
  SP: ['sparkasse', 'sparkasse giro', 'sp'],
  B: ['bar', 'bargeld', 'kasse'],
  V: ['vivid', 'vivid giro', 'v'],
};

export interface PortfolioProduct {
  id: string;
  isin: string;
  shares: number;
}

export interface Exchange {
  id: string;
  name: string;
  balance: number;
  timestamp: number;
  parentId?: string | null;
  shortcut?: string | null; // Kürzel für schnelle Zuordnung in Transaktionen
  products?: PortfolioProduct[];
}

const normalizeName = (value: string) => value.trim().toLowerCase();

const isExchangeType = (value: string): value is ExchangeType => value in EXCHANGE_NAME_GROUPS;

const parseTransactionAmount = (value: string): number => {
  const normalized = value.trim().replace(/[^\d,.-]/g, '');
  if (!normalized) {
    throw new Error('Bitte geben Sie einen gültigen Betrag ein.');
  }

  const hasComma = normalized.includes(',');
  const hasDot = normalized.includes('.');
  let parseable = normalized;

  if (hasComma) {
    parseable = normalized.replace(/\./g, '').replace(',', '.');
  } else if (hasDot) {
    const dotParts = normalized.split('.');
    if (dotParts.length > 2) {
      parseable = dotParts.join('');
    } else {
      const [integerPart, decimalPart] = dotParts;
      const isLikelyThousandsSeparator =
        decimalPart.length === 3 && integerPart.length > 0 && integerPart.length <= 3;
      parseable = isLikelyThousandsSeparator ? integerPart + decimalPart : normalized;
    }
  }

  const amount = Number.parseFloat(parseable);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Bitte geben Sie einen gültigen Betrag ein.');
  }

  return amount;
};

const mapTransactions = (data: Record<string, TransactionRecord>): Transaction[] =>
  Object.entries(data).map(([id, transaction]) => ({
    id,
    ...transaction,
  }));

const mapExchanges = (data: Record<string, ExchangeRecord>): Exchange[] =>
  Object.entries(data).map(([id, exchange]) => ({
    id,
    ...exchange,
  }));

const getTransactionBalanceImpact = (transaction: Pick<Transaction, 'type' | 'amount' | 'affectsBalance'>): number => {
  if (transaction.affectsBalance === false) return 0;

  const amount = Math.abs(Number(transaction.amount));
  if (!Number.isFinite(amount) || amount <= 0) return 0;

  return transaction.type === 'expense' ? -amount : amount;
};

const findExchangeByNameGroup = (exchanges: Exchange[], names: string[]) => {
  const normalizedNames = names.map(normalizeName);

  const exactMatch = exchanges.find(ex => normalizedNames.includes(normalizeName(ex.name)));
  if (exactMatch) return exactMatch;

  return exchanges.find(ex => normalizedNames.some(name => normalizeName(ex.name).includes(name))) || null;
};

export const findExchangeByType = async (type: 'TR' | 'SP' | 'B' | 'V'): Promise<Exchange | null> => {
  const exchangesRef = ref(database, 'exchanges');
  const snapshot = await get(exchangesRef);
  if (!snapshot.exists()) return null;

  const exchanges = mapExchanges(snapshot.val() as Record<string, ExchangeRecord>);

  return findExchangeByNameGroup(exchanges, EXCHANGE_NAME_GROUPS[type]);
};

const findDefaultAssetExchange = async (): Promise<Exchange | null> => {
  const exchangesRef = ref(database, 'exchanges');
  const snapshot = await get(exchangesRef);
  if (!snapshot.exists()) return null;

  const exchanges = mapExchanges(snapshot.val() as Record<string, ExchangeRecord>);

  return findExchangeByNameGroup(exchanges, EXCHANGE_NAME_GROUPS.TR)
    || findExchangeByNameGroup(exchanges, EXCHANGE_NAME_GROUPS.SP)
    || findExchangeByNameGroup(exchanges, EXCHANGE_NAME_GROUPS.B)
    || exchanges[0]
    || null;
};

const updateExchangeBalance = async (exchangeId: string, delta: number): Promise<void> => {
  const exchangeBalanceRef = ref(database, `exchanges/${exchangeId}/balance`);
  await runTransaction(exchangeBalanceRef, (currentValue) => {
    if (currentValue === null || currentValue === undefined) {
      return currentValue;
    }

    const numericValue = Number(currentValue);
    if (Number.isNaN(numericValue)) {
      return currentValue;
    }

    return numericValue + delta;
  });
};

const applyExchangeBalanceChanges = async (changes: Array<{ exchangeId: string; delta: number }>): Promise<void> => {
  const appliedChanges: Array<{ exchangeId: string; delta: number }> = [];

  try {
    for (const change of changes) {
      if (change.delta === 0) continue;
      await updateExchangeBalance(change.exchangeId, change.delta);
      appliedChanges.push(change);
    }
  } catch (error) {
    for (const change of appliedChanges.reverse()) {
      try {
        await updateExchangeBalance(change.exchangeId, -change.delta);
      } catch (rollbackError) {
        console.error('❌ [applyExchangeBalanceChanges] Error rolling back exchange balance:', rollbackError);
      }
    }
    throw error;
  }
};

const buildBalanceChanges = (
  previousExchangeId: string | null,
  previousImpact: number,
  nextExchangeId: string | null,
  nextImpact: number,
): Array<{ exchangeId: string; delta: number }> => {
  if (!previousExchangeId && !nextExchangeId) return [];

  if (previousExchangeId && nextExchangeId && previousExchangeId === nextExchangeId) {
    const delta = nextImpact - previousImpact;
    return delta === 0 ? [] : [{ exchangeId: nextExchangeId, delta }];
  }

  return [
    ...(previousExchangeId && previousImpact !== 0
      ? [{ exchangeId: previousExchangeId, delta: -previousImpact }]
      : []),
    ...(nextExchangeId && nextImpact !== 0
      ? [{ exchangeId: nextExchangeId, delta: nextImpact }]
      : []),
  ];
};

const resolveTransactionExchangeId = async (sourceExchangeId?: string | null): Promise<string | null> => {
  if (sourceExchangeId) return sourceExchangeId;
  return (await findDefaultAssetExchange())?.id || null;
};

// Funktion zum Hinzufügen einer neuen Transaktion (normale, nicht geplante)
export const addTransaction = async (transactionData: TransactionFormData): Promise<string> => {
  const transactionsRef = ref(database, 'transactions');
  
  // Konvertiere den Betrag von String zu Number
  const amount = parseTransactionAmount(transactionData.amount);
  const affectsBalance = transactionData.affectsBalance ?? true;
  let selectedExchange: Exchange | null = null;

  if (!affectsBalance) {
    selectedExchange = null;
  } else if (transactionData.sourceExchangeType) {
    // Zuerst versuchen, über Shortcut zu finden
    selectedExchange = await findExchangeByShortcut(transactionData.sourceExchangeType);
    
    // Fallback auf feste Zuordnungen wenn kein Shortcut gefunden
    if (!selectedExchange && isExchangeType(transactionData.sourceExchangeType)) {
      selectedExchange = await findExchangeByType(transactionData.sourceExchangeType);
    }
  } else {
    selectedExchange = await findDefaultAssetExchange();
  }

  const transaction: Omit<Transaction, 'id'> = {
    type: transactionData.type,
    amount: amount,
    description: transactionData.description,
    location: transactionData.location,
    date: transactionData.date || new Date().toISOString().split('T')[0], // Nutze übergebenes Datum oder aktuelles Datum
    timestamp: Date.now(),
    isPlanned: false, // Normale Transaktionen sind nicht geplant
    isBusiness: transactionData.isBusiness || false, // Business-Flag hinzufügen
    isOneTimeInvestment: transactionData.isOneTimeInvestment || false, // Einmal-Investition Flag
    affectsBalance,
    ...(selectedExchange ? { sourceExchangeId: selectedExchange.id } : {}),
  };

  if (transactionData.kilometerstand !== undefined) transaction.kilometerstand = transactionData.kilometerstand;
  if (transactionData.liter !== undefined) transaction.liter = transactionData.liter;
  if (transactionData.vehicle !== undefined) transaction.vehicle = transactionData.vehicle;

  console.log('🔵 [addTransaction] Adding new transaction:', transaction);

  try {
    const newTransactionRef = await push(transactionsRef, transaction);
    console.log('✅ [addTransaction] Successfully added transaction with ID:', newTransactionRef.key);

    if (selectedExchange) {
      const delta = getTransactionBalanceImpact(transaction);
      try {
        await applyExchangeBalanceChanges([{ exchangeId: selectedExchange.id, delta }]);
      } catch (balanceError) {
        console.error('❌ [addTransaction] Error updating selected asset exchange balance:', balanceError);
        await remove(newTransactionRef);
        throw new Error('Fehler beim Aktualisieren des ausgewählten Vermögenskontos. Die Transaktion wurde nicht gespeichert.');
      }
    }

    return newTransactionRef.key!;
  } catch (error) {
    console.error('❌ [addTransaction] Error adding transaction:', error);
    throw new Error(error instanceof Error ? error.message : 'Fehler beim Hinzufügen der Transaktion');
  }
};

export const findExchangeByShortcut = async (shortcut: string): Promise<Exchange | null> => {
  const exchangesRef = ref(database, 'exchanges');
  const snapshot = await get(exchangesRef);
  if (!snapshot.exists()) return null;

  const exchanges = mapExchanges(snapshot.val() as Record<string, ExchangeRecord>);

  return exchanges.find(ex => ex.shortcut?.toUpperCase() === shortcut.toUpperCase()) || null;
};

// Hilfsfunktion zum Prüfen auf H+M Transaktionen
export const isHMTransaction = (description: string): boolean => {
  return description.startsWith('H+') || description.startsWith('M+');
};

// Funktion zum Abrufen aller Transaktionen (ohne geplante)
export const subscribeToTransactions = (callback: (transactions: Transaction[]) => void): (() => void) => {
  const transactionsRef = ref(database, 'transactions');
  
  const unsubscribe = onValue(transactionsRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      const transactions = mapTransactions(data as Record<string, TransactionRecord>)
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
export const getTransactionsForMonth = async (year: number, month: number, includeHM: boolean = false): Promise<Transaction[]> => {
  const transactionsRef = ref(database, 'transactions');
  
  // Erstelle Start- und Enddatum für den Monat
  // Wichtig: Nutze UTC um Timezone-Probleme zu vermeiden
  const startDate = new Date(Date.UTC(year, month - 1, 1)).toISOString().split('T')[0];
  const endDate = new Date(Date.UTC(year, month, 0)).toISOString().split('T')[0];
  
  console.log(`🔍 [getTransactionsForMonth] Loading transactions for ${year}-${month} (${startDate} to ${endDate})`);
  
  const monthQuery = query(
    transactionsRef,
    orderByChild('date'),
    startAt(startDate),
    endAt(endDate)
  );
  
  return new Promise((resolve, reject) => {
    onValue(monthQuery, (snapshot) => {
      const data = snapshot.val();
      console.log(`📊 [getTransactionsForMonth] Raw data from Firebase:`, data);
      
      if (data) {
        const allTransactions = mapTransactions(data as Record<string, TransactionRecord>);
        
        console.log(`📋 [getTransactionsForMonth] All transactions before filtering (${allTransactions.length}):`, allTransactions);
        
        const transactions: Transaction[] = allTransactions
          .filter(transaction => !transaction.isPlanned) // Filtere geplante Transaktionen aus
          .filter(transaction => !transaction.isOneTimeInvestment) // Filtere Einmal-Investitionen aus
          .filter(transaction => 
            includeHM || !isHMTransaction(transaction.description)
          ); // Filtere H+M Transaktionen aus (außer explizit gewünscht)
        
        console.log(`✅ [getTransactionsForMonth] Transactions after filtering (${transactions.length}):`, transactions);
        resolve(transactions);
      } else {
        console.log(`⚠️ [getTransactionsForMonth] No data found for this month`);
        resolve([]);
      }
    }, (error) => {
      console.error('❌ [getTransactionsForMonth] Error fetching transactions for month:', error);
      reject(error);
    }, { onlyOnce: true });
  });
};

// ===== BÖRSEN / VERMÖGEN =====

export const addExchange = async (name: string, balance: number, parentId: string | null = null, shortcut?: string, products?: PortfolioProduct[]): Promise<string> => {
  const exchangesRef = ref(database, 'exchanges');
  try {
    const newRef = await push(exchangesRef, {
      name,
      balance,
      timestamp: Date.now(),
      parentId,
      ...(shortcut ? { shortcut } : {}),
      ...(products && products.length > 0 ? { products } : {})
    });
    return newRef.key!;
  } catch (error) {
    console.error('Error adding exchange:', error);
    throw new Error('Fehler beim Hinzufügen der Börse');
  }
};

export const updateExchange = async (id: string, data: Partial<Exchange>): Promise<void> => {
  const exchangeRef = ref(database, `exchanges/${id}`);
  try {
    await update(exchangeRef, { ...data, timestamp: Date.now() });
  } catch (error) {
    console.error('Error updating exchange:', error);
    throw new Error('Fehler beim Aktualisieren der Börse');
  }
};

export const deleteExchange = async (id: string): Promise<void> => {
  const exchangeRef = ref(database, `exchanges/${id}`);
  try {
    await remove(exchangeRef);
  } catch (error) {
    console.error('Error deleting exchange:', error);
    throw new Error('Fehler beim Löschen der Börse');
  }
};

export const getExchangesWithShortcuts = async (): Promise<Array<{shortcut: string; name: string}>> => {
  const exchangesRef = ref(database, 'exchanges');
  const snapshot = await get(exchangesRef);
  if (!snapshot.exists()) return [];

  const exchanges = mapExchanges(snapshot.val() as Record<string, ExchangeRecord>);

  return exchanges
    .filter(ex => ex.shortcut)
    .map(ex => ({ shortcut: ex.shortcut!, name: ex.name }))
    .sort((a, b) => a.shortcut.localeCompare(b.shortcut));
};

export const subscribeToExchanges = (callback: (exchanges: Exchange[]) => void): (() => void) => {
  const exchangesRef = ref(database, 'exchanges');
  const unsubscribe = onValue(exchangesRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      const exchanges = mapExchanges(data as Record<string, ExchangeRecord>);
      // Nach dem höchsten Saldo absteigend sortieren
      callback(exchanges.sort((a, b) => b.balance - a.balance));
    } else {
      callback([]);
    }
  });
  return () => off(exchangesRef, 'value', unsubscribe);
};

// Funktion zum Abrufen aller verfügbaren Monate (nur Metadaten)
export const getAvailableMonths = async (includeHM: boolean = false): Promise<Array<{ year: number; month: number; monthYear: string; count: number }>> => {
  const transactionsRef = ref(database, 'transactions');
  
  return new Promise((resolve, reject) => {
    onValue(transactionsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const transactions = mapTransactions(data as Record<string, TransactionRecord>);
        
        // Filtere H+M Transaktionen aus (basierend auf Description)
        const filteredTransactions = transactions.filter(transaction => 
          (includeHM || !isHMTransaction(transaction.description)) &&
          !transaction.isOneTimeInvestment // Filtere Einmal-Investitionen aus
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

// Funktion zum Aktualisieren des Fahrzeugs einer Transaktion
export const updateVehicle = async (transactionId: string, vehicle: 'Auto' | 'Moped' | 'Skoda' | 'Sonstige'): Promise<void> => {
  const transactionRef = ref(database, `transactions/${transactionId}`);
  
  try {
    await update(transactionRef, { vehicle });
  } catch (error) {
    console.error('Error updating vehicle:', error);
    throw new Error('Fehler beim Aktualisieren des Fahrzeugs');
  }
};

// Funktion zum Löschen einer Transaktion
export const deleteTransaction = async (transactionId: string): Promise<void> => {
  const transactionRef = ref(database, `transactions/${transactionId}`);
  
  try {
    const snapshot = await get(transactionRef);
    if (!snapshot.exists()) {
      throw new Error('Transaktion nicht gefunden');
    }

    const transaction = { id: transactionId, ...(snapshot.val() as TransactionRecord) };
    const exchangeId = await resolveTransactionExchangeId(transaction.sourceExchangeId);
    const revertDelta = -getTransactionBalanceImpact(transaction);

    if (exchangeId && revertDelta !== 0) {
      await applyExchangeBalanceChanges([{ exchangeId, delta: revertDelta }]);
    }

    try {
      await remove(transactionRef);
    } catch (removeError) {
      if (exchangeId && revertDelta !== 0) {
        await applyExchangeBalanceChanges([{ exchangeId, delta: -revertDelta }]);
      }
      throw removeError;
    }
  } catch (error) {
    console.error('Error deleting transaction:', error);
    throw new Error(error instanceof Error ? error.message : 'Fehler beim Löschen der Transaktion');
  }
};

// Funktion zum Aktualisieren einer Transaktion
export const updateTransaction = async (
  transactionId: string, 
  updatedData: TransactionUpdateData
): Promise<void> => {
  const transactionRef = ref(database, `transactions/${transactionId}`);
  
  try {
    const snapshot = await get(transactionRef);
    if (!snapshot.exists()) {
      throw new Error('Transaktion nicht gefunden');
    }

    const existingTransaction: Transaction = {
      id: transactionId,
      ...(snapshot.val() as TransactionRecord),
    };

    if (updatedData.amount !== undefined && (!Number.isFinite(updatedData.amount) || updatedData.amount <= 0)) {
      throw new Error('Bitte geben Sie einen gültigen Betrag ein.');
    }

    const updates: Partial<Transaction> = {
      lastModified: Date.now()
    };
    
    // Nur definierte Felder aktualisieren
    if (updatedData.description !== undefined) updates.description = updatedData.description;
    if (updatedData.amount !== undefined) updates.amount = updatedData.amount;
    if (updatedData.location !== undefined) updates.location = updatedData.location;
    if (updatedData.type !== undefined) updates.type = updatedData.type;
    if (updatedData.date !== undefined) updates.date = updatedData.date;
    if (updatedData.isBusiness !== undefined) updates.isBusiness = updatedData.isBusiness;
    if (updatedData.affectsBalance !== undefined) updates.affectsBalance = updatedData.affectsBalance;
    if (updatedData.addedToMain !== undefined) updates.addedToMain = updatedData.addedToMain;
    if (updatedData.isOneTimeInvestment !== undefined) updates.isOneTimeInvestment = updatedData.isOneTimeInvestment;
    if (updatedData.kilometerstand !== undefined) updates.kilometerstand = updatedData.kilometerstand;
    if (updatedData.liter !== undefined) updates.liter = updatedData.liter;
    if (updatedData.vehicle !== undefined) updates.vehicle = updatedData.vehicle;
    if (updatedData.sourceExchangeId !== undefined) updates.sourceExchangeId = updatedData.sourceExchangeId || undefined;

    const nextTransaction: Transaction = {
      ...existingTransaction,
      ...updates,
    };
    const previousExchangeId = await resolveTransactionExchangeId(existingTransaction.sourceExchangeId);
    const nextExchangeId = await resolveTransactionExchangeId(nextTransaction.sourceExchangeId);
    const balanceChanges = buildBalanceChanges(
      previousExchangeId,
      getTransactionBalanceImpact(existingTransaction),
      nextExchangeId,
      getTransactionBalanceImpact(nextTransaction),
    );
    await applyExchangeBalanceChanges(balanceChanges);

    try {
      await update(transactionRef, updates);
    } catch (updateError) {
      await applyExchangeBalanceChanges(balanceChanges.map(change => ({
        exchangeId: change.exchangeId,
        delta: -change.delta,
      })));
      throw updateError;
    }
  } catch (error) {
    console.error('Error updating transaction:', error);
    throw new Error(error instanceof Error ? error.message : 'Fehler beim Aktualisieren der Transaktion');
  }
};

// ===== GEPLANTE TRANSAKTIONEN =====

// Funktion zum Hinzufügen einer geplanten Transaktion
export const addPlannedTransaction = async (transactionData: TransactionFormData): Promise<string> => {
  const plannedTransactionsRef = ref(database, 'plannedTransactions');
  
  // Konvertiere den Betrag von String zu Number
  const amount = parseTransactionAmount(transactionData.amount);
  
  const transaction: Omit<Transaction, 'id'> = {
    type: transactionData.type,
    amount: amount,
    description: transactionData.description,
    location: transactionData.location,
    date: transactionData.date || new Date().toISOString().split('T')[0], // Verwende das übergebene Datum oder heute
    timestamp: Date.now(),
    isPlanned: true,
    isBusiness: transactionData.isBusiness || false, // Business-Flag hinzufügen
    isOneTimeInvestment: transactionData.isOneTimeInvestment || false, // Einmal-Investition-Flag hinzufügen
    affectsBalance: transactionData.affectsBalance ?? false,
  };

  if (transactionData.kilometerstand !== undefined) transaction.kilometerstand = transactionData.kilometerstand;
  if (transactionData.liter !== undefined) transaction.liter = transactionData.liter;
  if (transactionData.vehicle !== undefined) transaction.vehicle = transactionData.vehicle;

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
        const transactions = mapTransactions(data as Record<string, TransactionRecord>);
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
          isBusiness: plannedTransaction.isBusiness,
          isOneTimeInvestment: plannedTransaction.isOneTimeInvestment,
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
        const transactions = mapTransactions(data as Record<string, TransactionRecord>)
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

// Funktion zum Abrufen von Einmal-Investitionen für ein bestimmtes Jahr
export const getOneTimeInvestmentsForYear = async (year: number): Promise<Transaction[]> => {
  const transactionsRef = ref(database, 'transactions');
  
  // Erstelle Start- und Enddatum für das Jahr
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;
  
  console.log(`🔍 [getOneTimeInvestmentsForYear] Loading one-time investments for ${year} (${startDate} to ${endDate})`);
  
  const yearQuery = query(
    transactionsRef,
    orderByChild('date'),
    startAt(startDate),
    endAt(endDate)
  );
  
  return new Promise((resolve, reject) => {
    onValue(yearQuery, (snapshot) => {
      const data = snapshot.val();
      
      if (data) {
        const transactions = mapTransactions(data as Record<string, TransactionRecord>)
          .filter(t => !t.isPlanned && t.isOneTimeInvestment === true);
        
        // Sortiere absteigend nach Datum
        transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        resolve(transactions);
      } else {
        resolve([]);
      }
    }, (error) => reject(error), { onlyOnce: true });
  });
};
