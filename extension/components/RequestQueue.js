// requestQueue.js
export class RequestQueue {
  constructor() {
    this.queues = new Map();
  }

  enqueue(key, task) {
    const prev = this.queues.get(key) || Promise.resolve();
    const next = prev.then(() => task()).catch(console.warn);
    this.queues.set(key, next);
    return next;
  }

  isIdle(key) {
    const queue = this.queues.get(key);
    return !queue || queue === Promise.resolve();
  }

  async waitUntilIdle(key) {
    const queue = this.queues.get(key);
    if (queue) await queue;
  }

  clear(key) {
    this.queues.delete(key);
  }
}
