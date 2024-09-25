/*
 * @Description:
 * @Version: 1.0.0
 * @Autor: zenghaoming
 * @Date: 2024-09-25 13:12:18
 * @LastEditors: zenghaoming
 * @LastEditTime: 2024-09-25 13:14:06
 */
function create(f: string) {
  const blob = new Blob(['(' + f + ')()']);
  const url = window.URL.createObjectURL(blob);
  const worker = new Worker(url);
  return worker;
}

export const createIntervalWorker = (callback: any, time: number) => {
  const pollingWorker = create(`function (e) {
    setInterval(function () {
      this.postMessage(null)
    }, ${time})
  }`);
  pollingWorker.onmessage = callback;
  return pollingWorker;
};

export const stopIntervalWorker = (vm: Worker) => {
  try {
    vm && vm?.terminate();
  } catch (err) {
    console.log(err);
  }
};

export const createTimeOutWorker = (callback: any, time: number) => {
  const pollingWorker = create(`function (e) {
    setTimeout(function () {
      this.postMessage(null)
    }, ${time})
  }`);
  pollingWorker.onmessage = callback;
  return pollingWorker;
};

export const stopTimeOutWorker = (vm: Worker) => {
  try {
    vm && vm?.terminate();
  } catch (err) {
    console.log(err);
  }
};
