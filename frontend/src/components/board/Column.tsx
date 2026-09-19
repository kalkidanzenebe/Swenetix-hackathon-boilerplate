import { Droppable } from '@hello-pangea/dnd';
import { useAppSelector } from '../../app/hooks';
import type { ColumnDef, Task, TaskStatus } from '../../types/task.types';
import TaskCard from './TaskCard';
import QuickAddTask from './QuickAddTask';

interface ColumnProps {
  column: ColumnDef;
  onOpenTask: (task: Task) => void;
}

const statusDot: Record<TaskStatus, string> = {
  todo: 'bg-gray-400',
  'in-progress': 'bg-blue-500',
  done: 'bg-green-500',
};

export default function Column({ column, onOpenTask }: ColumnProps) {
  const tasks = useAppSelector((state) =>
    state.tasks.items.filter((task) => task.status === column.id)
  );

  return (
    <section
      aria-label={column.title}
      className="flex max-h-[calc(100vh-8rem)] w-72 flex-shrink-0 flex-col rounded-lg border border-gray-200 bg-gray-50 p-3"
    >
      <header className="mb-3 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${statusDot[column.id] || 'bg-gray-400'}`} />
          <h2 className="text-sm font-medium text-gray-700">{column.title}</h2>
        </div>
        <span className="rounded px-1.5 py-0.5 text-xs text-gray-500">{tasks.length}</span>
      </header>

      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={[
              'min-h-[40px] flex-1 overflow-y-auto rounded-md',
              snapshot.isDraggingOver ? 'bg-blue-50' : '',
            ].join(' ')}
          >
            {tasks.map((task, index) => (
              <TaskCard key={task.id || task._id} task={task} index={index} onOpen={onOpenTask} />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      <div className="mt-2 border-t border-gray-200 pt-2">
        <QuickAddTask status={column.id} />
      </div>
    </section>
  );
}