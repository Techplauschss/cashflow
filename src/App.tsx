import './styles.css';
import { useState, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { LazyTransactionList, type LazyTransactionListRef } from './components/LazyTransactionList';
import { TankenPage } from './components/TankenPage';
import { BilanzPage } from './components/BilanzPage';
import { addTransaction } from './services/transactionService';

function HomePage() {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [location, setLocation] = useState('');
  const [type, setType] = useState<'E' | 'A'>('A'); // E = Einnahme, A = Ausgabe
  const [isLoading, setIsLoading] = useState(false);
  const transactionListRef = useRef<LazyTransactionListRef>(null);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validierung
    if (!description.trim() || !amount.trim()) {
      alert('Bitte füllen Sie alle Pflichtfelder aus.');
      return;
    }

    setIsLoading(true);
    
    try {
      await addTransaction({
        type: type === 'E' ? 'income' : 'expense',
        amount: amount,
        description: description.trim(),
        location: location.trim() || 'Unbekannt',
      });

      // Formular zurücksetzen
      setDescription('');
      setAmount('');
      setLocation('');
      setType('A');
      
      // Aktualisiere die Transaktionsliste
      if (transactionListRef.current) {
        transactionListRef.current.refreshData();
      }
      
    } catch (error) {
      console.error('Error adding transaction:', error);
      alert('Fehler beim Hinzufügen der Transaktion. Bitte versuchen Sie es erneut.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center px-3 sm:px-4 pb-4 sm:pb-8">
      <div className="w-full max-w-4xl">
        {/* Input Form - Mobile optimiert */}
        <div className="bg-white/5 backdrop-blur-lg rounded-xl sm:rounded-2xl border border-white/10 p-3 sm:p-8 shadow-2xl">
          <form className="space-y-3 sm:space-y-6" onSubmit={handleSubmit}>
            {/* Mobile Layout - Stacked - Kompakter */}
            <div className="block sm:hidden space-y-3">
              {/* Amount Input - Mobile */}
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

              {/* Description Input - Mobile */}
              <input
                type="text"
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-base"
                placeholder="Titel"
              />

              {/* Location and Type Row - Mobile - Kompakter */}
              <div className="grid grid-cols-5 gap-2">
                <div className="col-span-3">
                  <input
                    type="text"
                    id="location-mobile"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-base"
                    placeholder="Ort"
                  />
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

            {/* Desktop Layout - Grid */}
            <div className="hidden sm:block">
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                {/* Amount Input */}
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

                {/* Description Input */}
                <div className="md:col-span-3">
                  <input
                    type="text"
                    id="description-desktop"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Titel"
                  />
                </div>

                {/* Location Input */}
                <div className="md:col-span-1">
                  <input
                    type="text"
                    id="location-desktop"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Ort"
                  />
                </div>

                {/* Type Switch */}
                <div className="md:col-span-1 flex items-center justify-center">
                  <div className="flex items-center justify-center space-x-3 h-12">
                    <span className={`text-sm font-medium ${type === 'E' ? 'text-green-400' : 'text-slate-400'}`}>
                      E
                    </span>
                    <button
                      type="button"
                      onClick={() => setType(type === 'E' ? 'A' : 'E')}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                        type === 'E' ? 'bg-green-600' : 'bg-red-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                          type === 'E' ? 'translate-x-1' : 'translate-x-6'
                        }`}
                      />
                    </button>
                    <span className={`text-sm font-medium ${type === 'A' ? 'text-red-400' : 'text-slate-400'}`}>
                      A
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Button - Mobile optimiert */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold py-2.5 sm:py-4 px-6 rounded-lg transition-all duration-200 transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 text-base sm:text-base"
            >
              {isLoading ? 'Wird hinzugefügt...' : 'Transaktion hinzufügen'}
            </button>
          </form>
        </div>

        {/* Transaction List */}
        <LazyTransactionList ref={transactionListRef} />

        {/* Footer */}
        <div className="text-center mt-4 sm:mt-8">
          <p className="text-slate-500 text-xs sm:text-sm">
            © {new Date().getFullYear()} Cashflow Pro
          </p>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        {/* Global Header mit Navigation - Mobile Optimiert */}
        <div className="w-full max-w-4xl mx-auto px-3 sm:px-4 pt-4 sm:pt-8">
          <div className="text-center mb-6 sm:mb-12">
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold bg-gradient-to-r from-blue-400 via-purple-500 to-cyan-400 bg-clip-text text-transparent mb-2 sm:mb-4 tracking-tight">
              Cashflow
            </h1>
            <div className="w-16 sm:w-20 h-0.5 bg-gradient-to-r from-blue-400 to-cyan-400 mx-auto mb-4 sm:mb-6 opacity-60"></div>
            
            {/* Navigation - Mobile optimiert */}
            <div className="flex justify-center space-x-3 sm:space-x-6 mb-4 sm:mb-6">
              <Link 
                to="/" 
                className="text-slate-300 hover:text-white transition-colors px-3 sm:px-4 py-2 rounded-lg hover:bg-white/10 text-sm sm:text-base"
              >
                Übersicht
              </Link>
              <Link 
                to="/bilanzen" 
                className="text-slate-300 hover:text-white transition-colors px-3 sm:px-4 py-2 rounded-lg hover:bg-white/10 text-sm sm:text-base"
              >
                Bilanzen
              </Link>
              <Link 
                to="/tanken" 
                className="text-slate-300 hover:text-white transition-colors px-3 sm:px-4 py-2 rounded-lg hover:bg-white/10 text-sm sm:text-base"
              >
                Tankübersicht
              </Link>
            </div>
            
            <p className="text-slate-400 text-base sm:text-lg font-light">
              Professionelle Finanzübersicht
            </p>
          </div>
        </div>
        
        {/* Page Content */}
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/bilanzen" element={<BilanzPage />} />
          <Route path="/tanken" element={<TankenPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
