import React, { useState } from 'react';
import type { TransactionFormData } from '../types/Transaction';

interface TransactionFormProps {
  onSubmit: (transaction: TransactionFormData) => void;
}

const TransactionForm: React.FC<TransactionFormProps> = ({ onSubmit }) => {
  const [formData, setFormData] = useState<TransactionFormData>({
    type: 'expense',
    amount: '',
    description: '',
    category: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.amount && formData.description && formData.category) {
      onSubmit(formData);
      setFormData({
        type: 'expense',
        amount: '',
        description: '',
        category: ''
      });
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 bg-white/20 backdrop-blur-lg p-8 rounded-2xl shadow-2xl border border-white/10">
      <h2 className="text-2xl font-bold text-white mb-4 text-center bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
        Neue Transaktion hinzufügen
      </h2>
      
      <div className="flex flex-col gap-2">
        <label htmlFor="type" className="text-white font-medium">Typ:</label>
        <select
          id="type"
          name="type"
          value={formData.type}
          onChange={handleChange}
          required
          className="rounded-xl px-4 py-3 bg-gray-800/80 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
        >
          <option value="expense">💸 Ausgabe</option>
          <option value="income">💰 Einnahme</option>
        </select>
      </div>
      
      <div className="flex flex-col gap-2">
        <label htmlFor="amount" className="text-white font-medium">Betrag (€):</label>
        <input
          type="number"
          id="amount"
          name="amount"
          value={formData.amount}
          onChange={handleChange}
          min="0"
          step="0.01"
          required
          placeholder="0.00"
          className="rounded-xl px-4 py-3 bg-gray-800/80 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
        />
      </div>
      
      <div className="flex flex-col gap-2">
        <label htmlFor="description" className="text-white font-medium">Beschreibung:</label>
        <input
          type="text"
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          required
          placeholder="Was war das für eine Ausgabe/Einnahme?"
          className="rounded-xl px-4 py-3 bg-gray-800/80 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
        />
      </div>
      
      <div className="flex flex-col gap-2">
        <label htmlFor="category" className="text-white font-medium">Kategorie:</label>
        <input
          type="text"
          id="category"
          name="category"
          value={formData.category}
          onChange={handleChange}
          placeholder="z.B. Lebensmittel, Gehalt, Unterhaltung..."
          required
          className="rounded-xl px-4 py-3 bg-gray-800/80 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
        />
      </div>
      
      <button 
        type="submit" 
        className="mt-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-4 px-6 rounded-xl shadow-lg transform transition-all duration-200 hover:scale-105 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800"
      >
        ✨ Transaktion hinzufügen
      </button>
    </form>
  );
};

export default TransactionForm;
