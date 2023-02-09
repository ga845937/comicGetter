import { IChData, IDm5 } from "../model/dm5";
import { streamDownloadFile, errorHandle } from "./utils";
import config from "../config.json";

import { launch } from "puppeteer";
import { Socket } from "socket.io";
import { mkdirSync } from "fs";
import { join } from "path";

export class Dm5 {
    alive = true;
    socket: Socket;
    unixTimestamp: number;
    ttl: number;
    data: IDm5;
    constructor(socket: Socket, comicUrl: string, unixTimestamp: number) {
        this.socket = socket;
        this.unixTimestamp = unixTimestamp;
        this.ttl = unixTimestamp + (config.ttlMinute * 60 * 1000);
        this.data = {
            comicUrl: comicUrl,
            chList: [],
            chData: [],
            downloadEndIndx: []
        };
    }

    async getChList() {
        try {
            const dm5 = this.data;
            dm5.browser = await launch({
                // headless: false,
                ignoreHTTPSErrors: true
            });

            dm5.page = await dm5.browser.newPage();
            const page = dm5.page;
            await dm5.page.goto(dm5.comicUrl);

            dm5.chList = await page.$$eval("#chapterlistload a[href^=\"/\"]", anchors => anchors.map(a => [a.textContent.split(" ")[0], a.href])) as any;

            const bname = await page.title();
            dm5.bname = bname.split("漫画_")[0];
            dm5.coverUrl = await page.$eval(".banner_detail_form .cover img", img => img.src);

            const chListRes = {
                ttlMinute: config.ttlMinute,
                unixTimestamp: this.unixTimestamp,
                ch_list: dm5.chList
            };
            return chListRes;
        }
        catch (err) {
            errorHandle(this, err);
        }
    }

    async preDownload(chioceChapterIndex: number[]) {
        try {
            const dm5 = this.data;
            for (const chapterIndex of chioceChapterIndex) {
                const chapterName = dm5.chList[chapterIndex][0];
                const pageFolderPath = join(config.rootDir, dm5.bname, chapterName);
                const chDataJSON: IChData = {
                    chapterName: chapterName,
                    chioceChapterIndex: chapterIndex,
                    chUrl: dm5.chList[chapterIndex][1],
                    pageFolderPath: pageFolderPath,
                    imgSrc: [],
                    imgLength: 0,
                    downloadLength: 0
                };
                dm5.chData.push(chDataJSON);
                await mkdirSync(pageFolderPath, { recursive: true });
            }

            const coverRequest = await fetch(dm5.coverUrl);
            const coverPath = join(config.rootDir, dm5.bname, "cover.jpg");
            await streamDownloadFile(coverPath, coverRequest.body);
            return;
        }
        catch (err) {
            errorHandle(this, err);
        }
    }

    async getImgSrc() {
        try {
            const dm5 = this.data;
            const page = this.data.page;

            for (let i = 0; i < dm5.chData.length; i++) {
                const chData = dm5.chData[i];
                await page.goto(chData.chUrl);
                const cid = await page.evaluate("DM5_CID");
                let imgSrc = await this.getImgData(chData.chUrl);
                chData.imgLength = await page.evaluate("DM5_IMAGE_COUNT") as number;
                for (let x = 0; x < chData.imgLength; x++) {
                    if (imgSrc.length === chData.imgLength) {
                        break;
                    }
                    const pageUrl = `${config.dm5Config.baseUrl}/m${cid}-p${imgSrc.length + 1}/`;
                    await page.goto(pageUrl);
                    const nextImgSrc = await this.getImgData(chData.chUrl);
                    imgSrc = imgSrc.concat(nextImgSrc);
                }
                chData.imgSrc = imgSrc.map((url: string, i: number) => [url, i + 1]);
            }
        }
        catch (err) {
            errorHandle(this, err);
        }
    }

    async getImgData(chUrl: string) {
        try {
            const page = this.data.page;
            const chapterfunParams = {
                cid: await page.evaluate("DM5_CID"),
                page: await page.evaluate("DM5_PAGE"),
                key: await page.$eval("#dm5_key", (input) => {
                    return input.getAttribute("value");
                }),
                language: 1,
                gtk: 6,
                _cid: await page.evaluate("DM5_CID"),
                _mid: await page.evaluate("DM5_MID"),
                _dt: await page.evaluate("DM5_VIEWSIGN_DT"),
                _sign: await page.evaluate("DM5_VIEWSIGN")
            };

            const chapterfunUrl = chUrl + "chapterfun.ashx";
            const url = new URL(chapterfunUrl);
            Object.keys(chapterfunParams).forEach(key => url.searchParams.append(key, chapterfunParams[key]));
            const imgEval = await fetch(url, {
                headers: {
                    Referer: chUrl
                }
            });

            const imgSrc = await page.evaluate(await imgEval.text()) as string[];
            return imgSrc;
        }
        catch (err) {
            errorHandle(this, err);
        }
    }

    async download() {
        try {
            const socket = this.socket;
            const dm5 = this.data;
            for (let i = 0; i < dm5.chData.length; i++) {
                const chData = dm5.chData[i];
                for (const imgSrc of chData.imgSrc) {
                    const imgRequest = await fetch(imgSrc[0]);
                    const filePath = join(chData.pageFolderPath, `${imgSrc[1]}.jpg`);
                    await streamDownloadFile(filePath, imgRequest.body);

                    chData.downloadLength++;
                    const downloadChEnd = chData.imgLength === chData.downloadLength ? true : false;
                    if (downloadChEnd) {
                        dm5.downloadEndIndx.push(i);
                    }

                    const downloadInfoRes = {
                        unixTimestamp: this.unixTimestamp,
                        bname: dm5.bname,
                        chioceChapterIndex: chData.chioceChapterIndex,
                        chapterName: chData.chapterName,
                        imgLength: chData.imgLength,
                        downloadLength: chData.downloadLength,
                        downloadChEnd: downloadChEnd
                    };
                    socket.emit("downloadEnd", downloadInfoRes);
                }
            }
            await dm5.browser.close();
        }
        catch (err) {
            errorHandle(this, err);
        }
    }

    async batchWork() {
        try {
            const socket = this.socket;
            const dm5 = this.data;
            await this.getChList();
            const chioceChapterIndex = Array.from({ length: dm5.chList.length }, (num, i) => i);
            socket.emit("status", "建立資料夾中...");
            await this.preDownload(chioceChapterIndex);
            socket.emit("status", "取得圖檔路徑中...");
            await this.getImgSrc();
            socket.emit("status", "下載中...");
            await this.download();
        }
        catch (err) {
            errorHandle(this, err);
        }
    }

    async checkEnd() {
        const dm5 = this.data;
        if (!this.alive) {
            console.log("掛掉");
            return false;
        }
        return dm5.downloadEndIndx.length === dm5.chData.length;
    }
}

export function newDm5(socket: Socket, comicUrl: string, unixTimestamp: number) {
    return new Dm5(socket, comicUrl, unixTimestamp);
}
