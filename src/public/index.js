const websocket = io();
let ttlList = {}

function sned() {
    const comicWeb = $("#comicWeb").val();
    const comicUrl = $("#comicUrl").val();

    switch (comicWeb) {
        case "cartoonmad":
            if (!comicUrl.startsWith("https://www.cartoonmad.com/comic/")) {
                alert("網址錯誤")
                return false;
            }
            break;
        case "dm5":
            if (!comicUrl.startsWith("https://www.dm5.cn/")) {
                alert("網址錯誤")
                return false;
            }
            break;
        default:
            alert("網站選擇錯誤")
            return false;
    }

    const rtn = {
        comicWeb: $("#comicWeb").val(),
        comicUrl: $("#comicUrl").val()
    }

    websocket.emit('getChList', rtn);
}

let chListA
websocket.on("sendChList", function (chList) {
    console.log(chList)
    chListA = chList
})

function download() {
    console.log(chListA);
    ttlList[chListA.unixTimestamp] = setInterval(websocket.emit('updateTTL', chListA.unixTimestamp), (chListA.ttlMinute * 60 * 1000));
    const rtn = {
        unixTimestamp: chListA.unixTimestamp,
        chioceChapterIndex: [0]
    }
    websocket.emit('download', rtn);
}

websocket.on("status", function (status) {
    console.log(status)
})

websocket.on("downloadEnd", function (chData) {
    console.log(chData)
    if (chData.downloadChEnd) {
        clearInterval(ttlList[chData.unixTimestamp]);
        websocket.emit('deleteTask', chData.unixTimestamp);
        console.log(`${chData.bname} - ${chData.chapterName} 下載完成`)
    }
})

function batchWork() {
    const rtn = [
        {
            comicWeb: $("#comicWeb").val(),
            comicUrl: $("#comicUrl").val()
        }
    ]
    /*
    ,
          {
            comicWeb: $("#comicWeb").val(),
            comicUrl: "https://www.dm5.cn/manhua--dongbeijunzisige-hejunjiangyiqi/"
          }
    */
    websocket.emit('batchWork', rtn);
}

websocket.on("sendBatch", function () {
    alert("批次清單建立完成")
})

websocket.on("errorHandle", function (err) {
    console.error(err);
    websocket.emit('deleteTask', err.unixTimestamp);
})
