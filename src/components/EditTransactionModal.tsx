import React, { useState, useEffect } from 'react';
import type { Transaction } from '../types/Transaction';

interface EditTransactionModalProps {
  isOpen: boolean;
  transaction: Transaction | null;
  onSave: (transactionId: string, updatedData: {
    description: string;
    amount: number;
    location: string;
    type: 'income' | 'expense';
    date: string;
    isBusiness?: boolean;
    isOneTimeInvestment?: boolean;
    kilometerstand?: number;
    liter?: number;
  }) => void;
  onCancel: () => void;
}

export const EditTransactionModal: React.FC<EditTransactionModalProps> = ({
  isOpen,
  transaction,
  onSave,
  onCancel
}) => {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [location, setLocation] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [date, setDate] = useState('');
  const [isBusiness, setIsBusiness] = useState(false);
  const [isOneTimeInvestment, setIsOneTimeInvestment] = useState(false);
  const [kilometerstand, setKilometerstand] = useState('');
  const [liter, setLiter] = useState('');

  useEffect(() => {
    if (transaction) {
      setDescription(transaction.description);
      setAmount(Math.abs(transaction.amount).toString());
      setLocation(transaction.location);
      setType(transaction.type);
      setDate(transaction.date);
      setIsBusiness(transaction.isBusiness || false);
      setIsOneTimeInvestment(transaction.isOneTimeInvestment || false);
      setKilometerstand(transaction.kilometerstand ? String(transaction.kilometerstand) : '');
      setLiter(transaction.liter ? String(transaction.liter).replace('.', ',') : '');
    }
  }, [transaction]);

  if (!isOpen || !transaction) return null;



  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!description.trim() || !amount.trim()) {
      alert('Bitte füllen Sie alle erforderlichen Felder aus.');
      return;
    }

    const numericAmount = parseFloat(amount);

    onSave(transaction.id, {
      description: description.trim(),
      amount: numericAmount,
      location: location.trim() || 'Unbekannt',
      type,
      date,
      isBusiness,
      isOneTimeInvestment,
      kilometerstand: kilometerstand ? parseInt(kilometerstand.replace(/\./g, ''), 10) : undefined,
      liter: liter ? parseFloat(liter.replace(',', '.')) : undefined,
    });
  };

  const isTanken = (() => {
    const lowerDescription = description.toLowerCase();
    const hasTanken = lowerDescription.includes('tanken');
    const hasSprit = lowerDescription.includes('sprit') && !lowerDescription.includes('sprite');
    return (hasTanken || hasSprit) && type === 'expense';
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      
      {/* Modal */}
      <div className="relative max-h-[92dvh] w-full overflow-hidden rounded-t-3xl border border-slate-600/50 bg-slate-800/95 shadow-2xl backdrop-blur-lg transition-all duration-200 sm:max-w-md sm:rounded-2xl">
        <div className="max-h-[92dvh] overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6">
          {/* Header */}
          <div className="mb-5 flex items-center">
            <div className="mr-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-blue-400 sm:mr-4 sm:h-12 sm:w-12">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Transaktion bearbeiten</h3>
              <p className="text-sm text-slate-400">Details der Transaktion ändern</p>
            </div>
          </div>
          
          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-4">
            {/* Type Toggle */}
            <div className="flex bg-slate-700/30 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setType('expense')}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                  type === 'expense'
                    ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                Ausgabe
              </button>
              <button
                type="button"
                onClick={() => setType('income')}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                  type === 'income'
                    ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                Einnahme
              </button>
            </div>

            {/* Amount */}
            <div className="relative">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Betrag
              </label>
              <span className="absolute left-3 top-10 text-slate-400">€</span>
              <input
                type="number"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-xl border border-slate-600/30 bg-slate-700/50 py-3 pl-8 pr-4 text-base text-white placeholder-slate-400 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0,00"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Beschreibung
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-xl border border-slate-600/30 bg-slate-700/50 px-4 py-3 text-base text-white placeholder-slate-400 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="z.B. Lebensmittel, Gehalt..."
                required
              />
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Ort
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full rounded-xl border border-slate-600/30 bg-slate-700/50 px-4 py-3 text-base text-white placeholder-slate-400 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="z.B. Supermarkt, Online..."
              />
            </div>

            {/* Tanken-spezifische Felder */}
            {isTanken && (
              <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Kilometerstand
                  </label>
                  <input
                    type="text"
                    value={kilometerstand}
                    onChange={(e) => setKilometerstand(e.target.value.replace(/[^\d]/g, ''))}
                    inputMode="numeric"
                    className="w-full rounded-xl border border-slate-600/30 bg-slate-700/50 px-4 py-3 text-base text-white placeholder-slate-400 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="km"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Liter
                  </label>
                  <input
                    type="text"
                    value={liter}
                    onChange={(e) => setLiter(e.target.value.replace(/[^\d,]/g, ''))}
                    inputMode="decimal"
                    className="w-full rounded-xl border border-slate-600/30 bg-slate-700/50 px-4 py-3 text-base text-white placeholder-slate-400 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="L"
                  />
                </div>
              </div>
            )}

            {/* Toggles für Business und Einmal-Investition */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Business Toggle */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Geschäftlich
                </label>
                <button
                  type="button"
                  onClick={() => setIsBusiness(!isBusiness)}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-medium transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isBusiness
                      ? 'bg-blue-600 text-white border border-blue-500'
                      : 'bg-slate-700/50 text-slate-300 border border-slate-600/30 hover:bg-slate-600/50'
                  }`}
                >
                  <span className="font-bold">B</span>
                  <span>{isBusiness ? 'Geschäftstransaktion' : 'Privat'}</span>
                </button>
              </div>

              {/* Einmal-Investition Toggle */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Investition
                </label>
                <button
                  type="button"
                  onClick={() => setIsOneTimeInvestment(!isOneTimeInvestment)}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-medium transition-all focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                    isOneTimeInvestment
                      ? 'bg-purple-600 text-white border border-purple-500'
                      : 'bg-slate-700/50 text-slate-300 border border-slate-600/30 hover:bg-slate-600/50'
                  }`}
                >
                  <span className="font-bold">I</span>
                  <span>{isOneTimeInvestment ? 'Einmal-Investition' : 'Normal'}</span>
                </button>
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Datum
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-slate-600/30 bg-slate-700/50 px-4 py-3 text-base text-white placeholder-slate-400 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3 pt-3 sm:flex-row sm:pt-4">
              <button
                type="button"
                onClick={onCancel}
                className="order-2 rounded-xl border border-slate-600/30 bg-slate-700/50 px-4 py-3 text-slate-300 transition-all hover:border-slate-500/50 hover:bg-slate-600/50 hover:text-white focus:outline-none focus:ring-2 focus:ring-slate-500/50 sm:order-1"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                className="order-1 rounded-xl border border-blue-500/50 bg-blue-600 px-4 py-3 font-medium text-white transition-all hover:border-blue-400/50 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 sm:order-2"
              >
                Speichern
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
