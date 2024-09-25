/*
 * @Description: 
 * @Version: 1.0.0
 * @Autor: zenghaoming
 * @Date: 2024-09-25 13:12:18
 * @LastEditors: zenghaoming
 * @LastEditTime: 2024-09-25 13:14:10
 */
export interface WebsocketConstructorInterface {
  url?: string;
  heartbeat?: {
    time?: number;
    timeOutCont?: number;
    pingMsg?: string | ArrayBufferLike | Blob | ArrayBufferView;
    pongMsg?: string | ArrayBufferLike | Blob | ArrayBufferView;
  };
  reconnectTime?: number;
  autoConnect?: boolean;
}

export enum MsgLogEnum {
  'send' = 'send',
  'receive' = 'receive',
}

export interface MsgLogInterface {
  id: string;
  time: string;
  msg: string | ArrayBufferLike | Blob | ArrayBufferView;
  type: MsgLogEnum;
}
