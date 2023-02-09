import { Server, Socket } from "socket.io";
import { Task, ComicRequest, DownloadRequest } from "../model/comicRequest";
import { newCartoonmad } from "../services/cartoonmad";
import { newDm5 } from "../services/dm5";
import { ttlMinute } from "../config.json";

interface TaskQueue {
    [key: string]: { [key: string]: Task }
}
const taskQueue: TaskQueue = {};

export const indexWS = function (io: Server) {
    io.on("connection", (socket) => {
        socket.on("getChList", async (req: ComicRequest) => {
            if (!taskQueue[socket.id]) {
                taskQueue[socket.id] = {};
            }
            const unixTimestamp = +new Date();
            const task = genTask(socket, req, unixTimestamp);
            taskQueue[socket.id][unixTimestamp] = task;
            const chListRes = await task.getChList();
            socket.emit("sendChList", chListRes);
        });

        socket.on("download", async (req: DownloadRequest) => {
            const task = taskQueue[socket.id][req.unixTimestamp];
            socket.emit("status", "建立資料夾中...");
            await task.preDownload(req.chioceChapterIndex);
            socket.emit("status", "取得圖檔路徑中...");
            await task.getImgSrc();
            socket.emit("status", "下載中...");
            task.download();
        });

        socket.on("deleteTask", async (unixTimestamp: number) => {
            const task = taskQueue[socket.id][unixTimestamp];
            if (task) {
                if (task.checkEnd()) {
                    delete taskQueue[socket.id][unixTimestamp];
                }
            }
        });

        socket.on("batchWork", async (req: ComicRequest[]) => {
            if (!taskQueue[socket.id]) {
                taskQueue[socket.id] = {};
            }
            for (let i = 0; i < req.length; i++) {
                const unixTimestamp = +new Date() + i;
                const task = genTask(socket, req[i], unixTimestamp);
                taskQueue[socket.id][unixTimestamp] = task;
                task.batchWork();
            }
            socket.emit("sendBatch");
        });

        socket.on("updateTTL", async (unixTimestamp: number) => {
            const task = taskQueue[socket.id][unixTimestamp];
            task.ttl += (ttlMinute * 60 * 1000);
        });
    });
};

function genTask(socket: Socket, comicRequest: ComicRequest, unixTimestamp: number): Task {
    switch (comicRequest.comicWeb) {
        case "cartoonmad":
            return newCartoonmad(socket, comicRequest.comicUrl, unixTimestamp);
        case "dm5":
            return newDm5(socket, comicRequest.comicUrl, unixTimestamp);
        default:
            throw new Error("網站選擇錯誤");
    }
}

function checkSocketAlive() {
    const taskQueueSocketId = Object.keys(taskQueue);
    for (const socketId of taskQueueSocketId) {
        const socketIdTask = Object.values(taskQueue[socketId]) as Task[];
        if (socketIdTask.length === 0) {
            delete taskQueue[socketId];
        }
        for (const task of socketIdTask) {
            if (!task.alive || + new Date() > task.ttl) {
                delete taskQueue[socketId][task.unixTimestamp];
            }
        }
    }
}

setInterval(checkSocketAlive, (Math.ceil(ttlMinute / 2) * 60 * 1000));
