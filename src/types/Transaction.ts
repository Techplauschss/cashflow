export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  location: string;
  date: string;
  timestamp: number;
  lastModified?: number;
  kilometerstand?: number; // Optional: Kilometerstand für Tanken/Sprit-Transaktionen
  liter?: number; // Optional: Liter für Tanken/Sprit-Transaktionen
  isPlanned?: boolean; // Optional: Markiert geplante Ausgaben für die Zukunft
  isBusiness?: boolean; // Optional: Markiert Geschäftstransaktionen
  affectsBalance?: boolean; // Optional: Gibt an, ob die Transaktion Vermögenskonten verändert
  addedToMain?: boolean; // Optional: Markiert ob H+M Transaktion bereits zu Main hinzugefügt wurde
  sourceExchangeId?: string; // Optional: Verknüpft Ausgaben mit dem standardmäßigen Asset-Konto
  isOneTimeInvestment?: boolean; // Optional: Markiert Einmal-Investitionen
  vehicle?: 'Auto' | 'Moped' | 'Skoda' | 'Sonstige'; // Optional: Fahrzeugtyp für Tanken
}

export interface TransactionFormData {
  type: 'income' | 'expense';
  amount: string;
  description: string;
  location: string;
  date?: string; // Optional: für geplante Ausgaben
  isPlanned?: boolean; // Optional: für geplante Ausgaben
  isBusiness?: boolean; // Optional: für Geschäftstransaktionen
  affectsBalance?: boolean; // Optional: für interne Buchungen ohne Vermögenskonto-Auswirkung
  sourceExchangeType?: string; // Optional: Asset-Auswahl (Shortcut oder fester Typ)
  isOneTimeInvestment?: boolean; // Optional: für Einmal-Investitionen
  kilometerstand?: number;
  liter?: number;
  vehicle?: 'Auto' | 'Moped' | 'Skoda' | 'Sonstige'; // Optional: Fahrzeugtyp für Tanken
}

export type RecurrenceInterval = 'weekly' | 'monthly' | 'yearly';

export interface RecurringTransaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  location: string;
  interval: RecurrenceInterval;
  nextDueDate: string;
  startDate: string;
  timestamp: number;
  isBusiness?: boolean;
  sourceExchangeType?: string;
  affectsBalance?: boolean;
  isActive: boolean;
  lastBookedDate?: string;
}
