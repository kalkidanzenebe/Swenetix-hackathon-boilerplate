import { Draggable } from '@hello-pangea/dnd';
import { Calendar, Lock, Trash2, Pencil } from 'lucide-react';
import { useAppDispatch } from '../../app/hooks';
import { deleteTaskAsync } from '../../features/tasks/tasksThunks';
import type { Task, Priority } from '../../types/task.types';

interface TaskCardProps {
  task: Task;
  index: number;
  onOpen: (task: Task) => void;
}

const priorityConfig: Record<Priority, { label: string; className: string }> = {
  high: { label: 'High', className: 'bg-red-50 text-red-700' },
  medium: { label: 'Medium', className: 'bg-yellow-50 text-yellow-700' },
  low: { label: 'Low', className: 'bg-gray-100 text-gray-600' },
};

const getInitials = (name?: string | null): string => {
  if (!name) return '?';
  return name.slice(0, 2).toUpperCase();
};

export default function TaskCard({ task, index, onOpen }: TaskCardProps) {
  const dispatch = useAppDispatch();
  const taskId = task.id || task._id || '';
  const priority = priorityConfig[task.priority || 'medium'];
  const isLocked = Boolean(task.lockedBy);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Delete task "${task.title}"?`)) {
      dispatch(deleteTaskAsync(taskId));
    }
  };

  const formattedDate = task.dueDate
    ? new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : null;

  const isOverdue = task.dueDate
    ? new Date(task.dueDate) < new Date() && task.status !== 'done'
    : false;

  return (
    <Draggable draggableId={taskId} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          role="button"
          tabIndex={0}
          onClick={() => onOpen(task)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onOpen(task);
            }
          }}
          className={[
            'group mb-2 cursor-pointer rounded-md border border-gray-200 bg-white p-3 outline-none',
            'hover:border-gray-300',
            'focus-visible:ring-2 focus-visible:ring-blue-500',
            snapshot.isDragging ? 'shadow-md' : '',
          ].join(' ')}
        >
          {isLocked && (
            <div className="mb-2 flex items-center gap-1.5 text-xs text-yellow-700">
              <Lock size={12} />
              <span>{task.lockedBy} is editing</span>
            </div>
          )}

          <div className="mb-2 flex items-center justify-between gap-2">
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${priority.className}`}>
              {priority.label}
            </span>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen(task);
                }}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                title="Edit task"
              >
                <Pencil size={13} />
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                title="Delete task"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          <h3 className="text-sm font-medium text-gray-900">{task.title}</h3>

          {task.description && (
            <p className="mt-1 line-clamp-2 text-xs text-gray-500">{task.description}</p>
          )}

          {((task.labels && task.labels.length > 0) || task.label) && (
            <div className="mt-2 flex flex-wrap gap-1">
              {(task.labels && task.labels.length > 0 ? task.labels : [task.label!]).map((tag, i) => (
                <span key={i} className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2 text-[11px] text-gray-400">
            {formattedDate ? (
              <span className={`inline-flex items-center gap-1 ${isOverdue ? 'text-red-600' : ''}`}>
                <Calendar size={12} />
                {formattedDate}
              </span>
            ) : (
              <span>v{task.version || 1}</span>
            )}

            <div
              title={`Assigned to: ${task.assignedTo || task.createdBy || 'Unassigned'}`}
              className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-[9px] font-semibold text-gray-700"
            >
              {getInitials(task.assignedTo || task.createdBy)}
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}