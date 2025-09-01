import './styles.css';

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center px-4">
      <div className="text-center max-w-2xl">
        <h1 className="text-6xl md:text-8xl lg:text-9xl font-black bg-gradient-to-r from-blue-400 via-purple-500 to-cyan-400 bg-clip-text text-transparent mb-6 tracking-tight leading-none">
          Cashflow
        </h1>
        <div className="w-32 h-1 bg-gradient-to-r from-blue-400 to-cyan-400 mx-auto rounded-full mb-8 opacity-80"></div>
        <p className="text-slate-400 text-xl font-light tracking-wide">
          Moderne Finanzübersicht
        </p>
      </div>
    </div>
  );
}

export default App;
