import { useEffect, useState, useMemo } from 'react';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { Plus } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { fetchTasksAsync, moveTaskAsync } from '../../features/tasks/tasksThunks';
import { moveTaskOptimistic } from '../../features/tasks/tasksSlice';
import { BOARD_COLUMNS, Task, TaskStatus } from '../../types/task.types';
import Column from './Column';
import { TaskModal } from '../modals/TaskModal';

export default function Board() {
  const dispatch = useAppDispatch();
  const { items: tasks, loading } = useAppSelector((state) => state.tasks);
  const [openTask, setOpenTask] = useState<Task | null>(null);
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);

  useEffect(() => {
    dispatch(fetchTasksAsync());
  }, [dispatch]);

  const handleDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    const nextStatus = destination.droppableId as TaskStatus;

    dispatch(
      moveTaskOptimistic({
        id: draggableId,
        status: nextStatus,
        order: destination.index * 1000 + 1000,
      })
    );

    dispatch(
      moveTaskAsync({
        id: draggableId,
        status: nextStatus,
        order: destination.index * 1000 + 1000,
      })
    );
  };

  const stats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === 'done').length;
    const percentDone = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, percentDone };
  }, [tasks]);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="border-b border-gray-200 bg-white px-6 py-3">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Tasks</h2>
            <p className="text-xs text-gray-500">{stats.total} total</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden items-center gap-2 md:flex">
              <span className="text-xs text-gray-500">{stats.percentDone}% complete</span>
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-200">
                <div
                  style={{ width: `${stats.percentDone}%` }}
                  className="h-full rounded-full bg-gray-900"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsNewTaskModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800"
            >
              <Plus size={14} />
              <span>New task</span>
            </button>
          </div>
        </div>
      </div>

      <div className="relative flex-1 overflow-x-auto bg-white p-6">
        {loading && tasks.length === 0 ? (
          <div className="flex h-64 items-center justify-center">
            <p className="text-xs text-gray-500">Loading board...</p>
          </div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex min-h-full items-start gap-4">
              {BOARD_COLUMNS.map((column) => (
                <Column key={column.id} column={column} onOpenTask={setOpenTask} />
              ))}
            </div>
          </DragDropContext>
        )}
      </div>

      {openTask && (
        <TaskModal
          isOpen={Boolean(openTask)}
          onClose={() => setOpenTask(null)}
          taskToEdit={openTask}
        />
      )}

      {isNewTaskModalOpen && (
        <TaskModal
          isOpen={isNewTaskModalOpen}
          onClose={() => setIsNewTaskModalOpen(false)}
          defaultStatus="todo"
        />
      )}
    </div>
  );
}