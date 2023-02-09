import { Task } from "../model/comicRequest";

import { createWriteStream, appendFileSync } from "fs";
import { Readable } from "stream";
import { finished } from "stream/promises";

async function streamDownloadFile(filePath: string, data: ReadableStream<Uint8Array>) {
    const writeStream = createWriteStream(filePath);
    const body = Readable.fromWeb(data as any);
    await finished(body.pipe(writeStream));
}

async function errorHandle(task: Task, err: Error) {
    console.error(err);
    await appendFileSync("./error.log", `${+new Date()} : ${err.stack}\n`);
    const res = {
        unixTimestamp: task.unixTimestamp,
        err: err.message
    };
    task.socket.emit("errorHandle", res);
}
export {
    streamDownloadFile,
    errorHandle
};
