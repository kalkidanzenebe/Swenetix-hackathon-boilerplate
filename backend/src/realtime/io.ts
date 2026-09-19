import { Server } from "socket.io";

export const BOARD = "board"

let io: Server | null = null;

export const setIO = (instance: Server): void =>{
    io = instance;
};

export const getIO = (): Server | null => io;

export const emitToBoard = (event: string, payload: unknown): void =>{
    io?.to(BOARD).emit(event, payload);
};

