import { Server, Socket } from "socket.io";
import { Task, ComicRequest, DownloadRequest } from "../model/comicRequest";
import { newCartoonmad } from "../services/cartoonmad";
import { newDm5 } from "../services/dm5";
import { ttlMinute } from "../config.json";
import { readFileSync, writeFileSync } from "fs";

interface TaskQueue {
    [key: string]: { [key: string]: Task }
}
interface SocketList {
    [key: string]: Socket
}
interface QueueJson {
    [key: string]: ComicRequest[]
}
const taskQueue: TaskQueue = {};
const socketList: SocketList = {};

export const indexWS = function (io: Server) {
    try {
        io.on("connection", (socket) => {
            taskQueue[socket.id] = {};
            socketList[socket.id] = socket;

            socket.on("getChList", async (req: ComicRequest) => {
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
                    const queue: QueueJson = JSON.parse(readFileSync("./queue.json", "utf8"));
                    const batchQueueIndex = queue[socket.id].findIndex(x => x.comicUrl === task.data.comicUrl);
                    if (batchQueueIndex >= 0) {
                        queue[socket.id][batchQueueIndex].downloadEnd = true;
                        await writeFileSync("./queue.json", JSON.stringify(queue));
                    }
                    delete taskQueue[socket.id][unixTimestamp];
                }
            });

            socket.on("readQueue", async () => {
                const queue: QueueJson = JSON.parse(readFileSync("./queue.json", "utf8"));
                socket.emit("readQueue", queue[socket.id]);
            });

            socket.on("batchWork", async (req: ComicRequest[]) => {
                const queue: QueueJson = JSON.parse(readFileSync("./queue.json", "utf8"));
                if (!queue[socket.id]) {
                    queue[socket.id] = [];
                }
                queue[socket.id] = queue[socket.id].concat(req);
                await writeFileSync("./queue.json", JSON.stringify(queue));

                if (Object.keys(taskQueue[socket.id]).length === 0) {
                    const unixTimestamp = +new Date();
                    const task = genTask(socket, req[0], unixTimestamp);
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
    }
    catch (err) {
        console.log(err);
    }
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

async function downloadQueue() {
    const queue: QueueJson = JSON.parse(readFileSync("./queue.json", "utf8"));
    const socketIds = Object.keys(queue);
    for (const socketId of socketIds) {
        if (taskQueue[socketId]) {
            if (Object.keys(taskQueue[socketId]).length === 0) {
                const unixTimestamp = +new Date();
                const thisTask = queue[socketId].find(x => !x.downloadEnd);
                if (thisTask) {
                    const task = genTask(socketList[socketId], thisTask, unixTimestamp);
                    taskQueue[socketId][unixTimestamp] = task;
                    task.batchWork();
                }
            }
        }
    }
}

setInterval(downloadQueue, (1 * 30 * 1000));

function checkSocketAlive() {
    const taskQueueSocketId = Object.keys(taskQueue);
    for (const socketId of taskQueueSocketId) {
        const socketIdTask = Object.values(taskQueue[socketId]) as Task[];
        for (const task of socketIdTask) {
            if (+ new Date() > task.ttl) {
                delete taskQueue[socketId][task.unixTimestamp];
            }
        }
    }
}

setInterval(checkSocketAlive, (Math.ceil(ttlMinute / 2) * 60 * 1000));
