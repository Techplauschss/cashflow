import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { addUrlaub, updateUrlaub, deleteUrlaub, addUrlaubExpense, deleteUrlaubExpense } from '../services/urlaubService';
import { URLAUB_CATEGORIES, type Urlaub, type UrlaubCategory, type UrlaubExpense } from '../types/Urlaub';
import { DropdownMenu } from './DropdownMenu';

interface UrlaubeSectionProps {
  urlaube: Urlaub[];
  selectedYear: number;
}

const formatAmount = (amount: number): string =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);

const formatDate = (date: string): string => (date ? new Date(date).toLocaleDateString('de-DE') : '');

const CategoryExpenses: React.FC<{
  urlaubId: string;
  category: UrlaubCategory;
  label: string;
  expenses: UrlaubExpense[];
}> = ({ urlaubId, category, label, expenses }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = parseFloat(amount.replace(/\./g, '').replace(',', '.'));
    if (!description.trim() || isNaN(numericAmount) || numericAmount <= 0) {
      alert('Bitte Betrag und Beschreibung angeben.');
      return;
    }

    setIsSaving(true);
    try {
      await addUrlaubExpense(urlaubId, category, numericAmount, description.trim());
      setAmount('');
      setDescription('');
      setIsAdding(false);
    } catch (error) {
      console.error('Error adding Urlaub expense:', error);
      alert('Fehler beim Hinzufügen der Ausgabe.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (expenseId: string) => {
    try {
      await deleteUrlaubExpense(urlaubId, expenseId);
    } catch (error) {
      console.error('Error deleting Urlaub expense:', error);
      alert('Fehler beim Löschen der Ausgabe.');
    }
  };

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-900/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-300">{label}</span>
        <div className="flex items-center gap-2">
          {total > 0 && <span className="text-sm font-semibold text-amber-300">{formatAmount(total)}</span>}
          <button
            type="button"
            onClick={() => setIsAdding((v) => !v)}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-200 transition-colors hover:bg-amber-500/20"
            title={`Ausgabe zu ${label} hinzufügen`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      {expenses.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {expenses.map((expense) => (
            <div key={expense.id} className="group flex items-center justify-between gap-2 rounded-lg bg-slate-800/40 px-2.5 py-1.5 text-sm">
              <span className="min-w-0 truncate text-slate-300">{expense.description}</span>
              <div className="flex shrink-0 items-center gap-2">
                <span className="font-medium text-slate-200">{formatAmount(expense.amount)}</span>
                <button
                  type="button"
                  onClick={() => handleDelete(expense.id)}
                  className="text-slate-500 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                  title="Ausgabe löschen"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isAdding && (
        <form onSubmit={handleAdd} className="mt-2 flex items-center gap-2">
          <input
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0,00"
            inputMode="decimal"
            autoFocus
            className="w-20 rounded-lg border border-slate-700 bg-slate-950/70 px-2 py-1.5 text-sm text-white placeholder-slate-500 outline-none focus:border-amber-400"
          />
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Beschreibung"
            className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950/70 px-2 py-1.5 text-sm text-white placeholder-slate-500 outline-none focus:border-amber-400"
          />
          <button
            type="submit"
            disabled={isSaving}
            className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-amber-500 disabled:opacity-50"
          >
            {isSaving ? '...' : 'OK'}
          </button>
        </form>
      )}
    </div>
  );
};

const UrlaubCard: React.FC<{ urlaub: Urlaub; onEdit: (urlaub: Urlaub) => void }> = ({ urlaub, onEdit }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const expenses = urlaub.expenses || [];
  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  const handleDeleteUrlaub = async () => {
    if (!window.confirm(`Urlaub "${urlaub.name}" wirklich löschen? Alle Ausgaben gehen verloren.`)) return;
    try {
      await deleteUrlaub(urlaub.id);
    } catch (error) {
      console.error('Error deleting Urlaub:', error);
      alert('Fehler beim Löschen des Urlaubs.');
    }
  };

  return (
    <div>
      <div className="mb-2 flex items-center gap-2 rounded-xl border border-transparent px-1 py-2 transition-colors hover:border-slate-500/30 hover:bg-white/5">
        <button
          type="button"
          onClick={() => setIsExpanded((v) => !v)}
          className="flex min-w-0 flex-1 items-center justify-between gap-3 border-b border-slate-600/30 pb-2 text-left"
        >
          <div className="min-w-0">
            <h4 className="truncate text-base font-semibold text-slate-200">{urlaub.name}</h4>
            <span className="text-xs text-slate-500">
              {formatDate(urlaub.startDate)} – {formatDate(urlaub.endDate)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="whitespace-nowrap text-sm font-semibold text-amber-300">{formatAmount(total)}</span>
            <svg
              className={`w-5 h-5 text-slate-400 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        <div className="self-start pb-2">
          <DropdownMenu
            trigger={
              <button
                className="rounded-xl p-2 text-slate-400 transition-all hover:bg-slate-700/50 hover:text-slate-300"
                title="Aktionen"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                </svg>
              </button>
            }
            items={[
              {
                label: 'Bearbeiten',
                icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                ),
                onClick: () => onEdit(urlaub),
                variant: 'default',
              },
              {
                label: 'Löschen',
                icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                ),
                onClick: handleDeleteUrlaub,
                variant: 'destructive',
              },
            ]}
          />
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-2 pb-1">
          {URLAUB_CATEGORIES.map(({ key, label }) => (
            <CategoryExpenses
              key={key}
              urlaubId={urlaub.id}
              category={key}
              label={label}
              expenses={expenses.filter((expense) => expense.category === key)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const UrlaubeSection: React.FC<UrlaubeSectionProps> = ({ urlaube, selectedYear }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUrlaubId, setEditingUrlaubId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const yearUrlaube = urlaube.filter((u) => new Date(u.startDate).getFullYear() === selectedYear);
  const isEditing = editingUrlaubId !== null;

  const openCreateModal = () => {
    setEditingUrlaubId(null);
    setName('');
    const today = new Date().toISOString().split('T')[0];
    setStartDate(today);
    setEndDate(today);
    setIsModalOpen(true);
  };

  const openEditModal = (urlaub: Urlaub) => {
    setEditingUrlaubId(urlaub.id);
    setName(urlaub.name);
    setStartDate(urlaub.startDate);
    setEndDate(urlaub.endDate);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !startDate || !endDate) return;

    setIsSaving(true);
    try {
      if (editingUrlaubId) {
        await updateUrlaub(editingUrlaubId, name.trim(), startDate, endDate);
      } else {
        await addUrlaub(name.trim(), startDate, endDate);
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error saving Urlaub:', error);
      alert(editingUrlaubId ? 'Fehler beim Aktualisieren des Urlaubs.' : 'Fehler beim Anlegen des Urlaubs.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mt-4 border-t border-slate-600/30 pt-4">
      <h3 className="mb-2 pb-1 text-lg font-medium text-amber-300">
        Urlaube {selectedYear}
        {yearUrlaube.length > 0 && <span className="ml-2 text-sm text-amber-400/70">({yearUrlaube.length})</span>}
      </h3>

      <div className="space-y-3">
        {yearUrlaube.map((urlaub) => (
          <UrlaubCard key={urlaub.id} urlaub={urlaub} onEdit={openEditModal} />
        ))}

        <button
          type="button"
          onClick={openCreateModal}
          className="flex w-full items-center justify-center rounded-xl border-2 border-dashed border-amber-500/30 py-3 text-sm font-medium text-amber-300/80 transition-all hover:border-amber-400/50 hover:bg-amber-500/5 hover:text-amber-200"
        >
          <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Neuer Urlaub
        </button>
      </div>

      {isModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-50 flex min-h-dvh items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md overflow-hidden rounded-3xl border border-amber-400/20 bg-slate-900/95 shadow-2xl shadow-black/40">
              <form onSubmit={handleSubmit}>
                <div className="border-b border-amber-400/10 bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-slate-900 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="text-xl font-bold text-white">{isEditing ? 'Urlaub bearbeiten' : 'Neuer Urlaub'}</h3>
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="rounded-full bg-white/10 p-2 text-slate-300 transition hover:bg-white/15 hover:text-white"
                      aria-label="Modal schließen"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="space-y-4 p-5">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-300">Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-white placeholder-slate-500 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-500/30"
                      placeholder="z.B. Italien 2026"
                      required
                      autoFocus
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-300">Start</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-500/30"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-300">Ende</label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-500/30"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 border-t border-white/10 bg-slate-950/60 p-5 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="rounded-2xl border border-slate-700 bg-slate-800/70 px-5 py-3 font-medium text-slate-200 transition hover:bg-slate-700 hover:text-white"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="rounded-2xl bg-gradient-to-r from-amber-600 to-orange-500 px-5 py-3 font-semibold text-white shadow-lg shadow-amber-950/30 transition hover:from-amber-500 hover:to-orange-400 disabled:opacity-50"
                  >
                    {isSaving
                      ? isEditing
                        ? 'Wird gespeichert...'
                        : 'Wird angelegt...'
                      : isEditing
                        ? 'Änderungen speichern'
                        : 'Urlaub anlegen'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default UrlaubeSection;
