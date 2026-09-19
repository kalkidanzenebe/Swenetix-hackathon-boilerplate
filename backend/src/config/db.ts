import mongoose from "mongoose";

const DB = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/mern-boilerplate"

export const conn = async (): Promise<void> => {
    const uri = DB;
    mongoose.connection.on("connected" , () => console.log("DB connected"));
    mongoose.connection.on("error" , (e) => console.error({"Error": e.message}));
    mongoose.connection.on("disconnected" , () => console.log("DB disconnected"));

    await mongoose.connect(uri, {serverSelectionTimeoutMS: 100})
}

export const disconn = async (): Promise<void> => {
    await mongoose.connection.close();
}