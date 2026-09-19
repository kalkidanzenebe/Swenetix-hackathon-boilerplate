import { FormEvent, useState } from 'react';
import { Plus } from 'lucide-react';
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
        className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs text-gray-500 hover:bg-gray-100"
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
        className="w-full resize-none rounded-md border border-gray-300 p-2 text-xs text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800"
        >
          Add
        </button>
        <button
          type="button"
          onClick={close}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}