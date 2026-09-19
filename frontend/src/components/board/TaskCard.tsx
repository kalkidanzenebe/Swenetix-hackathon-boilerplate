import { Draggable } from '@hello-pangea/dnd';
import { Calendar, Lock, Trash2, Edit3, AlertCircle } from 'lucide-react';
import { useAppDispatch } from '../../app/hooks';
import { deleteTaskAsync } from '../../features/tasks/tasksThunks';
import type { Task, Priority } from '../../types/task.types';

interface TaskCardProps {
  task: Task;
  index: number;
  onOpen: (task: Task) => void;
}

const priorityConfig: Record<Priority, { label: string; bg: string; text: string; border: string }> = {
  high: { label: 'High', bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
  medium: { label: 'Medium', bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200' },
  low: { label: 'Low', bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' },
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

  const isOverdue = task.dueDate ? new Date(task.dueDate) < new Date() && task.status !== 'done' : false;

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
            'group relative mb-3 cursor-pointer rounded-lg p-4 outline-none transition-all select-none',
            'bg-slate-50 border border-slate-200 shadow-sm',
            'hover:shadow-md hover:border-slate-300',
            'focus-visible:ring-2 focus-visible:ring-indigo-500',
            snapshot.isDragging ? 'shadow-lg' : '',
            isLocked ? 'opacity-70' : '',
          ].join(' ')}
        >
          {/* Lock Badge */}
          {isLocked && (
            <div className="mb-2 flex items-center gap-1.5 rounded-md bg-yellow-100 px-2 py-0.5 text-[11px] font-medium text-yellow-700">
              <Lock size={12} />
              <span>{task.lockedBy} is editing...</span>
            </div>
          )}

          {/* Header: Priority + Actions */}
          <div className="mb-2 flex items-center justify-between gap-2">
            <span
              className={[
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border',
                priority.bg,
                priority.text,
                priority.border,
              ].join(' ')}
            >
              {task.priority === 'high' && <AlertCircle size={10} />}
              {priority.label}
            </span>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen(task);
                }}
                className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                title="Edit task"
              >
                <Edit3 size={13} />
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-red-600"
                title="Delete task"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          {/* Title */}
          <h3 className="text-sm font-semibold text-slate-800 leading-snug">{task.title}</h3>

          {/* Description */}
          {task.description && (
            <p className="mt-1 line-clamp-2 text-xs text-slate-500 leading-relaxed">{task.description}</p>
          )}

          {/* Labels */}
          {((task.labels && task.labels.length > 0) || task.label) && (
            <div className="mt-2.5 flex flex-wrap gap-1">
              {(task.labels && task.labels.length > 0 ? task.labels : [task.label!]).map((tag, i) => (
                <span
                  key={i}
                  className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-700 font-medium"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-200 text-[11px] text-slate-500">
            <div className="flex items-center gap-2">
              {formattedDate ? (
                <div
                  className={`inline-flex items-center gap-1 font-medium ${
                    isOverdue ? 'text-red-600' : 'text-slate-500'
                  }`}
                >
                  <Calendar size={12} />
                  <span>{formattedDate}</span>
                </div>
              ) : (
                <span className="text-slate-400 text-[10px]">v{task.version || 1}</span>
              )}
            </div>

            <div
              title={`Assigned to: ${task.assignedTo || task.createdBy || 'Unassigned'}`}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-300 text-[9px] font-semibold text-slate-700"
            >
              {getInitials(task.assignedTo || task.createdBy)}
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}
