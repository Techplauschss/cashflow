export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  location: string;
  date: string;
  timestamp: number;
}

export interface TransactionFormData {
  type: 'income' | 'expense';
  amount: string;
  description: string;
  location: string;
}
