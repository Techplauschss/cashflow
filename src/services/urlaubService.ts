import { ref, push, onValue, off, remove, update } from 'firebase/database';
import { database } from '../firebase';
import type { Urlaub, UrlaubCategory, UrlaubExpense } from '../types/Urlaub';

type UrlaubRecord = Omit<Urlaub, 'id'>;

const mapUrlaube = (data: Record<string, UrlaubRecord>): Urlaub[] =>
  Object.entries(data).map(([id, urlaub]) => ({
    id,
    ...urlaub,
    expenses: urlaub.expenses
      ? Object.entries(urlaub.expenses as unknown as Record<string, Omit<UrlaubExpense, 'id'>>).map(([expenseId, expense]) => ({
          id: expenseId,
          ...expense,
        }))
      : [],
  }));

export const subscribeToUrlaube = (callback: (urlaube: Urlaub[]) => void): (() => void) => {
  const urlaubeRef = ref(database, 'urlaube');
  const unsubscribe = onValue(urlaubeRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      const urlaube = mapUrlaube(data as Record<string, UrlaubRecord>);
      callback(urlaube.sort((a, b) => b.timestamp - a.timestamp));
    } else {
      callback([]);
    }
  });
  return () => off(urlaubeRef, 'value', unsubscribe);
};

export const addUrlaub = async (name: string, startDate: string, endDate: string): Promise<string> => {
  const urlaubeRef = ref(database, 'urlaube');
  try {
    const newRef = await push(urlaubeRef, {
      name,
      startDate,
      endDate,
      timestamp: Date.now(),
    });
    return newRef.key!;
  } catch (error) {
    console.error('Error adding Urlaub:', error);
    throw new Error('Fehler beim Anlegen des Urlaubs');
  }
};

export const updateUrlaub = async (id: string, name: string, startDate: string, endDate: string): Promise<void> => {
  const urlaubRef = ref(database, `urlaube/${id}`);
  try {
    await update(urlaubRef, { name, startDate, endDate });
  } catch (error) {
    console.error('Error updating Urlaub:', error);
    throw new Error('Fehler beim Aktualisieren des Urlaubs');
  }
};

export const deleteUrlaub = async (id: string): Promise<void> => {
  const urlaubRef = ref(database, `urlaube/${id}`);
  try {
    await remove(urlaubRef);
  } catch (error) {
    console.error('Error deleting Urlaub:', error);
    throw new Error('Fehler beim Löschen des Urlaubs');
  }
};

export const addUrlaubExpense = async (
  urlaubId: string,
  category: UrlaubCategory,
  amount: number,
  description: string
): Promise<string> => {
  const expensesRef = ref(database, `urlaube/${urlaubId}/expenses`);
  try {
    const newRef = await push(expensesRef, {
      category,
      amount,
      description,
      timestamp: Date.now(),
    });
    return newRef.key!;
  } catch (error) {
    console.error('Error adding Urlaub expense:', error);
    throw new Error('Fehler beim Hinzufügen der Ausgabe');
  }
};

export const deleteUrlaubExpense = async (urlaubId: string, expenseId: string): Promise<void> => {
  const expenseRef = ref(database, `urlaube/${urlaubId}/expenses/${expenseId}`);
  try {
    await remove(expenseRef);
  } catch (error) {
    console.error('Error deleting Urlaub expense:', error);
    throw new Error('Fehler beim Löschen der Ausgabe');
  }
};
