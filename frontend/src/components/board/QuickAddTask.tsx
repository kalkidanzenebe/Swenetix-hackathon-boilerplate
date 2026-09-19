import { FormEvent, useState } from 'react';
import { Plus, CornerDownLeft } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { createTaskAsync } from '../../features/tasks/tasksThunks';
import type { TaskStatus } from '../../types/task.types';

interface QuickAddTaskProps {
  status: TaskStatus;
}

export default function QuickAddTask({ status }: QuickAddTaskProps) {
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector((state) => state.auth?.currentUser);
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');

  const close = () => {
    setIsOpen(false);
    setTitle('');
  };

  const addCard = () => {
    const trimmed = title.trim();
    if (!trimmed) {
      close();
      return;
    }
    dispatch(
      createTaskAsync({
        title: trimmed,
        status,
        createdBy: currentUser?.displayName || 'Anonymous',
        clientId: `client-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      })
    );
    setTitle('');
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    addCard();
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium text-slate-400 transition-all hover:bg-slate-800/80 hover:text-slate-200"
      >
        <Plus size={14} />
        <span>Add a task</span>
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <textarea
        autoFocus
        rows={2}
        placeholder="What needs to be done?"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            addCard();
          }
          if (e.key === 'Escape') close();
        }}
        className="w-full resize-none rounded-xl border border-slate-700/80 bg-slate-800/90 p-2.5 text-xs text-slate-100 placeholder-slate-500 shadow-inner focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-500 transition-all"
          >
            <span>Add</span>
            <CornerDownLeft size={11} />
          </button>
          <button
            type="button"
            onClick={close}
            className="rounded-lg px-2 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            Cancel
          </button>
        </div>
        <span className="text-[10px] text-slate-500">Esc to cancel</span>
      </div>
    </form>
  );
}
