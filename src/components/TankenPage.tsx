import React, { useState, useEffect } from 'react';
import type { Transaction } from '../types/Transaction';
import { getAllTransactions, updateKilometerstand, updateLiter, updateVehicle } from '../services/transactionService';

export const TankenPage = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const isTankenTransaction = (description: string, type: string): boolean => {
    if (type !== 'expense') return false;
    const lowerDescription = description.toLowerCase();
    return lowerDescription.includes('tanken') || lowerDescription.includes('tanke') || (lowerDescription.includes('sprit') && !lowerDescription.includes('sprite'));
  };

  const loadTransactions = async () => {
    try {
      setIsLoading(true);
      const allTrans = await getAllTransactions();
      // Filtern und dann explizit nach Datum (neuestes zuerst) und dann nach Timestamp sortieren,
      // um eine korrekte chronologische Reihenfolge sicherzustellen, auch bei nachträglich erfassten Einträgen.
      const tankenTrans = allTrans
        .filter(t => isTankenTransaction(t.description, t.type))
        .sort((a, b) => {
          // Zuerst nach Datum sortieren (neuestes zuerst)
          const dateComparison = new Date(b.date).getTime() - new Date(a.date).getTime();
          if (dateComparison !== 0) return dateComparison;
          // Bei gleichem Datum nach Timestamp sortieren (neuestes zuerst)
          return b.timestamp - a.timestamp;
        });
      setTransactions(tankenTrans);
    } catch (error) {
      console.error('Error loading tanken transactions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, []);

  const formatAmount = (amount: number): string => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const KilometerstandInput = ({ transaction }: { transaction: Transaction }) => {
    const [km, setKm] = useState(transaction.kilometerstand ? transaction.kilometerstand.toLocaleString('de-DE') : '');
    const [isSaving, setIsSaving] = useState(false);
    const isMoped = transaction.vehicle === 'Moped';

    useEffect(() => {
      setKm(transaction.kilometerstand ? transaction.kilometerstand.toLocaleString('de-DE') : '');
    }, [transaction.kilometerstand]);

    const handleKmUpdate = async () => {
      const kmValue = parseInt(km.replace(/\./g, ''), 10);
      if (isNaN(kmValue) || kmValue === transaction.kilometerstand) {
        if (isNaN(kmValue) && km !== '') {
            setKm(transaction.kilometerstand ? transaction.kilometerstand.toLocaleString('de-DE') : '');
        }
        return;
      }
      setIsSaving(true);
      try {
        await updateKilometerstand(transaction.id, kmValue);
      } catch (error) {
        console.error("Failed to update km", error);
        setKm(transaction.kilometerstand ? transaction.kilometerstand.toLocaleString('de-DE') : '');
      } finally {
        setIsSaving(false);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleKmUpdate();
        e.currentTarget.blur();
      }
    };

    return (
      <div className="relative flex items-center ml-2 group/km">
        <div className="relative flex items-center">
          <input 
            type="text"
            placeholder="km-Stand"
            value={km}
            onChange={(e) => setKm(e.target.value)}
            onBlur={handleKmUpdate}
            onKeyDown={handleKeyDown}
            className={`w-20 sm:w-24 pl-2.5 pr-6 py-1 bg-slate-900/40 border border-slate-700 hover:border-slate-500 hover:bg-slate-800/60 rounded-md text-xs font-medium text-slate-300 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:bg-slate-900 transition-all ${isSaving || isMoped ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={isSaving || isMoped}
            title={isMoped ? 'KM-Stand für Moped deaktiviert' : ''}
          />
          <div className="absolute right-2 text-[10px] font-bold text-slate-500 pointer-events-none transition-colors group-focus-within/km:text-blue-400">km</div>
        </div>
        {isSaving && <div className="absolute -right-5 top-1/2 -translate-y-1/2"><div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-400"></div></div>}
      </div>
    );
  };

  const LiterInput = ({ transaction }: { transaction: Transaction }) => {
    const [liter, setLiter] = useState(transaction.liter ? transaction.liter.toString().replace('.', ',') : '');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
      setLiter(transaction.liter ? transaction.liter.toString().replace('.', ',') : '');
    }, [transaction.liter]);

    const handleLiterUpdate = async () => {
      const cleanValue = liter.replace(/[^\d.,]/g, '').replace(',', '.');
      const literValue = parseFloat(cleanValue);
      if (isNaN(literValue) || literValue === transaction.liter) {
        if (isNaN(literValue) && liter !== '') {
            setLiter(transaction.liter ? transaction.liter.toString().replace('.', ',') : '');
        }
        return;
      }
      setIsSaving(true);
      try {
        await updateLiter(transaction.id, literValue);
      } catch (error) {
        console.error("Failed to update liter", error);
        setLiter(transaction.liter ? transaction.liter.toString().replace('.', ',') : '');
      } finally {
        setIsSaving(false);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleLiterUpdate();
        e.currentTarget.blur();
      }
    };

    return (
      <div className="relative flex items-center ml-2 group/liter">
        <div className="relative flex items-center">
          <input 
            type="text"
            placeholder="Liter"
            value={liter}
            onChange={(e) => setLiter(e.target.value)}
            onBlur={handleLiterUpdate}
            onKeyDown={handleKeyDown}
            className={`w-16 sm:w-20 pl-2.5 pr-6 py-1 bg-slate-900/40 border border-slate-700 hover:border-slate-500 hover:bg-slate-800/60 rounded-md text-xs font-medium text-slate-300 placeholder-slate-600 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:bg-slate-900 transition-all ${isSaving ? 'opacity-50' : ''}`}
            disabled={isSaving}
          />
          <div className="absolute right-2 text-[10px] font-bold text-slate-500 pointer-events-none transition-colors group-focus-within/liter:text-green-400">L</div>
        </div>
        {isSaving && <div className="absolute -right-5 top-1/2 -translate-y-1/2"><div className="animate-spin rounded-full h-3 w-3 border-b-2 border-green-400"></div></div>}
      </div>
    );
  };

  const VehicleSelector = ({ transaction }: { transaction: Transaction }) => {
    const [vehicle, setVehicle] = useState<'Auto' | 'Moped' | 'Skoda' | 'Sonstige'>(transaction.vehicle || 'Auto');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
      setVehicle(transaction.vehicle || 'Auto');
    }, [transaction.vehicle]);

    const handleSelect = async (selected: 'Auto' | 'Moped' | 'Skoda' | 'Sonstige') => {
      if (selected === vehicle) return;
      setIsSaving(true);
      setVehicle(selected); // Optimistisches Update für sofortiges Feedback
      setTransactions(prev => prev.map(t => t.id === transaction.id ? { ...t, vehicle: selected } : t));
      try {
        await updateVehicle(transaction.id, selected);
      } catch (error) {
        console.error("Failed to update vehicle", error);
        setVehicle(transaction.vehicle || 'Auto'); // Bei Fehler zurücksetzen
        setTransactions(prev => prev.map(t => t.id === transaction.id ? { ...t, vehicle: transaction.vehicle } : t));
      } finally {
        setIsSaving(false);
      }
    };

    return (
      <div className="flex bg-slate-900/40 border border-slate-700 rounded-md overflow-hidden ml-2 h-[26px]">
        {(['Auto', 'Moped', 'Skoda', 'Sonstige'] as const).map(v => (
          <button
            key={v}
            disabled={isSaving}
            onClick={() => handleSelect(v)}
            className={`px-2.5 text-xs font-medium transition-colors border-r border-slate-700 last:border-r-0 ${
              vehicle === v ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {v}
          </button>
        ))}
      </div>
    );
  };

  const exportToCsv = () => {
    const csvContent = [
      ['Datum', 'Beschreibung', 'Ort', 'Betrag', 'Kilometerstand', 'Liter', 'Fahrzeug'].join(';'),
      ...transactions.map(t => [
        new Date(t.date).toLocaleDateString('de-DE'),
        `"${t.description.replace(/"/g, '""')}"`,
        `"${(t.location || '').replace(/"/g, '""')}"`,
        Math.abs(t.amount).toString().replace('.', ','),
        t.kilometerstand ? t.kilometerstand.toString() : '',
        t.liter ? t.liter.toString().replace('.', ',') : '',
        t.vehicle || ''
      ].join(';'))
    ].join('\n');

    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([`\ufeff${csvContent}`], { type: 'text/csv;charset=utf-8;' })); // BOM für Excel UTF-8
    link.download = `Tankhistorie_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center px-4 pb-8">
        <div className="w-full max-w-4xl">
          <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 p-8 shadow-2xl mt-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-white mb-4">Tanken Historie</h2>
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center px-3 sm:px-4 pb-4 sm:pb-8">
      <div className="w-full max-w-4xl">
        <div className="bg-white/5 backdrop-blur-lg rounded-xl sm:rounded-2xl border border-white/10 p-4 sm:p-8 shadow-2xl mt-4 sm:mt-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 gap-4">
            <h2 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2">
              <span className="text-3xl">⛽</span> Tanken Historie
            </h2>
            <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6 w-full sm:w-auto">
              <button
                onClick={exportToCsv}
                className="inline-flex items-center justify-center px-4 py-2 bg-slate-700/50 hover:bg-slate-600/50 border border-slate-600/50 text-white text-sm font-medium rounded-lg transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                CSV Export
              </button>
              <div className="text-right">
                <div className="text-xs sm:text-sm text-slate-400">Tankvorgänge</div>
                <div className="text-xl sm:text-2xl font-bold text-blue-400">
                  {transactions.length}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {transactions.length === 0 ? (
              <div className="text-center py-8 text-slate-400">Keine Tankvorgänge gefunden.</div>
            ) : (
              transactions.map(transaction => (
                <div
                  key={transaction.id}
                  className="group bg-blue-900/20 border border-blue-800/30 rounded-lg p-3 sm:p-4 hover:bg-blue-900/40 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h5 className="text-white font-medium text-sm">
                        <span className="inline group-hover:hidden">
                          {transaction.description.length > 6 ? transaction.description.substring(0, 6) : transaction.description}
                        </span>
                        <span className="hidden group-hover:inline">
                          {transaction.description}
                        </span>
                        </h5>
                        <KilometerstandInput transaction={transaction} />
                        <LiterInput transaction={transaction} />
                        <VehicleSelector transaction={transaction} />
                      </div>
                      <div className="text-xs text-slate-400">
                        {transaction.location} • {new Date(transaction.date).toLocaleDateString('de-DE')}
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-lg font-semibold text-red-400">
                        -{formatAmount(Math.abs(transaction.amount))}
                      </div>
                      {transaction.liter && transaction.liter > 0 ? (
                        <div className="text-xs text-slate-400 mt-1">
                          {formatAmount(Math.abs(transaction.amount) / transaction.liter)}/L
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};