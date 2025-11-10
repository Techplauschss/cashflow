import React, { useState, useEffect } from 'react';
import type { Transaction } from '../types/Transaction';

type NewTransactionData = Omit<Transaction, 'id'> & { isBusiness?: boolean };

interface AddTransactionModalProps {
  isOpen: boolean;
  prefilledData?: Partial<Transaction>;
  onSave: (newTransactionData: NewTransactionData) => void | Promise<void>;
  onCancel: () => void;
}

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  isOpen,
  prefilledData = {},
  onSave,
  onCancel
}) => {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [location, setLocation] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isBusiness, setIsBusiness] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDescription(prefilledData.description || '');
      setAmount(prefilledData.amount ? Math.abs(prefilledData.amount).toFixed(2).replace('.', ',') : '');
      setLocation(prefilledData.location || '');
      setType(prefilledData.type || 'expense');
      setDate(prefilledData.date || new Date().toISOString().split('T')[0]);
      setIsBusiness(prefilledData.isBusiness || false);
    }
  }, [isOpen, prefilledData]);

  if (!isOpen) return null;

  const handleAmountKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const allowedKeys = [
      'Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 
      'ArrowUp', 'ArrowDown', 'Home', 'End'
    ];
    
    const isNumber = /^[0-9]$/.test(e.key);
    const isCommaOrDot = e.key === ',' || e.key === '.';
    const isAllowedKey = allowedKeys.includes(e.key);
    const isCtrlA = e.ctrlKey && e.key === 'a';
    const isCtrlC = e.ctrlKey && e.key === 'c';
    const isCtrlV = e.ctrlKey && e.key === 'v';
    const isCtrlX = e.ctrlKey && e.key === 'x';
    
    if (!isNumber && !isCommaOrDot && !isAllowedKey && !isCtrlA && !isCtrlC && !isCtrlV && !isCtrlX) {
      e.preventDefault();
    }
  };

  const formatAmount = (value: string): string => {
    const cleanValue = value.replace(/\./g, '');
    const parts = cleanValue.split(',');
    const integerPart = parts[0];
    let decimalPart = parts[1];
    
    if (decimalPart && decimalPart.length > 2) {
      decimalPart = decimalPart.substring(0, 2);
    }
    
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    
    return decimalPart !== undefined ? `${formattedInteger},${decimalPart}` : formattedInteger;
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatAmount(e.target.value);
    setAmount(formatted);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!description.trim() || !amount.trim()) {
      alert('Bitte füllen Sie alle erforderlichen Felder aus.');
      return;
    }

    const numericAmount = parseFloat(amount.replace(/\./g, '').replace(',', '.'));
    
    if (isNaN(numericAmount) || numericAmount <= 0) {
      alert('Bitte geben Sie einen gültigen Betrag ein.');
      return;
    }

    onSave({
      description: description.trim(),
      amount: numericAmount,
      location: location.trim() || 'Unbekannt',
      type,
      date,
      isBusiness,
      timestamp: Date.now(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      
      {/* Modal */}
      <div className="relative bg-slate-800/95 backdrop-blur-lg border border-slate-600/50 rounded-2xl shadow-2xl max-w-md w-full mx-4 transform transition-all duration-200 scale-100 opacity-100">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center mb-6">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mr-4 bg-blue-500/20 text-blue-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Neue Transaktion</h3>
              <p className="text-sm text-slate-400">Fügen Sie eine neue Transaktion hinzu</p>
            </div>
          </div>
          
          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
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
                type="text"
                value={amount}
                onChange={handleAmountChange}
                onKeyDown={handleAmountKeyDown}
                className="w-full pl-8 pr-4 py-2.5 bg-slate-700/50 border border-slate-600/30 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
                className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600/30 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
                className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600/30 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="z.B. Supermarkt, Online..."
              />
            </div>

            {/* Business Toggle */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Transaktionstyp
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
                <span>{isBusiness ? 'Geschäftstransaktion' : 'Private Transaktion'}</span>
              </button>
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
                className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600/30 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                required
              />
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2.5 text-slate-300 hover:text-white bg-slate-700/50 hover:bg-slate-600/50 border border-slate-600/30 hover:border-slate-500/50 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-slate-500/50 order-2 sm:order-1"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                className="px-4 py-2.5 font-medium text-white bg-blue-600 hover:bg-blue-500 border border-blue-500/50 hover:border-blue-400/50 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50 order-1 sm:order-2"
              >
                Hinzufügen
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
