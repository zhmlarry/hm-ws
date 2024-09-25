import { type WebsocketConstructorInterface, type MsgLogInterface, MsgLogEnum } from './types';
import Timer from './utils/timer';

interface _OnEventMapInterface {
  onopen: Event;
  onclose: CloseEvent;
  onerror: Event;
  onmessage: MessageEvent;
  onDisConnect: any;
}

// console打印
const _consoleLog = (...arg: any) => {
  console.log(new Date().toLocaleString(), ...arg);
};
const _consoleError = (...arg: any) => {
  console.error(new Date().toLocaleString(), ...arg);
};
//

// 定时器配置
const _intervalStorage: {
  heartbeatInterval: NodeJS.Timer | Worker | null; // 心跳的定时
  heartbeatTimeOut: NodeJS.Timer | Worker | null; // 心跳超时的定时器
  reconnectTimeOut: NodeJS.Timer | Worker | null; // 重连的延时器，主要用来做防抖，防止同一时间触发重连次数过多重复调用
} = {
  heartbeatInterval: null,
  heartbeatTimeOut: null,
  reconnectTimeOut: null,
};

//

export class TwWebsocket {
  // 是否连接上
  public isConnect: boolean;
  // WebSocket
  public ws: WebSocket;
  // WebSocket地址
  private _url: string;
  private _closeCode: number;
  public heartbeat: {
    time: number;
    timeOutCont: number;
    pingMsg: string | ArrayBufferLike | Blob | ArrayBufferView;
    pongMsg: string | ArrayBufferLike | Blob | ArrayBufferView;
    _outCount: number; // 心跳超时计数
  };
  // 重连的延迟时间，主要用来做防抖，防止同一时间触发重连次数过多重复调用 等于0则不触发重连（毫秒）
  public reconnectTime: number;
  // 消息缓存
  private _msgLog: Array<MsgLogInterface>;
  // 兼容单例
  private static _instance: TwWebsocket;
  //
  private _onEventMap: {
    [key in keyof _OnEventMapInterface]?: Array<(e: _OnEventMapInterface[key]) => void>;
  };
  //
  private timer: Timer;
  //
  constructor(props: WebsocketConstructorInterface) {
    const { url = '', reconnectTime = 3000, autoConnect = false, heartbeat = {} } = props || {};
    this._url = url;
    this.ws = null as any;
    //
    const { time = 1000 * 3, timeOutCont = 0, pingMsg = 'ping', pongMsg = 'pong' } = heartbeat;
    this.heartbeat = {
      time,
      timeOutCont,
      pingMsg,
      pongMsg,
      _outCount: 0,
    };
    //
    this.timer = new Timer<keyof typeof _intervalStorage>({
      storage: {
        ..._intervalStorage,
      },
      mode: 'worker',
    });
    //
    this.reconnectTime = reconnectTime;
    this._msgLog = [];
    this.isConnect = false;
    this._onEventMap = {};
    this._closeCode = 0;
    autoConnect && this.connect();
    TwWebsocket._instance = this;
  }

  /**
   * 事件监听
   * @param name
   * @param fn
   */
  public on<T extends keyof _OnEventMapInterface, K extends _OnEventMapInterface[T]>(name: T, fn: (e: K) => void) {
    if (this._onEventMap[name]) {
      this._onEventMap[name]?.push(fn as any);
    } else {
      (this._onEventMap as any)[name] = [fn];
    }
  }
  // 移除对应事件的所有事件（慎用）
  public off<T extends keyof _OnEventMapInterface>(name: T) {
    this._onEventMap[name] = [];
  }
  private _emit<T extends keyof _OnEventMapInterface, K extends _OnEventMapInterface[T]>(name: T, data?: K) {
    const fn = this._onEventMap[name] || [];
    fn.forEach((item) => item(data));
  }

  // 连接
  public connect(config?: {
    onopen?: (event: Event) => void;
    onclose?: (event: CloseEvent) => void;
    onerror?: (event: Event) => void;
    onmessage?: (event: MessageEvent) => void;
    url?: string;
  }) {
    return new Promise((resolve, reject) => {
      this._url = config?.url || this._url;
      this.ws = new WebSocket(this._url);
      // 连接成功建立的回调方法
      this.ws.onopen = async (e) => {
        // _consoleLog('websocket连接成功', e );
        this.isConnect = true;
        this._closeCode = 0;
        //
        this._emit('onopen', e);
        config?.onopen && (await config.onopen(e));
        // 心跳
        this.beganHeartbeat();
        //
        resolve(e);
      };

      // 连接关闭的回调方法
      this.ws.onclose = async (e) => {
        this.ws = null as any;
        this.isConnect = false;
        //
        this._emit('onclose', e);
        config?.onclose && (await config.onclose(e));
        if (this._closeCode === 4000 || e.code === 4000) {
          this.close();
          _consoleLog('正常关闭!', e);
        } else {
          _consoleError('websocket非正常关闭!!!', e, this._url);
          this.close(e.code);
          e.reason !== '401' && this._disconnectConnect();
        }
      };
      // 连接发生错误的回调方法
      this.ws.onerror = async (e) => {
        // console.error('websocket连接错误!', e)
        this.isConnect = false;
        //
        this._emit('onerror', e);
        config?.onerror && (await config.onerror(e));
        //
        this._disconnectConnect();
        _consoleError(this._url + ' websocket连接异常!!!', e);
        reject(e);
      };

      // 接收到消息的回调方法
      this.ws.onmessage = (event) => {
        // 心跳消息
        if (this.heartbeat.pongMsg && event.data === this.heartbeat.pongMsg) {
          this.timer.clearTimeOut('heartbeatTimeOut');
          this.heartbeat._outCount = 0;
          _consoleLog('心跳响应成功', this.heartbeat.pongMsg.toString());
          return;
        }
        //
        this._emit('onmessage', event);
        config?.onmessage && config.onmessage(event);
        // _consoleLog(this._url,'接收到消息:' + event.data);
        // 插入消息日志
        this._insertMsgLog({
          id: Date.now() + '',
          time: new Date().toLocaleString(),
          msg: event.data,
          type: MsgLogEnum.receive,
        });
      };

      // 监听窗口关闭事件，当窗口关闭时，主动去关闭websocket连接，防止连接还没断开就关闭窗口，server端会抛异常。
      window.addEventListener('beforeunload', () => {
        this.close();
      });
    });
  }
  // 手动断开在重连
  public reconnect() {
    this.close();
    this.connect();
  }
  // 系统断线重连
  private _disconnectConnect() {
    this.timer.clearTimeOut('reconnectTimeOut');
    if (!this.reconnectTime) return;
    const fn = async () => {
      _consoleLog(this._url, 'websocket正在重连...');
      this._emit('onDisConnect');
      this.connect();
    };
    //
    this.timer.setTimeout(fn, {
      time: this.reconnectTime,
      storageName: 'reconnectTimeOut',
    });
  }

  // 关闭(内含清楚状态以及定时器等逻辑)
  public close(code = 4000) {
    this.stopHeartbeat();
    this.isConnect = false;
    this.heartbeat._outCount = 0;
    this._closeCode = code;
    //
    this.ws?.close(code);
  }
  // 发送消息
  public send(msg: string | ArrayBufferLike | Blob | ArrayBufferView) {
    this.isConnect && this.ws?.send(msg);
    // 插入消息日志
    this._insertMsgLog({
      id: Date.now() + '',
      time: new Date().toLocaleString(),
      msg,
      type: MsgLogEnum.send,
    });
  }

  // 开始心跳
  public beganHeartbeat() {
    this.timer.clearInterval('heartbeatInterval');
    if (!this.heartbeat.time || !this.heartbeat.pingMsg) {
      return;
    }
    const fn = () => {
      // _consoleLog(' 开始心跳', this.heartbeat.pingMsg.toString());
      this.send(this.heartbeat.pingMsg);
      //
      // 心跳超时
      if (this.heartbeat.timeOutCont <= 0 || !this.heartbeat.pongMsg) {
        return;
      }
      this.timer.setTimeout(
        () => {
          this.heartbeat._outCount++;
          _consoleError(this._url + ' 心跳超时' + this.heartbeat._outCount + '次');
          if (this.heartbeat._outCount >= this.heartbeat.timeOutCont) {
            _consoleError(this._url + ' 心跳超时过多，即将断开');
            this.close();
            this.reconnect();
          }
        },
        {
          time: this.heartbeat.time - 500,
          storageName: 'heartbeatTimeOut',
        }
      );
    };
    //
    //
    fn();
    this.timer.setInterval(fn, {
      time: this.heartbeat.time,
      storageName: 'heartbeatInterval',
    });
  }
  // 停止心跳
  public stopHeartbeat() {
    this.timer.clearInterval('heartbeatInterval');
    this.timer.clearInterval('heartbeatInterval');
  }
  // 插入日志
  private _insertMsgLog(data: MsgLogInterface) {
    // if () {
    this._msgLog.length > 100 && this._msgLog.pop();
    // }
    this._msgLog.unshift(data);
  }

  // 兼容单例
  public static getInstance(props: WebsocketConstructorInterface) {
    if (!TwWebsocket._instance) {
      TwWebsocket._instance = new TwWebsocket(props);
    }
    return TwWebsocket._instance;
  }
}
