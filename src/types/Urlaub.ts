export type UrlaubCategory = 'essen' | 'mobilitaet' | 'unterkuenfte' | 'einkaeufe' | 'eintritt';

export const URLAUB_CATEGORIES: { key: UrlaubCategory; label: string }[] = [
  { key: 'essen', label: 'Essen/Trinken' },
  { key: 'mobilitaet', label: 'Mobilität' },
  { key: 'unterkuenfte', label: 'Unterkünfte' },
  { key: 'einkaeufe', label: 'Einkäufe' },
  { key: 'eintritt', label: 'Eintritt' },
];

export interface UrlaubExpense {
  id: string;
  category: UrlaubCategory;
  amount: number;
  description: string;
  timestamp: number;
}

export interface Urlaub {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  timestamp: number;
  expenses?: UrlaubExpense[];
}
