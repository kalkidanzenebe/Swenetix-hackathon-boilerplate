import { useSelector, useDispatch } from "react-redux";
import Board from "./components/board/Board";
import type { RootState, AppDispatch } from "./app/store";

function App() {
  const dispatch: AppDispatch = useDispatch();

  return (
    <Board />
  );
}

export default App;
