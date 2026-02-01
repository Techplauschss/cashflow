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
  isPlanned?: boolean; // Optional: Markiert geplante Ausgaben für die Zukunft
  isBusiness?: boolean; // Optional: Markiert Geschäftstransaktionen
  addedToMain?: boolean; // Optional: Markiert ob H+M Transaktion bereits zu Main hinzugefügt wurde
}

export interface TransactionFormData {
  type: 'income' | 'expense';
  amount: string;
  description: string;
  location: string;
  date?: string; // Optional: für geplante Ausgaben
  isPlanned?: boolean; // Optional: für geplante Ausgaben
  isBusiness?: boolean; // Optional: für Geschäftstransaktionen
}
