import { Draggable } from '@hello-pangea/dnd';
import type { Task } from '../../types/task.types';

interface TaskCardProps {
  task: Task;
  index: number;
  onOpen: (task: Task) => void;
}

export default function TaskCard({ task, index, onOpen }: TaskCardProps) {
  const taskId = task.id || task._id || '';

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
            'mb-2 cursor-pointer rounded-lg bg-white p-3 shadow-sm outline-none',
            'transition-shadow hover:shadow-md',
            'focus-visible:ring-2 focus-visible:ring-indigo-500',
            snapshot.isDragging ? 'rotate-1 shadow-lg' : '',
          ].join(' ')}
        >
          <p className="text-sm font-medium text-gray-900">{task.title}</p>

          {task.description && (
            <p className="mt-1.5 line-clamp-2 text-xs text-gray-500">
              {task.description}
            </p>
          )}

        </div>
      )}
    </Draggable>
  );
}