import { Browser, Page } from "puppeteer";

export interface IChData {
    chapterName: string,
    chioceChapterIndex: number,
    chUrl: string,
    pageFolderPath: string,
    imgSrc: [string, number][],
    imgLength: number,
    downloadLength: number
}

export interface IDm5 {
    comicUrl: string,
    browser?: Browser,
    page?: Page,
    bname?: string,
    coverUrl?: string,
    chList?: [string, string][],
    chData?: IChData[],
    downloadEndIndx: number[]
}

export interface IDownloadInfo {
    unixTimestamp: number,
    bname: string,
    chapterName: string,
    chioceChapterIndex: number,
    imgLength: number,
    downloadLength: number,
    downloadChEnd: boolean,
    compeleteTask: boolean
}
