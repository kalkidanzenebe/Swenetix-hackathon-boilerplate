import { FormEvent, useState } from 'react';
import { useAppDispatch } from '../../app/hooks';
import { createTaskAsync } from '../../features/tasks/tasksThunks';
import type { TaskStatus } from '../../types/task.types';

interface QuickAddTaskProps {
  status: TaskStatus;
}

export default function QuickAddTask({ status }: QuickAddTaskProps) {
  const dispatch = useAppDispatch();
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
    dispatch(createTaskAsync({ title: trimmed, status }));
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
        className="w-full rounded-md px-2 py-2 text-left text-sm text-gray-600 hover:bg-gray-200"
      >
        + Add a card
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-1 flex flex-col gap-2">
      <textarea
        autoFocus
        rows={2}
        placeholder="Enter a title for this card"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            addCard();
          }
          if (e.key === 'Escape') close();
        }}
        className="resize-none rounded-md border border-gray-300 p-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Add card
        </button>
        <button
          type="button"
          onClick={close}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}