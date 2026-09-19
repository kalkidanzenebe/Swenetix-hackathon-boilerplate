import React from 'react';
import { useAppSelector } from './app/hooks';
import AuthPage from './pages/AuthPage';
import Board from './components/board/Board';
import Navbar from './components/layout/Navbar';
import { useSocketSync } from './hooks/useSocketSync';

export const App: React.FC = () => {
  const currentUser = useAppSelector((state) => state.auth.currentUser);
  const { isConnected, collaborators } = useSocketSync();

  if (!currentUser) {
    return <AuthPage />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased">
      <Navbar isConnected={isConnected} collaborators={collaborators} />
      <main className="flex-1 overflow-x-auto">
        <Board />
      </main>
    </div>
  );
};

export default App;