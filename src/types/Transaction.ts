export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  category: string;
  date: string;
  timestamp: number;
}

export interface TransactionFormData {
  type: 'income' | 'expense';
  amount: string;
  description: string;
  category: string;
}
