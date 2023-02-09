<h1 align="center">comicGetter</h1>

:warning: 目前僅完成後端<br>

僅供學術交流<br><br>

[Dm5](https://www.dm5.cn/) 及 [動漫狂](https://www.cartoonmad.com/) 爬蟲<br>

預設下載目錄: ./comic<br>
更改方式 開啟 ./src/config.json (文字檔開啟即可)<br>
rootDir 後方改成你要的路徑<br>
:warning: 如果Windows直接複製資料夾路徑 反斜線要注意都要再多加一個
```bash
    {
        "rootDir" : "Z:\\test\\cool"
    }
```

## 源碼運行
NPM ^9.3.1<br>
NodeJS ^18.14.0<br>
TypeScript ^4.9.5<br>

下載
```bash
git clone https://github.com/ga845937/comicGetter.git
```

安裝
```bash
cd comicGetter
npm i
```

運行
```bash
Command--
    npm run start

Vscode--
    開啟專案 直接F5執行即可
```

預設Port: 3000<br>
更改方式 開啟 ./src/config.json (文字檔開啟即可)<br>
httpPort 數字改成要監聽的port即可<br>
使用
```bash
瀏覽器--
    http://localhost:3000/
```
