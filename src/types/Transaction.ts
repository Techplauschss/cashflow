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
  sourceExchangeType?: string; // Optional: Asset-Auswahl (Shortcut oder fester Typ)
  isOneTimeInvestment?: boolean; // Optional: für Einmal-Investitionen
  kilometerstand?: number;
  liter?: number;
  vehicle?: 'Auto' | 'Moped' | 'Skoda' | 'Sonstige'; // Optional: Fahrzeugtyp für Tanken
}
