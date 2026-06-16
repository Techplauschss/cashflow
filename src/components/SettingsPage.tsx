import { useEffect, useMemo, useState } from 'react';
import {
  addRecurringTransaction,
  bookRecurringTransaction,
  deleteRecurringTransaction,
  subscribeToRecurringTransactions,
  toggleRecurringTransactionActive,
} from '../services/recurringTransactionService';
import { getExchangesWithShortcuts } from '../services/transactionService';
import type { RecurrenceInterval, RecurringTransaction } from '../types/Transaction';

const formatAmount = (amount: number): string =>
  new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);

const intervalLabels: Record<RecurrenceInterval, string> = {
  weekly: 'Wöchentlich',
  monthly: 'Monatlich',
  yearly: 'Jährlich',
};

const parseAmount = (value: string): number => {
  const amount = Number.parseFloat(value.replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Bitte geben Sie einen gültigen Betrag ein.');
  }
  return amount;
};

export const SettingsPage = () => {
  const [recurringTransactions, setRecurringTransactions] = useState<RecurringTransaction[]>([]);
  const [shortcuts, setShortcuts] = useState<Array<{ shortcut: string; name: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [location, setLocation] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [interval, setInterval] = useState<RecurrenceInterval>('monthly');
  const [nextDueDate, setNextDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [isBusiness, setIsBusiness] = useState(false);
  const [sourceExchangeType, setSourceExchangeType] = useState('');

  useEffect(() => {
    const unsubscribe = subscribeToRecurringTransactions((items) => {
      setRecurringTransactions(items);
      setIsLoading(false);
    });

    getExchangesWithShortcuts()
      .then(setShortcuts)
      .catch((error) => console.error('Error loading exchange shortcuts:', error));

    return unsubscribe;
  }, []);

  const dueTransactions = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return recurringTransactions.filter((transaction) => transaction.isActive && transaction.nextDueDate <= today);
  }, [recurringTransactions]);

  const resetForm = () => {
    setDescription('');
    setAmount('');
    setLocation('');
    setType('expense');
    setInterval('monthly');
    setNextDueDate(new Date().toISOString().split('T')[0]);
    setIsBusiness(false);
    setSourceExchangeType('');
  };

  const handleAmountChange = (value: string) => {
    const normalized = value.replace(/[^\d,.]/g, '').replace(/\./g, ',');
    const firstCommaIndex = normalized.indexOf(',');
    const cleaned = firstCommaIndex === -1
      ? normalized
      : normalized.slice(0, firstCommaIndex + 1) + normalized.slice(firstCommaIndex + 1).replace(/,/g, '');
    const [integerPart, decimalPart] = cleaned.split(',');
    setAmount(decimalPart !== undefined ? `${integerPart},${decimalPart.slice(0, 2)}` : integerPart);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!description.trim() || !amount.trim() || !location.trim() || !nextDueDate) {
      alert('Bitte füllen Sie alle Pflichtfelder aus.');
      return;
    }

    setIsSaving(true);
    try {
      await addRecurringTransaction({
        type,
        amount: parseAmount(amount),
        description,
        location,
        interval,
        nextDueDate,
        isBusiness,
        sourceExchangeType: sourceExchangeType || undefined,
      });
      resetForm();
    } catch (error) {
      console.error('Error saving recurring transaction:', error);
      alert(error instanceof Error ? error.message : 'Fehler beim Speichern.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBook = async (transaction: RecurringTransaction) => {
    setBookingId(transaction.id);
    try {
      await bookRecurringTransaction(transaction.id);
      window.dispatchEvent(new CustomEvent('transaction-changed'));
    } catch (error) {
      console.error('Error booking recurring transaction:', error);
      alert(error instanceof Error ? error.message : 'Fehler beim Buchen.');
    } finally {
      setBookingId(null);
    }
  };

  return (
    <div className="flex items-center justify-center px-3 sm:px-4 pb-4 sm:pb-8">
      <div className="w-full max-w-4xl space-y-4 sm:space-y-6">
        <div className="bg-white/5 backdrop-blur-lg rounded-xl sm:rounded-2xl border border-white/10 p-4 sm:p-6 shadow-2xl">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between mb-5">
            <div>
              <h2 className="text-xl sm:text-2xl font-semibold text-white">Einstellungen</h2>
              <p className="text-sm text-slate-400 mt-1">Wiederkehrende Transaktionen verwalten und fällige Einträge buchen.</p>
            </div>
            {dueTransactions.length > 0 && (
              <span className="inline-flex w-fit rounded-full bg-cyan-500/15 px-3 py-1 text-xs font-semibold text-cyan-200 border border-cyan-400/30">
                {dueTransactions.length} fällig
              </span>
            )}
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Beschreibung"
              className="px-3 py-2.5 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <input
              value={amount}
              onChange={(event) => handleAmountChange(event.target.value)}
              placeholder="Betrag, z.B. 49,99"
              inputMode="decimal"
              className="px-3 py-2.5 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Ort / Anbieter"
              className="px-3 py-2.5 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <input
              type="date"
              value={nextDueDate}
              onChange={(event) => setNextDueDate(event.target.value)}
              className="px-3 py-2.5 bg-slate-800/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <select
              value={type}
              onChange={(event) => setType(event.target.value as 'income' | 'expense')}
              className="px-3 py-2.5 bg-slate-800/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="expense">Ausgabe</option>
              <option value="income">Einnahme</option>
            </select>
            <select
              value={interval}
              onChange={(event) => setInterval(event.target.value as RecurrenceInterval)}
              className="px-3 py-2.5 bg-slate-800/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="weekly">Wöchentlich</option>
              <option value="monthly">Monatlich</option>
              <option value="yearly">Jährlich</option>
            </select>
            <select
              value={sourceExchangeType}
              onChange={(event) => setSourceExchangeType(event.target.value)}
              className="px-3 py-2.5 bg-slate-800/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="">Standardkonto</option>
              {shortcuts.map((shortcut) => (
                <option key={shortcut.shortcut} value={shortcut.shortcut}>
                  {shortcut.shortcut} - {shortcut.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setIsBusiness(!isBusiness)}
              className={`rounded-lg border px-3 py-2.5 font-medium transition-all ${
                isBusiness
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-slate-800/50 border-slate-600 text-slate-300 hover:bg-slate-700/50'
              }`}
            >
              {isBusiness ? 'Geschäftlich' : 'Privat'}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="md:col-span-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white font-semibold px-4 py-2.5 transition-colors"
            >
              {isSaving ? 'Speichert...' : 'Wiederkehrende Transaktion anlegen'}
            </button>
          </form>
        </div>

        <div className="bg-white/5 backdrop-blur-lg rounded-xl sm:rounded-2xl border border-white/10 p-4 sm:p-6 shadow-2xl">
          <h3 className="text-lg font-semibold text-white mb-4">Aktive Wiederholungen</h3>
          {isLoading ? (
            <div className="text-slate-400">Lade...</div>
          ) : recurringTransactions.length === 0 ? (
            <div className="text-slate-400 text-sm">Noch keine wiederkehrenden Transaktionen angelegt.</div>
          ) : (
            <div className="space-y-3">
              {recurringTransactions.map((transaction) => {
                const isDue = dueTransactions.some((due) => due.id === transaction.id);
                return (
                  <div key={transaction.id} className={`rounded-lg border p-3 sm:p-4 ${
                    isDue ? 'bg-cyan-500/10 border-cyan-400/40' : 'bg-slate-800/30 border-slate-600/30'
                  }`}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-white font-semibold">{transaction.description}</span>
                          {!transaction.isActive && <span className="text-xs text-slate-400">(pausiert)</span>}
                          {isDue && <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-xs text-cyan-200">fällig</span>}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          {transaction.location} • {intervalLabels[transaction.interval]} • nächster Termin {new Date(transaction.nextDueDate).toLocaleDateString('de-DE')}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        <span className={`font-bold ${transaction.type === 'income' ? 'text-green-400' : 'text-red-400'}`}>
                          {transaction.type === 'income' ? '+' : '-'}{formatAmount(transaction.amount)}
                        </span>
                        <button
                          onClick={() => handleBook(transaction)}
                          disabled={!transaction.isActive || bookingId === transaction.id}
                          className="rounded-md bg-green-600/90 hover:bg-green-500 disabled:opacity-50 px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          {bookingId === transaction.id ? 'Bucht...' : 'Buchen'}
                        </button>
                        <button
                          onClick={() => toggleRecurringTransactionActive(transaction.id, !transaction.isActive)}
                          className="rounded-md bg-slate-700 hover:bg-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200"
                        >
                          {transaction.isActive ? 'Pausieren' : 'Aktivieren'}
                        </button>
                        <button
                          onClick={() => deleteRecurringTransaction(transaction.id)}
                          className="rounded-md bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 px-3 py-1.5 text-xs font-semibold text-red-300"
                        >
                          Löschen
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
