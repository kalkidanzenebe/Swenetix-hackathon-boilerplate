import React from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { logout } from '../../features/auth/authSlice';
import { LayoutGrid, LogOut, Wifi, WifiOff } from 'lucide-react';

interface Collaborator {
  id: string;
  name: string;
  color: string;
}

interface NavbarProps {
  collaborators?: Collaborator[];
  isConnected?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  collaborators = [],
  isConnected = true,
}) => {
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector((state) => state.auth.currentUser);

  const handleLogout = () => {
    dispatch(logout());
  };

  const getInitials = (name: string): string => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-6 py-3">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        {/* Left: Brand / Title */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-md shadow-blue-600/20">
            <LayoutGrid size={20} />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-slate-100">
              Live Kanban Board
            </h1>
            <p className="text-[11px] text-slate-400">Real-time Workspace</p>
          </div>
        </div>

        {/* Center: Live Connection Pill */}
        <div className="hidden sm:flex items-center">
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
              isConnected
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                : 'border-rose-500/20 bg-rose-500/10 text-rose-400'
            }`}
          >
            {isConnected ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>Live Sync</span>
              </>
            ) : (
              <>
                <WifiOff size={12} />
                <span>Offline</span>
              </>
            )}
          </div>
        </div>

        {/* Right: Active Collaborators, Current User & Logout */}
        <div className="flex items-center gap-4">
          {/* Active Collaborators Avatars */}
          {collaborators.length > 0 && (
            <div className="flex items-center -space-x-2 overflow-hidden">
              {collaborators.map((user) => (
                <div
                  key={user.id}
                  title={user.name}
                  style={{ backgroundColor: user.color || '#3b82f6' }}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-slate-900 shadow-sm transition-transform hover:scale-110 hover:z-10"
                >
                  {getInitials(user.name)}
                </div>
              ))}
            </div>
          )}

          {/* Current User Pill */}
          {currentUser && (
            <div className="flex items-center gap-2 pl-3 border-l border-slate-800">
              <div
                style={{ backgroundColor: currentUser.color || '#2563eb' }}
                className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm ring-1 ring-white/10"
              >
                {getInitials(currentUser.displayName)}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-xs font-medium text-slate-200 leading-tight">
                  {currentUser.displayName}
                </p>
                <p className="text-[10px] text-slate-500">Active</p>
              </div>
            </div>
          )}

          {/* Sign Out Button */}
          <button
            type="button"
            onClick={handleLogout}
            title="Sign out"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-rose-400 transition-colors"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
