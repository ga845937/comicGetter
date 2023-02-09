export interface IChData {
    chapterName: string,
    chioceChapterIndex: number,
    chUrl: string,
    pageFolderPath: string,
    imgSrc: [string, number][],
    imgLength: number,
    downloadLength: number
}

export interface ICartoonmad {
    comicUrl: string,
    bname?: string,
    coverUrl?: string,
    chList?: [string, string][],
    chData?: IChData[],
    downloadEndIndx: number[]
}
