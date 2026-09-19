import React from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { logout } from '../../features/auth/authSlice';
import { LayoutGrid, LogOut } from 'lucide-react';

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
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 backdrop-blur-md px-6 py-3 shadow-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        {/* Left: Brand */}
        <div className="flex items-center gap-3">
          
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-slate-100">
              Live Task Board
            </h1>
            <p className="text-[11px] text-slate-400">Real-time Workspace</p>
          </div>
        </div>

        {/* Right: Collaborators + User + Logout */}
        <div className="flex items-center gap-5">
          {/* Collaborators */}
          {collaborators.length > 0 && (
            <div className="flex items-center -space-x-2">
              {collaborators.map((user: Collaborator) => (
                <div
                  key={user.id}
                  title={user.name}
                  style={{ backgroundColor: user.color || '#3b82f6' }}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-white/20 shadow-sm transition-transform hover:scale-110 hover:z-10"
                >
                  {getInitials(user.name)}
                </div>
              ))}
            </div>
          )}

          {/* Current User */}
          {currentUser && (
            <div className="flex items-center gap-2 pl-4 border-l border-slate-700">
              <div
                style={{ backgroundColor: currentUser.color || '#2563eb' }}
                className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm ring-1 ring-white/10"
              >
                {getInitials(currentUser.displayName)}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-xs font-semibold text-slate-200 leading-tight">
                  {currentUser.displayName}
                </p>
                <p className="text-[10px] text-slate-500">
                  {}
                  Active
                  </p>
              </div>
            </div>
          )}

          {/* Logout */}
          <button
            type="button"
            onClick={handleLogout}
            title="Sign out"
            className="rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-rose-400 transition-transform hover:scale-105"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
