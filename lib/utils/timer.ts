/*
 * @Description: 
 * @Version: 1.0.0
 * @Autor: zenghaoming
 * @Date: 2024-09-25 13:12:18
 * @LastEditors: zenghaoming
 * @LastEditTime: 2024-09-25 13:14:08
 */
import { createIntervalWorker, stopIntervalWorker, createTimeOutWorker, stopTimeOutWorker } from './webWorker';

export default class Timer<T = any> {
  private _storage: any;
  private _mode: 'worker' | 'web';
  //
  constructor(props: {
    storage: {
      [key in string]: NodeJS.Timer | Worker | null;
    };
    mode: 'worker' | 'web';
  }) {
    const { storage = {}, mode = 'web' } = props || {};
    //
    this._storage = storage;
    this._mode = mode;
  }
  public setInterval(fn: () => void, config: { time: number; storageName?: T }): NodeJS.Timer | Worker {
    const { storageName, time = 0 } = config || {};
    const storage = this._storage;
    // 清楚原有的
    storageName && storage[storageName] && this.clearInterval(storageName);
    // 创建定时器
    const client = this._mode === 'worker' ? createIntervalWorker(fn, time) : setInterval(fn, time);
    if (storageName) {
      // 赋值新的
      storage[storageName] = client;
    }
    return client;
  }
  public clearInterval(key: T | NodeJS.Timer | Worker) {
    const storage = this._storage;
    let interval;
    if (typeof key === 'string') {
      interval = storage[key];
    } else {
      interval = key;
    }
    if (this._mode === 'worker') {
      stopIntervalWorker(interval);
    } else {
      clearInterval(interval);
    }
    //
    if (typeof key === 'string' && storage[key]) {
      storage[key] = null;
    }
  }

  //
  public setTimeout(fn: () => void, config: { time: number; storageName?: T }): NodeJS.Timer | Worker {
    //
    const storage = this._storage;
    const { storageName, time = 0 } = config || {};
    // 清楚原有的
    storageName && storage[storageName] && this.clearTimeOut(storageName);
    let client: NodeJS.Timer | Worker | null = null;
    // 定时器回调
    const callback = async () => {
      await fn();
      // 回调完毕后清楚worker
      if (this._mode === 'worker') {
        stopTimeOutWorker(client as Worker);
      }
      // 回调完毕后清楚存储器
      if (storageName) {
        storage[storageName] = null;
      }
    };
    // 创建定时器
    client = this._mode === 'worker' ? createTimeOutWorker(callback, time) : setTimeout(callback, time);
    //
    if (storageName) {
      // 赋值新的
      storage[storageName] = client;
    }
    return client;
  }

  //
  public clearTimeOut(key: T | NodeJS.Timer | Worker) {
    let interval;
    const storage = this._storage;
    if (typeof key === 'string') {
      interval = storage[key];
    } else {
      interval = key;
    }
    if (this._mode === 'worker') {
      stopTimeOutWorker(interval);
    } else {
      clearTimeout(interval);
    }
    //
    if (typeof key === 'string' && storage[key]) {
      storage[key] = null;
    }
  }
}
