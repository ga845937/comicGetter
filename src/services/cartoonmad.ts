import { IChData, ICartoonmad } from "../model/cartoonmad";
import { streamDownloadFile, errorHandle } from "./utils";
import config from "../config.json";

import { load } from "cheerio";
import { Socket } from "socket.io";
import { mkdirSync } from "fs";
import { join } from "path";

const headers = {
    Referer: config.cartoonmadConfig.refererUrl
};

export class Cartoonmad {
    alive = true;
    socket: Socket;
    unixTimestamp: number;
    ttl: number;
    data: ICartoonmad;
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
            const cartoonmadData = this.data;
            const request = await fetch(cartoonmadData.comicUrl);
            const pageData = new TextDecoder("big5").decode(await request.arrayBuffer());
            const $ = load(pageData);

            cartoonmadData.bname = $("title").text().split(" ")[0];
            $("#info a[href^=\"/comic/\"]").each((i, ele) => {
                if ($(ele).text().includes("話")) {
                    cartoonmadData.chList.push([$(ele).text(), $(ele).attr("href")]);
                }
            });
            cartoonmadData.coverUrl = cartoonmadData.comicUrl.replace("comic/", "cartoonimg/coimg/").replace(".html", ".jpg");

            const chListRes = {
                ttlMinute: config.ttlMinute,
                unixTimestamp: this.unixTimestamp,
                ch_list: cartoonmadData.chList
            };
            return chListRes;
        }
        catch (err) {
            errorHandle(this, err);
        }
    }

    async preDownload(chioceChapterIndex: number[]) {
        try {
            const cartoonmadData = this.data;
            for (const chapterIndex of chioceChapterIndex) {
                const chapterName = cartoonmadData.chList[chapterIndex][0];
                const pageFolderPath = join(config.rootDir, cartoonmadData.bname, chapterName);
                const chDataJSON: IChData = {
                    chapterName: chapterName,
                    chioceChapterIndex: chapterIndex,
                    chUrl: config.cartoonmadConfig.baseUrl + cartoonmadData.chList[chapterIndex][1],
                    pageFolderPath: pageFolderPath,
                    imgSrc: [],
                    imgLength: 0,
                    downloadLength: 0
                };
                cartoonmadData.chData.push(chDataJSON);
                await mkdirSync(pageFolderPath, { recursive: true });
            }

            const coverRequest = await fetch(cartoonmadData.coverUrl);
            const coverPath = join(config.rootDir, cartoonmadData.bname, "cover.jpg");
            await streamDownloadFile(coverPath, coverRequest.body);
            return;
        }
        catch (err) {
            errorHandle(this, err);
        }
    }

    async getImgSrc() {
        try {
            const cartoonmadData = this.data;
            for (const chData of cartoonmadData.chData) {
                const request = await fetch(chData.chUrl, { headers });
                const chPageData = new TextDecoder("big5").decode(await request.arrayBuffer());
                const $ = load(chPageData);
                const imgSrc = $("option[value]").toArray().map(ele => config.cartoonmadConfig.page_baseUrl + $(ele).val());
                chData.imgLength = imgSrc.length;
                for (let i = 0; i < imgSrc.length; i++) {
                    const imgUrl = await this.getImgData(imgSrc[i]);
                    chData.imgSrc.push([imgUrl, i + 1]);
                }
            }
            return;
        }
        catch (err) {
            errorHandle(this, err);
        }
    }

    async getImgData(imgSrc: string) {
        try {
            const request = await fetch(imgSrc, { headers });
            const pageData = new TextDecoder("big5").decode(await request.arrayBuffer());
            const $ = load(pageData);
            const imgUrl = $(`img[src^="${config.cartoonmadConfig.refererUrl}comicpic.asp"]`).attr("src") as string;
            return imgUrl;
        }
        catch (err) {
            errorHandle(this, err);
        }
    }

    async download() {
        try {
            const socket = this.socket;
            const cartoonmadData = this.data;
            for (let i = 0; i < cartoonmadData.chData.length; i++) {
                const chData = cartoonmadData.chData[i];
                for (const imgSrc of chData.imgSrc) {
                    const imgRequest = await fetch(imgSrc[0]);
                    const filePath = join(chData.pageFolderPath, `${imgSrc[1]}.jpg`);
                    await streamDownloadFile(filePath, imgRequest.body);

                    chData.downloadLength++;
                    const downloadChEnd = chData.imgLength === chData.downloadLength ? true : false;
                    if (downloadChEnd) {
                        cartoonmadData.downloadEndIndx.push(i);
                    }

                    const downloadInfoRes = {
                        unixTimestamp: this.unixTimestamp,
                        bname: cartoonmadData.bname,
                        chioceChapterIndex: chData.chioceChapterIndex,
                        chapterName: chData.chapterName,
                        imgLength: chData.imgLength,
                        downloadLength: chData.downloadLength,
                        downloadChEnd: downloadChEnd
                    };
                    socket.emit("downloadEnd", downloadInfoRes);
                }
            }
            return;
        }
        catch (err) {
            errorHandle(this, err);
        }
    }

    async batchWork() {
        try {
            const socket = this.socket;
            const cartoonmadData = this.data;
            await this.getChList();
            const chioceChapterIndex = Array.from({ length: cartoonmadData.chList.length }, (num, i) => i);
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
        const cartoonmadData = this.data;
        if (!this.alive) {
            return false;
        }
        return cartoonmadData.downloadEndIndx.length === cartoonmadData.chData.length;
    }
}

export function newCartoonmad(socket: Socket, comicUrl: string, unixTimestamp: number) {
    return new Cartoonmad(socket, comicUrl, unixTimestamp);
}
