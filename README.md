# 💰 Cashflow Tracker

Eine moderne React-Anwendung zum Verwalten von Einnahmen und Ausgaben in Echtzeit mit Firebase Realtime Database.

## 🚀 Features

- ✅ Hinzufügen von Einnahmen und Ausgaben
- ✅ Kategorisierung von Transaktionen
- ✅ Echtzeit-Synchronisation mit Firebase
- ✅ Automatische Saldo-Berechnung
- ✅ Wiederkehrende Transaktionen
- ✅ Bilanzen, Dark Analytics und Vermögensübersicht
- ✅ Responsive Design
- ✅ TypeScript für Typsicherheit

## 🛠️ Setup

### 1. Firebase-Projekt erstellen

1. Gehen Sie zur [Firebase Console](https://console.firebase.google.com/)
2. Erstellen Sie ein neues Projekt
3. Aktivieren Sie die Realtime Database
4. Kopieren Sie die Firebase-Konfiguration

### 2. Firebase-Konfiguration

Ersetzen Sie die Platzhalter in `src/firebase.ts` mit Ihren Firebase-Konfigurationsdaten:

```typescript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com/",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### 3. Installation und Start

```bash
# Abhängigkeiten installieren
npm install

# Entwicklungsserver starten
npm run dev
```

### 4. Live-Kurse für Finanzprodukte

Für die Vermögensübersicht können Finanzprodukte per ISIN hinterlegt werden. Die App nutzt `VITE_EODHD_API_KEY` für ISIN-Mapping und Live-Kurse über EODHD. Nicht-EUR-Kurse werden über Frankfurter FX-Rates nach EUR umgerechnet.

Legen Sie dafür lokal eine `.env.local` an:

```bash
VITE_EODHD_API_KEY=YOUR_EODHD_API_KEY
```

Die Datei `.env.local` darf nicht committed werden. Für `IE00BKM4GZ66` wird bevorzugt der EUR-Ticker `IS3N.XETRA` verwendet.

## 📱 Verwendung

1. **Neue Transaktion hinzufügen**: Wählen Sie den Typ (Einnahme/Ausgabe), geben Sie Betrag, Beschreibung und Kategorie ein
2. **Transaktionen anzeigen**: Alle Transaktionen werden in Echtzeit angezeigt
3. **Saldo verfolgen**: Der aktuelle Saldo wird automatisch berechnet
4. **Transaktionen löschen**: Klicken Sie auf das "×" um eine Transaktion zu entfernen

## 🏗️ Projektstruktur

```
src/
├── components/
│   ├── InlineTransactionForm.tsx
│   ├── LazyTransactionList.tsx
│   ├── BilanzPage.tsx
│   ├── DarkAnalyticsPage.tsx
│   ├── SettingsPage.tsx
│   └── ...
├── services/
│   ├── transactionService.ts
│   ├── recurringTransactionService.ts
│   └── eodhdService.ts
├── types/
│   └── Transaction.ts         # TypeScript-Definitionen
├── firebase.ts                # Firebase-Konfiguration
├── App.tsx                    # Haupt-App-Komponente und Routing
└── styles.css                 # Globale Styles und Tailwind-Basis
```

## 🚀 Verfügbare Scripts

- `npm run dev` - Startet den Entwicklungsserver
- `npm run build` - Erstellt die Production-Version
- `npm run preview` - Vorschau der Production-Version
- `npm run lint` - Führt ESLint aus

## 🔧 Technologien

- **React 19** - UI-Framework
- **TypeScript** - Typsicherheit
- **Vite** - Build-Tool
- **Firebase Realtime Database** - Echtzeit-Datenbank
- **Tailwind CSS** - Styling

## 📝 Nächste Schritte

- [ ] Benutzerauthentifizierung hinzufügen
- [ ] Offline-Unterstützung
- [ ] iOS Shortcut/Widget-Datenansicht

## 🤝 Beitrag

Falls Sie Verbesserungen vorschlagen möchten, erstellen Sie gerne ein Issue oder Pull Request!
