import React, { useState, useEffect } from 'react';
import type { Transaction } from '../types/Transaction';

interface HMEditModalProps {
  isOpen: boolean;
  transaction: Transaction | null;
  onSave: (transactionId: string, updatedData: {
    description: string;
    amount: number;
    location: string;
    type: 'H' | 'M';
    debtor: 'H' | 'M' | 'none';
  }) => void;
  onCancel: () => void;
}

export const HMEditModal: React.FC<HMEditModalProps> = ({
  isOpen,
  transaction,
  onSave,
  onCancel
}) => {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [location, setLocation] = useState('');
  const [type, setType] = useState<'H' | 'M'>('H');
  const [debtor, setDebtor] = useState<'H' | 'M' | 'none'>('none');

  useEffect(() => {
    if (transaction) {
      let currentDebtor: 'H' | 'M' | 'none' = 'none';
      if (transaction.description.includes('H schuldet M')) {
        currentDebtor = 'H';
      } else if (transaction.description.includes('M schuldet H')) {
        currentDebtor = 'M';
      }
      setDebtor(currentDebtor);

      const cleanDescription = transaction.description
        .replace(/^[HM]\+ /, '')
        .replace(/\(H schuldet M\)/, '')
        .replace(/\(M schuldet H\)/, '')
        .trim();
      
      setDescription(cleanDescription);
      setAmount(Math.abs(transaction.amount).toFixed(2).replace('.', ','));
      setLocation(transaction.location);
      
      setType(transaction.description.startsWith('H+') ? 'H' : 'M');

    } else {
      setDescription('');
      setAmount('');
      setLocation('');
      setType('H');
      setDebtor('none');
    }
  }, [transaction]);

  const handleAmountKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const allowedKeys = [
      'Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 
      'ArrowUp', 'ArrowDown', 'Home', 'End'
    ];
    
    const isNumber = /^[0-9]$/.test(e.key);
    const isCommaOrDot = e.key === ',' || e.key === '.';
    const isAllowedKey = allowedKeys.includes(e.key);
    const isCtrlKey = e.ctrlKey && ['a', 'c', 'v', 'x'].includes(e.key);
    
    if (!isNumber && !isCommaOrDot && !isAllowedKey && !isCtrlKey) {
      e.preventDefault();
    }
  };

  const formatAmount = (value: string): string => {
    const cleanValue = value.replace(/\./g, '');
    const parts = cleanValue.split(',');
    const integerPart = parts[0];
    const decimalPart = parts[1];

    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    
    if (decimalPart !== undefined) {
      const limitedDecimal = decimalPart.slice(0, 2);
      return `${formattedInteger},${limitedDecimal}`;
    }
    
    return formattedInteger;
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const formattedValue = formatAmount(newValue);
    setAmount(formattedValue);
  };

  const handleSave = () => {
    if (!transaction || !description.trim() || !amount.trim() || !location.trim()) {
      return;
    }

    const numericAmount = parseFloat(amount.replace(/\./g, '').replace(',', '.'));
    
    onSave(transaction.id, {
      description,
      amount: numericAmount,
      location,
      type,
      debtor
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSave();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl border border-slate-600/30 p-6 sm:p-8 w-full max-w-md shadow-2xl transform transition-all">
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-6 text-center">
          H+M Ausgabe bearbeiten
        </h2>
        
        <div className="space-y-4 sm:space-y-6">
          {/* H/M Toggle */}
          <div className={`${debtor !== 'none' ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Wer hat bezahlt?
            </label>
            <div className="grid grid-cols-2 gap-2 bg-slate-700/50 rounded-lg p-1">
              <button
                type="button"
                onClick={() => debtor === 'none' && setType('H')}
                disabled={debtor !== 'none'}
                className={`py-2 px-4 rounded-md text-sm font-medium transition-all ${
                  type === 'H' && debtor === 'none'
                    ? 'bg-gradient-to-r from-orange-600 to-orange-500 text-white shadow-lg'
                    : 'text-slate-400 hover:text-orange-300'
                } ${debtor !== 'none' ? 'cursor-not-allowed' : ''}`}
              >
                H
              </button>
              <button
                type="button"
                onClick={() => debtor === 'none' && setType('M')}
                disabled={debtor !== 'none'}
                className={`py-2 px-4 rounded-md text-sm font-medium transition-all ${
                  type === 'M' && debtor === 'none'
                    ? 'bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg'
                    : 'text-slate-400 hover:text-red-300'
                } ${debtor !== 'none' ? 'cursor-not-allowed' : ''}`}
              >
                M
              </button>
            </div>
            {debtor !== 'none' && <p className="text-xs text-slate-500 mt-1">Wird durch "Wer schuldet wem?" bestimmt.</p>}
          </div>

          {/* Debtor Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Wer schuldet wem?
            </label>
            <div className="grid grid-cols-3 gap-2 bg-slate-700/50 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setDebtor('H')}
                className={`py-2 px-4 rounded-md text-sm font-medium transition-all ${
                  debtor === 'H'
                    ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg'
                    : 'text-slate-400 hover:text-blue-300'
                }`}
              >
                H schuldet M
              </button>
              <button
                type="button"
                onClick={() => setDebtor('M')}
                className={`py-2 px-4 rounded-md text-sm font-medium transition-all ${
                  debtor === 'M'
                    ? 'bg-gradient-to-r from-purple-600 to-purple-500 text-white shadow-lg'
                    : 'text-slate-400 hover:text-purple-300'
                }`}
              >
                M schuldet H
              </button>
              <button
                type="button"
                onClick={() => setDebtor('none')}
                className={`py-2 px-4 rounded-md text-sm font-medium transition-all ${
                  debtor === 'none'
                    ? 'bg-slate-600 text-white shadow-lg'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                Keine Schulden
              </button>
            </div>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="edit-description" className="block text-sm font-medium text-slate-300 mb-2">
              Beschreibung
            </label>
            <input
              id="edit-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={handleKeyPress}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/30 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all text-base"
              placeholder="z.B. Lebensmittel"
              maxLength={100}
            />
          </div>

          {/* Amount */}
          <div>
            <label htmlFor="edit-amount" className="block text-sm font-medium text-slate-300 mb-2">
              Betrag
            </label>
            <div className="relative">
              <input
                id="edit-amount"
                type="text"
                value={amount}
                onChange={handleAmountChange}
                onKeyDown={handleAmountKeyDown}
                className="w-full px-4 py-3 pr-12 bg-slate-700/50 border border-slate-600/30 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all text-base text-right"
                placeholder="0,00"
              />
              <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 text-base">
                €
              </span>
            </div>
          </div>

          {/* Location */}
          <div>
            <label htmlFor="edit-location" className="block text-sm font-medium text-slate-300 mb-2">
              Ort
            </label>
            <input
              id="edit-location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              onKeyDown={handleKeyPress}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/30 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all text-base"
              placeholder="z.B. Supermarkt"
              maxLength={50}
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 mt-6 sm:mt-8">
          <button
            onClick={onCancel}
            className="flex-1 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors text-base"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            disabled={!description.trim() || !amount.trim() || !location.trim()}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all text-base focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-slate-800"
          >
            Speichern
          </button>
        </div>

        <div className="mt-4 text-xs text-slate-500 text-center">
          Strg+Enter zum Speichern • Esc zum Abbrechen
        </div>
      </div>
    </div>
  );
};
