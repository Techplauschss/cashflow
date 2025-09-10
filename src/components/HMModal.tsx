import { useState } from 'react';

interface HMModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    description: string;
    amount: number;
    location: string;
    type: 'H' | 'M';
  }) => void;
}

export const HMModal = ({ isOpen, onClose, onSave }: HMModalProps) => {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [location, setLocation] = useState('');
  const [type, setType] = useState<'H' | 'M'>('H');
  const [isLoading, setIsLoading] = useState(false);

  const formatAmount = (value: string): string => {
    // Entferne alle Punkte (Tausendertrennzeichen) aber behalte Kommas (Dezimaltrennzeichen)
    const cleanValue = value.replace(/\./g, '');
    
    // Teile den Wert in Ganzzahl und Dezimalstellen
    const parts = cleanValue.split(',');
    const integerPart = parts[0];
    let decimalPart = parts[1];
    
    // Begrenze Dezimalstellen auf maximal 2 Zeichen
    if (decimalPart && decimalPart.length > 2) {
      decimalPart = decimalPart.substring(0, 2);
    }
    
    // Formatiere den Ganzzahlteil mit Tausendertrennzeichen
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    
    // Füge Dezimalstellen hinzu, falls vorhanden
    return decimalPart !== undefined ? `${formattedInteger},${decimalPart}` : formattedInteger;
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    const formattedValue = formatAmount(inputValue);
    setAmount(formattedValue);
  };

  const handleAmountKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Erlaubte Tasten: Zahlen (0-9), Komma, Punkt, Backspace, Delete, Tab, Enter, Pfeiltasten
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!description.trim() || !amount.trim()) {
      alert('Bitte füllen Sie alle Pflichtfelder aus.');
      return;
    }

    setIsLoading(true);
    
    try {
      // Konvertiere den Betrag zurück zu einer Zahl
      const numericAmount = parseFloat(amount.replace(/\./g, '').replace(',', '.'));
      
      await onSave({
        description: description.trim(),
        amount: numericAmount,
        location: location.trim() || 'Unbekannt',
        type
      });

      // Formular zurücksetzen
      setDescription('');
      setAmount('');
      setLocation('');
      setType('H');
      
      onClose();
    } catch (error) {
      console.error('Error saving H+M transaction:', error);
      alert('Fehler beim Speichern. Bitte versuchen Sie es erneut.');
    } finally {
      setIsLoading(false);
    }
  };

  // Keyboard event handler
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter' && e.ctrlKey) {
      handleSubmit(e as any);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4"
      onKeyDown={handleKeyDown}
    >
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl sm:rounded-2xl border border-slate-600/30 p-4 sm:p-6 w-full max-w-sm sm:max-w-lg shadow-2xl transform transition-all">
        <div className="flex justify-between items-center mb-4 sm:mb-6">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
              H+M Ausgabe
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1.5 sm:p-2 rounded-lg hover:bg-slate-700/50"
          >
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          {/* H/M Category Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2 sm:mb-3">
              Kategorie auswählen
            </label>
            <div className="grid grid-cols-2 gap-2 sm:gap-3 bg-slate-700/30 rounded-lg p-1.5 sm:p-2">
              <button
                type="button"
                onClick={() => setType('H')}
                className={`py-2.5 sm:py-3 px-3 sm:px-4 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center justify-center ${
                  type === 'H'
                    ? 'bg-gradient-to-r from-orange-600 to-orange-500 text-white shadow-lg transform scale-[1.02]'
                    : 'text-orange-300 hover:text-orange-200 hover:bg-orange-900/20'
                }`}
              >
                <span>H</span>
              </button>
              <button
                type="button"
                onClick={() => setType('M')}
                className={`py-2.5 sm:py-3 px-3 sm:px-4 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center justify-center ${
                  type === 'M'
                    ? 'bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg transform scale-[1.02]'
                    : 'text-red-300 hover:text-red-200 hover:bg-red-900/20'
                }`}
              >
                <span>M</span>
              </button>
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Betrag <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 text-slate-400 text-base sm:text-lg">€</span>
              <input
                type="text"
                value={amount}
                onChange={handleAmountChange}
                onKeyDown={handleAmountKeyDown}
                className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-3 sm:py-4 bg-slate-700/50 border border-slate-600/30 rounded-lg text-white text-base sm:text-lg placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                placeholder="0,00"
                required
                autoFocus
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">Komma als Dezimaltrennzeichen</p>
          </div>

          {/* Description Input */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Beschreibung <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 sm:px-4 py-3 sm:py-4 bg-slate-700/50 border border-slate-600/30 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all text-base"
              placeholder="z.B. Lebensmittel, Tanken..."
              required
              maxLength={100}
            />
          </div>

          {/* Location Input */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Ort
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-3 sm:px-4 py-3 sm:py-4 bg-slate-700/50 border border-slate-600/30 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all text-base"
              placeholder="z.B. Supermarkt, Tankstelle"
              maxLength={50}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 pt-2 sm:pt-4">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:flex-1 px-4 sm:px-6 py-3 sm:py-4 bg-slate-600 hover:bg-slate-500 text-white font-semibold rounded-lg transition-all duration-200 text-base"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={isLoading || !description.trim() || !amount.trim()}
              className="w-full sm:flex-1 px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all duration-200 transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-slate-900 text-base"
            >
              {isLoading ? (
                <span className="flex items-center justify-center space-x-2">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Speichert...</span>
                </span>
              ) : (
                <span className="flex items-center justify-center space-x-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Speichern</span>
                </span>
              )}
            </button>
          </div>
        </form>

        <div className="mt-3 sm:mt-4 text-xs text-slate-500 text-center">
          <span className="flex flex-col sm:flex-row items-center justify-center space-y-1 sm:space-y-0 sm:space-x-4">
            <span>Strg+Enter zum Speichern</span>
            <span className="hidden sm:inline">•</span>
            <span>Esc zum Abbrechen</span>
          </span>
        </div>
      </div>
    </div>
  );
};
