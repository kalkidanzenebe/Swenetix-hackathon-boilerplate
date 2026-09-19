import React, { useState, useEffect } from 'react';
import { Task, TaskStatus, Priority, BOARD_COLUMNS } from '../../types/task.types';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { createTaskAsync, updateTaskAsync } from '../../features/tasks/tasksThunks';
import { getSocket } from '../../services/socket';
import { X } from 'lucide-react';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskToEdit?: Task | null;
  defaultStatus?: TaskStatus;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  taskToEdit,
  defaultStatus = 'todo',
}) => {
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector((state) => state.auth?.currentUser);
  const tasks = useAppSelector((state) => state.tasks.items);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>(defaultStatus);
  const [priority, setPriority] = useState<Priority>('medium');
  const [assignedTo, setAssignedTo] = useState('');
  const [label, setLabel] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (taskToEdit) {
      setTitle(taskToEdit.title);
      setDescription(taskToEdit.description || '');
      setStatus(taskToEdit.status);
      setPriority(taskToEdit.priority || 'medium');
      setAssignedTo(taskToEdit.assignedTo || '');
      setLabel(taskToEdit.label || (taskToEdit.labels && taskToEdit.labels[0]) || '');
      setDueDate(taskToEdit.dueDate ? new Date(taskToEdit.dueDate).toISOString().substring(0, 10) : '');
    } else {
      setTitle('');
      setDescription('');
      setStatus(defaultStatus);
      setPriority('medium');
      setAssignedTo('');
      setLabel('');
      setDueDate('');
    }
  }, [taskToEdit, defaultStatus, isOpen]);

  useEffect(() => {
    if (isOpen && taskToEdit) {
      const taskId = taskToEdit._id || taskToEdit.id;
      const socket = getSocket();
      socket.emit('editing:start', { taskId });

      const pingInterval = setInterval(() => {
        socket.emit('editing:ping', { taskId });
      }, 5000);

      return () => {
        clearInterval(pingInterval);
        socket.emit('editing:stop', { taskId });
      };
    }
  }, [isOpen, taskToEdit]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const calculateNewOrder = (targetStatus: TaskStatus): number => {
    const statusTasks = tasks
      .filter((t) => t.status === targetStatus)
      .sort((a, b) => a.order - b.order);

    if (statusTasks.length === 0) return 1000;
    return statusTasks[statusTasks.length - 1].order + 1000;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle || isSubmitting) return;

    setIsSubmitting(true);
    const author = currentUser?.displayName || 'Anonymous';

    try {
      if (taskToEdit) {
        const taskId = taskToEdit._id || taskToEdit.id!;
        await dispatch(
          updateTaskAsync({
            id: taskId,
            updates: {
              title: trimmedTitle,
              description: description.trim(),
              status,
              priority,
              assignedTo: assignedTo.trim() || null,
              labels: label.trim() ? [label.trim()] : [],
              dueDate: dueDate || null,
              version: taskToEdit.version,
              updatedBy: author,
            },
          })
        ).unwrap();
      } else {
        await dispatch(
          createTaskAsync({
            title: trimmedTitle,
            description: description.trim(),
            status,
            order: calculateNewOrder(status),
            priority,
            createdBy: author,
            assignedTo: assignedTo.trim() || null,
            labels: label.trim() ? [label.trim()] : [],
            dueDate: dueDate || null,
            clientId: `client-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          })
        ).unwrap();
      }
      onClose();
    } catch (err) {
      console.error('Failed to save task:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-slate-950/95 border border-slate-800/90 rounded-2xl p-5 sm:p-6 shadow-2xl shadow-black/40 ring-1 ring-white/[0.03] transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-800/80">
          <h3 className="text-lg font-semibold tracking-tight text-white">
            {taskToEdit ? 'Edit Task' : 'Create New Task'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 -mr-2 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/70"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">
              Title <span className="text-rose-400" aria-hidden="true">*</span>
            </label>
            <input
              type="text"
              maxLength={140}
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title..."
              className="w-full px-3.5 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-500 outline-none transition-all hover:border-slate-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Task details..."
              className="w-full px-3.5 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-500 outline-none transition-all hover:border-slate-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 resize-y"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full px-3.5 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-sm text-slate-100 outline-none transition-all hover:border-slate-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              >
                {BOARD_COLUMNS.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="w-full px-3.5 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-sm text-slate-100 outline-none transition-all hover:border-slate-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">
                Assigned To
              </label>
              <input
                type="text"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                placeholder="Name or email..."
                className="w-full px-3.5 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-500 outline-none transition-all hover:border-slate-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">
                Label
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Bug, Feature, UI"
                className="w-full px-3.5 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-500 outline-none transition-all hover:border-slate-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">
              Due Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-sm text-slate-100 outline-none transition-all hover:border-slate-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end items-stretch sm:items-center gap-2.5 pt-5 mt-1 border-t border-slate-800/80">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-slate-300 bg-slate-900/80 hover:bg-slate-800 hover:text-white border border-slate-700/80 rounded-xl transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/70"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-lg shadow-indigo-500/15 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/70"
            >
              {isSubmitting ? 'Saving...' : taskToEdit ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskModal;