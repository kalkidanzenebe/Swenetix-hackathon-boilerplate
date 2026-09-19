import { Droppable } from '@hello-pangea/dnd';
import { useAppSelector } from '../../app/hooks';
import type { ColumnDef, Task } from '../../types/task.types';
import TaskCard from './TaskCard';
import QuickAddTask from './QuickAddTask';

interface ColumnProps {
  column: ColumnDef;
  onOpenTask: (task: Task) => void;
}

export default function Column({ column, onOpenTask }: ColumnProps) {
const tasks = useAppSelector((state) => 
  state.tasks.items.filter((task) => task.status === column.id)
);
  return (
    <section
      aria-label={column.title}
      className="flex max-h-[calc(100vh-6rem)] w-72 flex-shrink-0 flex-col rounded-xl bg-gray-100 p-3"
    >
      <header className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
          {column.title}
        </h2>
        <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-600">
          {tasks.length}
        </span>
      </header>

      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={[
              'min-h-[40px] flex-1 overflow-y-auto rounded-md transition-colors',
              snapshot.isDraggingOver ? 'bg-indigo-50' : '',
            ].join(' ')}
          >
            {tasks.map((task, index) => (
              <TaskCard key={task._id} task={task} index={index} onOpen={onOpenTask} />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      <QuickAddTask status={column.id} />
    </section>
  );
}
