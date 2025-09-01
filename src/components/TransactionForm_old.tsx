import React, { useState } from 'react';
import type { TransactionFormData } from '../types/Transaction';
import './TransactionForm.css';

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
    <form onSubmit={handleSubmit} className="transaction-form">
      <h2>Neue Transaktion hinzufügen</h2>
      
      <div className="form-group">
        <label htmlFor="type">Typ:</label>
        <select
          id="type"
          name="type"
          value={formData.type}
          onChange={handleChange}
          required
        >
          <option value="expense">Ausgabe</option>
          <option value="income">Einnahme</option>
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="amount">Betrag (€):</label>
        <input
          type="number"
          id="amount"
          name="amount"
          return (
            <form onSubmit={handleSubmit} className="flex flex-col gap-6 bg-white/20 p-6 rounded-xl shadow-lg">
              <h2 className="text-2xl font-semibold text-white mb-2 text-center">Neue Transaktion hinzufügen</h2>
              <div className="flex flex-col gap-2">
                <label htmlFor="type" className="text-white">Typ:</label>
                <select
                  id="type"
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  required
                  className="rounded-lg px-3 py-2 bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="expense">Ausgabe</option>
                  <option value="income">Einnahme</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="amount" className="text-white">Betrag (€):</label>
                <input
                  type="number"
                  id="amount"
                  name="amount"
                  value={formData.amount}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  required
                  className="rounded-lg px-3 py-2 bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="description" className="text-white">Beschreibung:</label>
                <input
                  type="text"
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  required
                  className="rounded-lg px-3 py-2 bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="category" className="text-white">Kategorie:</label>
                <input
                  type="text"
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  placeholder="z.B. Lebensmittel, Gehalt, etc."
                  required
                  className="rounded-lg px-3 py-2 bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button type="submit" className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow transition">Transaktion hinzufügen</button>
            </form>
