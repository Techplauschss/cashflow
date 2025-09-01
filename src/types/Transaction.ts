export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  location: string;
  date: string;
  timestamp: number;
  kilometerstand?: number; // Optional: Kilometerstand für Tanken/Sprit-Transaktionen
  liter?: number; // Optional: Liter für Tanken/Sprit-Transaktionen
}

export interface TransactionFormData {
  type: 'income' | 'expense';
  amount: string;
  description: string;
  location: string;
}
