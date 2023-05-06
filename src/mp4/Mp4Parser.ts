import { Player } from "@/page/player";
import MP4Box, { MP4ArrayBuffer, MP4File } from "mp4box";
import { Video } from "..";
import { DownLoader } from "./net/DownLoader";
import { EVENT } from "@/events";
export class Mp4Parser {
  url: string;
  player: Player;
  mp4boxfile: MP4File;
  downloader: DownLoader;
  constructor(url: string, player: Player) {
    this.url = url;
    this.player = player;
    this.mp4boxfile = MP4Box.createFile();
    this.downloader = new DownLoader(url);
    this.init();
  }

  init() {
    this.initEvent();
    this.loadFile();
  }

  initEvent() {
    // MP4 文件解析完成后被调用
    this.mp4boxfile.onReady = (info) => {
      this.stop();
      let videoInfo: Video = {
        url: this.url,
        lastUpdateTime: info.modified,
        videoCodec: info.tracks[0].codec,
        audioCodec: info.tracks[1].codec,
        isFragmented: info.isFragmented,
        width: info.tracks[0].track_width,
        height: info.tracks[0].track_height,
      };
      // 据解析出来的 MP4 文件信息，构造一个 Video 对象，包括视频的基本信息，
      // 如 URL、最后更新时间、视频编码格式、音频编码格式、是否分片、视频宽度和高度等
      this.player.setVideoInfo(videoInfo);
      this.player.emit(EVENT.MOOV_PARSE_READY); // 表示 MP4 文件的 moov box 解析已经完成。
    };
  }

  //停止当前还在发送中的http请求
  stop() {
    if (!this.downloader.isStopped()) {
      this.downloader.stop();
    }
  }

  /**
   * @description 开始请求加载mp4文件
   */
  loadFile() {
    let ctx = this;
    // 先写死，之后在修改
    this.downloader.setInterval(500);
    this.downloader.setChunkSize(1000000);
    this.downloader.setUrl(this.url);
    this.downloader.setCallback(
      // end表示这一次的请求是否已经将整个视频文件加载过来
      function (response: MP4ArrayBuffer, end: boolean, error: any) {
        var nextStart = 0;
        if (response) {
          // 设置文件加载的进度条
          // console.log(response)
          nextStart = ctx.mp4boxfile.appendBuffer(response, end); //获取下一个请求的起始位置。
        }
        if (end) {
          // 如果存在end的话则意味着所有的chunk已经加载完毕
          ctx.mp4boxfile.flush(); // 刷新 MP4 文件解析器缓存，表示文件已经解析完毕。
        } else {
          ctx.downloader.setChunkStart(nextStart);
        }
        if (error) {
          //TODO 待定
        }
      }
    );

    this.downloader.start();
  }
}
