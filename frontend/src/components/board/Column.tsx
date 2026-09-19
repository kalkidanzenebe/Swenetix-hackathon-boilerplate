import { Droppable } from '@hello-pangea/dnd';
import { ClipboardList, Zap, CheckCircle2 } from 'lucide-react';
import { useAppSelector } from '../../app/hooks';
import type { ColumnDef, Task, TaskStatus } from '../../types/task.types';
import TaskCard from './TaskCard';
import QuickAddTask from './QuickAddTask';

interface ColumnProps {
  column: ColumnDef;
  onOpenTask: (task: Task) => void;
}

const columnHeaderConfig: Record<
  TaskStatus,
  { icon: typeof ClipboardList; color: string; bg: string; dot: string }
> = {
  todo: {
    icon: ClipboardList,
    color: 'text-sky-400',
    bg: 'bg-sky-500/10 border-sky-500/20',
    dot: 'bg-sky-400',
  },
  'in-progress': {
    icon: Zap,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
    dot: 'bg-amber-400',
  },
  done: {
    icon: CheckCircle2,
    color: 'text-emerald-400',
    bg: 'bg-emerald-300/10 border-emerald-500/20',
    dot: 'bg-emerald-400',
  },
};

export default function Column({ column, onOpenTask }: ColumnProps) {
  const tasks = useAppSelector((state) =>
    state.tasks.items.filter((task) => task.status === column.id)
  );

  const config = columnHeaderConfig[column.id] || columnHeaderConfig.todo;
  const Icon = config.icon;

  return (
    <section
      aria-label={column.title}
      className="flex max-h-[calc(100vh-7rem)] w-80 flex-shrink-0 flex-col rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4 shadow-xl backdrop-blur-md"
    >
      {/* Column Header */}
      <header className="mb-3 flex items-center justify-between px-1">
        <div className="flex items-center gap-2.5">
          <div className={`flex h-7 w-7 items-center justify-center rounded-lg border ${config.bg}`}>
            <Icon size={15} className={config.color} />
          </div>
          <h2 className="text-sm font-semibold tracking-wide text-slate-200">
            {column.title}
          </h2>
        </div>

        {/* Task Counter badge */}
        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-slate-800 px-2 text-xs font-semibold text-slate-300 ring-1 ring-slate-700">
          {tasks.length}
        </span>
      </header>

      {/* Droppable Area */}
      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={[
              'min-h-[60px] flex-1 overflow-y-auto rounded-xl p-1 transition-all duration-200',
              snapshot.isDraggingOver
                ? 'bg-indigo-500/10 ring-2 ring-indigo-500/40 border-dashed border-2 border-indigo-500/50'
                : 'border border-transparent',
            ].join(' ')}
          >
            {tasks.map((task, index) => (
              <TaskCard key={task.id || task._id} task={task} index={index} onOpen={onOpenTask} />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      {/* Quick Add at Column Bottom */}
      <div className="mt-2 pt-2 border-t border-slate-800/60">
        <QuickAddTask status={column.id} />
      </div>
    </section>
  );
}