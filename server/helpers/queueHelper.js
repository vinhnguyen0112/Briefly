// services/queueService.js
const { Queue, Worker, QueueEvents } = require("bullmq");
const Redis = require("ioredis");

class QueueHelper {
  constructor() {
    this.connection = null;
    this.queues = {};
    this.workers = {};
    this.queueEvents = {};
  }

  /**
   * Initialize Redis connection for BullMQ
   * @param {Object} redisConfig Redis configuration
   */
  initialize(redisConfig = {}) {
    this.connection = new Redis({
      host: redisConfig.host || process.env.REDIS_HOST || "localhost",
      port: redisConfig.port || process.env.REDIS_PORT || 6379,
      password: redisConfig.password || process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    this.connection.on("error", (err) => {
      console.error("Redis connection error:", err);
    });

    this.connection.on("connect", () => {
      console.log("Redis connected for BullMQ");
    });
  }

  /**
   * Create or get a queue
   * @param {string} queueName Name of the queue
   * @param {Object} options Queue options
   * @returns {Queue} BullMQ Queue instance
   */
  getQueue(queueName, options = {}) {
    if (!this.queues[queueName]) {
      this.queues[queueName] = new Queue(queueName, {
        connection: this.connection,
        defaultJobOptions: {
          removeOnComplete: true,
          removeOnFail: false,
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 2000,
          },
          ...options.defaultJobOptions,
        },
        ...options,
      });
    }
    return this.queues[queueName];
  }

  /**
   * Create or get a worker for a queue
   * @param {string} queueName Name of the queue
   * @param {Function} processor Job processor function
   * @param {Object} options Worker options
   * @returns {Worker} BullMQ Worker instance
   */
  createWorker(queueName, processor, options = {}) {
    if (!this.workers[queueName]) {
      this.workers[queueName] = new Worker(queueName, processor, {
        connection: this.connection,
        concurrency: options.concurrency || 5,
        ...options,
      });

      this.workers[queueName].on("completed", (job) => {
        console.log(`Job ${job.id} completed in queue ${queueName}`);
      });

      this.workers[queueName].on("failed", (job, err) => {
        console.error(`Job ${job.id} failed in queue ${queueName}:`, err);
      });
    }
    return this.workers[queueName];
  }

  /**
   * Get queue events for monitoring
   * @param {string} queueName Name of the queue
   * @returns {QueueEvents} BullMQ QueueEvents instance
   */
  getQueueEvents(queueName) {
    if (!this.queueEvents[queueName]) {
      this.queueEvents[queueName] = new QueueEvents(queueName, {
        connection: this.connection,
      });
    }
    return this.queueEvents[queueName];
  }

  /**
   * Add a job to a queue
   * @param {string} queueName Name of the queue
   * @param {string} jobName Name of the job
   * @param {Object} data Job data
   * @param {Object} options Job options
   * @returns {Promise<Job>} Created job
   */
  async addJob(queueName, jobName, data, options = {}) {
    const queue = this.getQueue(queueName);
    return await queue.add(jobName, data, options);
  }

  /**
   * Gracefully shutdown all queues and workers
   */
  async shutdown() {
    console.log("Shutting down queue service...");

    // Close all workers
    await Promise.all(
      Object.values(this.workers).map((worker) => worker.close())
    );

    // Close all queue events
    await Promise.all(
      Object.values(this.queueEvents).map((events) => events.close())
    );

    // Close all queues
    await Promise.all(Object.values(this.queues).map((queue) => queue.close()));

    // Close Redis connection
    if (this.connection) {
      await this.connection.quit();
    }

    console.log("Queue service shutdown complete");
  }
}

// Create singleton instance
const QueueHelper = new QueueHelper();

module.exports = QueueHelper;
