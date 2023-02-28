import { Cartoonmad } from "../services/cartoonmad";
import { Dm5 } from "../services/dm5";

export type Task = Cartoonmad | Dm5;

export interface ComicRequest {
    comicWeb: "cartoonmad" | "dm5",
    comicUrl: string,
    memo?: string,
    downloadEnd: boolean
}

export interface DownloadRequest {
    unixTimestamp: number,
    chioceChapterIndex: number[],
}
