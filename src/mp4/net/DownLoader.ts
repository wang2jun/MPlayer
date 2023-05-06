import { Log } from "mp4box";
import { RequestHeader } from "@/types/mp4";
import HTTPRequest from "./HTTPRequest";
import { XHRLoader } from "./XHRLoader";
class DownLoader {
  isActive: boolean = false;
  realtime: boolean = false;
  // chunkStart指的是请求的Chunk在整个文件中的初始偏移量
  chunkStart: number = 0;
  chunkSize: number = 0;
  totalLength: number = 0;
  chunkTimeout: number = 1000;
  timeoutID: number | null = null;
  url: string = "";
  callback: Function = null;
  eof: boolean = false;
  loader: XHRLoader;
  constructor(url?: string) {
    this.url = url || "";
    this.loader = new XHRLoader();
  }

  // 从开头去请求文件，也就是初始化文件的请求过程直到所有文件都请求完成
  start() {
    Log.info("Downloader", "Starting file download");
    this.chunkStart = 0;
    this.resume();
    return this;
  }

  reset() {
    this.chunkStart = 0;
    this.totalLength = 0;
    this.eof = false;
    return this;
  }

  // 调用 window 对象的 clearTimeout 方法，取消之前设置的超时计时器（timeoutID）。
  // 将 timeoutID 置为 null，表示计时器已经被清除。
  // 将 isActive 标记置为 false，表示 DownLoader 实例已经停止运行。
  // 返回当前 DownLoader 实例，以便链式调用。
  stop() {
    window.clearTimeout(this.timeoutID);
    this.timeoutID = null;
    this.isActive = false;
    return this;
  }

  // resume和start不同的是resume可能是在文件的请求暂停后重新设置了chunkStart之后再去重新请求新的chunk
  // 恢复文件下载
  resume() {
    Log.info("Downloader", "Resuming file download");
    this.isActive = true; //DownLoader 实例正在运行。
    if (this.chunkSize === 0) {
      //如果之前设置的每个片段的大小为 0，将片段大小设置为 Infinity，表示下载整个文件。
      this.chunkSize = Infinity;
    }
    this.getFile();
    return this;
  }

  setUrl(_url: string): this {
    this.url = _url;
    return this;
  }

  setRealTime(_realtime: boolean): this {
    this.realtime = _realtime;
    return this;
  }

  setChunkSize(_size: number) {
    this.chunkSize = _size;
    return this;
  }

  setChunkStart(_start: number) {
    this.chunkStart = _start;
    this.eof = false;
    return this;
  }

  setInterval(_timeout: number) {
    this.chunkTimeout = _timeout;
    return this;
  }

  setCallback(_callback: Function) {
    this.callback = _callback;
    return this;
  }

  getFileLength() {
    return this.totalLength;
  }

  isStopped() {
    return !this.isActive;
  }

  initHttpRequest(): HTTPRequest {
    let xhr = new XMLHttpRequest();
    let header: RequestHeader = {};
    (xhr as XMLHttpRequest & { [props: string]: any }).start = this.chunkStart;
    if (this.chunkStart + this.chunkSize < Infinity) {
      let endRange = 0;
      // chunkStart to (chunkStart + chunkSize - 1)
      let range = "bytes=" + this.chunkStart + "-";
      endRange = this.chunkStart + this.chunkSize - 1;
      range += endRange;
      header.Range = range;
    }
    let request = new HTTPRequest({
      url: this.url,
      header: header,
      method: "get",
      xhr: xhr,
    });

    return request;
  }

  /**
   * @description 发送网络请求，请求对应的媒体文件
   * @returns
   */

  getFile() {
    let ctx = this;
    if (this.isStopped()) return; //如果 DownLoader 实例已经被停止，直接返回。
    // eof为true表示整个媒体文件已经请求完毕
    if (ctx.totalLength !== 0 && ctx.chunkStart >= ctx.totalLength) {
      ctx.eof = true;
    }
    if (ctx.eof === true) {
      Log.info("Downloader", "File download done.");
      ctx.callback(null, true);
      return;
    } //如果已经下载完整个媒体文件，执行下载完成的回调函数 callback
    let request = this.initHttpRequest();
    this.loader.load({
      request: request,
      error: error,
      success: success,
    });

    function error(e) {
      ctx.callback(null, false, true);
    }

    function success(res) {
      let xhr = this;
      let rangeReceived = xhr.getResponseHeader("Content-Range");
      if (ctx.totalLength === 0 && rangeReceived) {
        let sizeIndex;
        sizeIndex = rangeReceived.indexOf("/");
        if (sizeIndex > -1) {
          ctx.totalLength = +rangeReceived.slice(sizeIndex + 1);
        }
      }
      ctx.eof =
        xhr.response.byteLength !== ctx.chunkSize ||
        xhr.response.byteLength === ctx.totalLength;
      // 定义成功回调函数 success，首先获取服务器返回的 Content-Range 响应头
      // 如果之前没有获取到文件总长度，从 Content-Range 中获取
      // 然后判断是否已经下载完整个文件，更新 eof 标记。
      let buffer = xhr.response;
      buffer.fileStart = xhr.start;
      // 将下载的数据存储到 buffer 中，并将文件起始位置 fileStart 存储到 buffer 的属性中
      // 拿到数据之后执行回调函数
      ctx.callback(buffer, ctx.eof);
      // 如果下载器还是处于激活状态且还没全部下载完成的话
      // 设置超时计时器，调用 getFile 方法下载下一个片段
      if (ctx.isActive === true && ctx.eof === false) {
        let timeoutDuration = ctx.chunkTimeout;
        ctx.timeoutID = window.setTimeout(
          ctx.getFile.bind(ctx),
          timeoutDuration
        );
      }
    }
  }
}

export { DownLoader };
