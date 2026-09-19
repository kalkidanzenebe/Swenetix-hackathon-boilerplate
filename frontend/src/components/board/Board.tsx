import { useEffect, useState } from 'react';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { fetchTasksAsync, moveTaskAsync } from '../../features/tasks/tasksThunks';
import { BOARD_COLUMNS, Task } from '../../types/task.types';
import Column from './Column';

export default function Board() {
  const dispatch = useAppDispatch();
const loading = false;
  const [openTask, setOpenTask] = useState<Task | null>(null);

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

    dispatch(
      moveTaskAsync({
        id: draggableId,
        toStatus: destination.droppableId as Task['status'],
        toIndex: destination.index,
      })
    );
  };

  if (loading == true) {
    return <p className="p-8 text-center text-gray-500">Loading board...</p>;
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex min-h-full items-start gap-4 overflow-x-auto p-4">
        {BOARD_COLUMNS.map((column) => (
          <Column key={column.id} column={column} onOpenTask={setOpenTask} />
        ))}
      </div>
      {/* openTask is passed to TaskModal once that component is wired in */}
    </DragDropContext>
  );
}