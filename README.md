# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

# 💰 Cashflow Tracker

Eine moderne React-Anwendung zum Verwalten von Einnahmen und Ausgaben in Echtzeit mit Firebase Realtime Database.

## 🚀 Features

- ✅ Hinzufügen von Einnahmen und Ausgaben
- ✅ Kategorisierung von Transaktionen
- ✅ Echtzeit-Synchronisation mit Firebase
- ✅ Automatische Saldo-Berechnung
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

## 📱 Verwendung

1. **Neue Transaktion hinzufügen**: Wählen Sie den Typ (Einnahme/Ausgabe), geben Sie Betrag, Beschreibung und Kategorie ein
2. **Transaktionen anzeigen**: Alle Transaktionen werden in Echtzeit angezeigt
3. **Saldo verfolgen**: Der aktuelle Saldo wird automatisch berechnet
4. **Transaktionen löschen**: Klicken Sie auf das "×" um eine Transaktion zu entfernen

## 🏗️ Projektstruktur

```
src/
├── components/
│   ├── TransactionForm.tsx    # Formular für neue Transaktionen
│   ├── TransactionForm.css
│   ├── TransactionList.tsx    # Liste aller Transaktionen
│   └── TransactionList.css
├── types/
│   └── Transaction.ts         # TypeScript-Definitionen
├── firebase.ts                # Firebase-Konfiguration
├── App.tsx                    # Haupt-App-Komponente
└── App.css
```

## 🚀 Verfügbare Scripts

- `npm run dev` - Startet den Entwicklungsserver
- `npm run build` - Erstellt die Production-Version
- `npm run preview` - Vorschau der Production-Version
- `npm run lint` - Führt ESLint aus

## 🔧 Technologien

- **React 18** - UI-Framework
- **TypeScript** - Typsicherheit
- **Vite** - Build-Tool
- **Firebase Realtime Database** - Echtzeit-Datenbank
- **CSS3** - Styling

## 📝 Nächste Schritte

- [ ] Benutzerauthentifizierung hinzufügen
- [ ] Erweiterte Kategorieverwaltung
- [ ] Datenexport (CSV, PDF)
- [ ] Statistiken und Diagramme
- [ ] Offline-Unterstützung
- [ ] Mobile App (React Native)

## 🤝 Beitrag

Falls Sie Verbesserungen vorschlagen möchten, erstellen Sie gerne ein Issue oder Pull Request!

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
