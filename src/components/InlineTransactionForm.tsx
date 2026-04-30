import React, { useState, useEffect } from 'react';
import { addTransaction, getExchangesWithShortcuts } from '../services/transactionService';
import type { Transaction } from '../types/Transaction';

interface InlineTransactionFormProps {
  prefilledData?: Partial<Transaction>;
  onSaved?: () => void | Promise<void>;
}

export const InlineTransactionForm: React.FC<InlineTransactionFormProps> = ({ prefilledData = {}, onSaved }) => {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [location, setLocation] = useState('');
  const [type, setType] = useState<'E' | 'A'>('A'); // E = Einnahme, A = Ausgabe
  const [isBusiness, setIsBusiness] = useState(false);
  const [assetType, setAssetType] = useState<string>('TR');
  const [availableShortcuts, setAvailableShortcuts] = useState<Array<{shortcut: string; name: string}>>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadShortcuts = async () => {
      try {
        const shortcuts = await getExchangesWithShortcuts();
        setAvailableShortcuts(shortcuts);
      } catch (error) {
        console.error('Error loading shortcuts:', error);
      }
    };
    loadShortcuts();
  }, []);

  // Automatisch Asset-Type auf 'V' setzen wenn Business-Transaktion
  useEffect(() => {
    if (isBusiness && assetType !== 'V') {
      setAssetType('V');
    } else if (!isBusiness && assetType === 'V' && availableShortcuts.length > 0) {
      // Nur zurücksetzen wenn Shortcuts verfügbar sind
      setAssetType(availableShortcuts[0].shortcut);
    } else if (!isBusiness && assetType === 'V' && availableShortcuts.length === 0) {
      // Fallback auf TR wenn keine Shortcuts verfügbar
      setAssetType('TR');
    }
  }, [isBusiness, assetType, availableShortcuts]);

  const getNextAssetType = () => {
    if (availableShortcuts.length === 0) {
      // Fallback auf feste Werte wenn keine Shortcuts definiert
      return assetType === 'TR' ? 'SP' : assetType === 'SP' ? 'B' : assetType === 'B' ? 'V' : 'TR';
    }
    
    const currentIndex = availableShortcuts.findIndex(s => s.shortcut === assetType);
    if (currentIndex === -1) return availableShortcuts[0].shortcut;
    
    const nextIndex = (currentIndex + 1) % availableShortcuts.length;
    return availableShortcuts[nextIndex].shortcut;
  };

  const getCurrentShortcutName = () => {
    if (availableShortcuts.length === 0) {
      // Fallback auf feste Namen
      const names: Record<string, string> = {
        'TR': 'Trade Republic',
        'SP': 'Sparkasse', 
        'B': 'Bar',
        'V': 'Vivid'
      };
      return names[assetType] || assetType;
    }
    
    const shortcut = availableShortcuts.find(s => s.shortcut === assetType);
    return shortcut ? shortcut.name : assetType;
  };

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

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    
    // Erlaube nur Zahlen, Komma und Punkt
    value = value.replace(/[^\d,\.]/g, '');
    
    // Ersetze Punkte durch Kommas (für Dezimaltrennzeichen)
    value = value.replace(/\./g, ',');
    
    // Erlaube nur ein Komma
    const commaCount = (value.match(/,/g) || []).length;
    if (commaCount > 1) {
      const firstCommaIndex = value.indexOf(',');
      value = value.substring(0, firstCommaIndex + 1) + value.substring(firstCommaIndex + 1).replace(/,/g, '');
    }
    
    // Begrenze Dezimalstellen auf 2
    const parts = value.split(',');
    if (parts[1] && parts[1].length > 2) {
      value = parts[0] + ',' + parts[1].substring(0, 2);
    }
    
    setAmount(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!description.trim() || !amount.trim()) {
      alert('Bitte füllen Sie alle erforderlichen Felder aus.');
      return;
    }

    setIsLoading(true);
    try {
      await addTransaction({
        type: type === 'E' ? 'income' : 'expense',
        amount: amount,
        description: description.trim(),
        location: location.trim() || 'Unbekannt',
        isBusiness: isBusiness,
        sourceExchangeType: assetType,
      });

      // reset
      setDescription('');
      setAmount('');
      setLocation('');
      setType('A');
      setIsBusiness(prefilledData.isBusiness || false);
      // Asset-Type wird automatisch durch useEffect zurückgesetzt basierend auf isBusiness

      if (onSaved) await onSaved();
    } catch (error) {
      console.error('Error adding transaction:', error);
      alert('Fehler beim Hinzufügen der Transaktion. Bitte versuchen Sie es erneut.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white/5 backdrop-blur-lg rounded-xl sm:rounded-2xl border border-white/10 p-3 sm:p-6 shadow-2xl">
      <form className="space-y-3 sm:space-y-6" onSubmit={handleSubmit}>
        <div className="block sm:hidden space-y-3">
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-slate-400">€</span>
            <input
              type="text"
              id="amount"
              value={amount}
              onChange={handleAmountChange}
              onKeyDown={handleAmountKeyDown}
              className="w-full pl-8 pr-4 py-2.5 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-base"
              placeholder="0,00"
            />
          </div>

          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-base"
            placeholder="Titel"
          />

          <div className="grid grid-cols-5 gap-2">
            <div className="col-span-2">
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-base"
                placeholder="Ort"
              />
            </div>
            <div className="col-span-1 flex flex-col items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setIsBusiness(!isBusiness)}
                className={`w-8 h-8 rounded-lg font-bold text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isBusiness ? 'bg-blue-600 text-white' : 'bg-slate-600 text-slate-300'
                }`}
                title={isBusiness ? 'Geschäftstransaktion' : 'Private Transaktion'}
              >
                B
              </button>
              <button
                type="button"
                onClick={() => setAssetType(getNextAssetType())}
                className="w-10 h-8 rounded-lg text-xs font-semibold text-slate-200 bg-slate-700 hover:bg-slate-600 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
                title={`Asset wählen: ${getCurrentShortcutName()}`}
              >
                {assetType}
              </button>
            </div>
            <div className="col-span-2 flex items-center justify-center">
              <button
                type="button"
                onClick={() => setType(type === 'E' ? 'A' : 'E')}
                className={`relative inline-flex h-9 w-16 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  type === 'E' ? 'bg-green-600' : 'bg-red-600'
                }`}
              >
                <span
                  className={`inline-block h-7 w-7 transform rounded-full bg-white transition-transform duration-200 ${
                    type === 'E' ? 'translate-x-1' : 'translate-x-8'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        <div className="hidden sm:block">
          <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
            <div className="md:col-span-1">
              <div className="relative">
                <span className="absolute left-3 top-3 text-slate-400">€</span>
                <input
                  type="text"
                  id="amount-desktop"
                  value={amount}
                  onChange={handleAmountChange}
                  onKeyDown={handleAmountKeyDown}
                  className="w-full pl-8 pr-4 py-3 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="0,00"
                />
              </div>
            </div>

            <div className="md:col-span-3">
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="Titel"
              />
            </div>

            <div className="md:col-span-1">
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="Ort"
              />
            </div>

            <div className="md:col-span-1 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setIsBusiness(!isBusiness)}
                className={`w-12 h-12 rounded-3xl font-bold text-lg transition-all duration-200 ${
                  isBusiness ? 'bg-blue-700 text-white shadow-xl' : 'bg-slate-800 text-white hover:bg-slate-200 hover:text-black'
                }`}
                title={isBusiness ? 'Geschäftstransaktion' : 'Private Transaktion'}
              >
                B
              </button>
              <button
                type="button"
                onClick={() => setAssetType(getNextAssetType())}
                className="w-14 h-9 rounded-full text-sm font-semibold text-slate-200 bg-slate-700 hover:bg-slate-600 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
                title={`Asset wählen: ${getCurrentShortcutName()}`}
              >
                {assetType}
              </button>
            </div>

            <div className="md:col-span-1 flex items-center justify-center">
              <div className="flex items-center justify-center space-x-3 h-14">
                <span className={`text-lg font-medium ${type === 'E' ? 'text-green-600' : 'text-slate-400'}`}>E</span>
                <button
                  type="button"
                  onClick={() => setType(type === 'E' ? 'A' : 'E')}
                  className={`relative inline-flex h-6 w-20 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                    type === 'E' ? 'bg-green-600' : 'bg-red-600'
                  }`}
                >
                  <span className={`inline-block h-8 w-8 transform rounded-full bg-white transition-transform duration-200 ${type === 'E' ? 'translate-x' : 'translate-x-12'}`} />
                </button>
                <span className={`text-lg font-medium ${type === 'A' ? 'text-red-400' : 'text-slate-400'}`}>A</span>
              </div>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold py-2.5 sm:py-4 px-6 rounded-lg transition-all duration-200 transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 text-base sm:text-base"
        >
          {isLoading ? 'Wird hinzugefügt...' : 'Transaktion hinzufügen'}
        </button>
      </form>
    </div>
  );
};

export default InlineTransactionForm;
