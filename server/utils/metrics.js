const client = require("prom-client");

// single registry for the whole app
const register = new client.Registry();

// collect node process and runtime metrics
client.collectDefaultMetrics({ register });

// llm metrics (provider-agnostic, focus openai for now)
const llmRequestsTotal = new client.Counter({
  name: "llm_requests_total",
  help: "total llm requests",
  labelNames: ["provider", "model", "endpoint", "status"],
  registers: [register],
});

const llmRequestDurationSeconds = new client.Histogram({
  name: "llm_request_duration_seconds",
  help: "llm request duration in seconds",
  labelNames: ["provider", "model", "endpoint"],
  // generous buckets to cover networked API latencies
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 20, 60],
  registers: [register],
});

// db metrics (mysql)
const dbQueriesTotal = new client.Counter({
  name: "db_queries_total",
  help: "total db queries executed",
  labelNames: ["operation"],
  registers: [register],
});

const dbQueryErrorsTotal = new client.Counter({
  name: "db_query_errors_total",
  help: "total db query errors",
  labelNames: ["operation"],
  registers: [register],
});

const dbQueryDurationSeconds = new client.Histogram({
  name: "db_query_duration_seconds",
  help: "db query duration in seconds",
  labelNames: ["operation"],
  // fast in-process sql usually sub-second but include longer tails
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

// RAG metrics
const ragOperationsTotal = new client.Counter({
  name: "rag_operations_total",
  help: "total rag operations",
  labelNames: ["operation", "status"],
  registers: [register],
});

const ragOperationDurationSeconds = new client.Histogram({
  name: "rag_operation_duration_seconds",
  help: "rag operation duration in seconds",
  labelNames: ["operation"],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

// ChromaDB metrics
const chromaOperationsTotal = new client.Counter({
  name: "chroma_operations_total",
  help: "total chromadb operations",
  labelNames: ["operation", "status"],
  registers: [register],
});

const chromaOperationDurationSeconds = new client.Histogram({
  name: "chroma_operation_duration_seconds",
  help: "chromadb operation duration in seconds",
  labelNames: ["operation"],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [register],
});

// HTTP metrics
const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "total http requests",
  labelNames: ["method", "route", "status"],
  registers: [register],
});

const httpRequestDurationSeconds = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "http request duration in seconds",
  labelNames: ["method", "route"],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

module.exports = {
  client,
  register,
  llmRequestsTotal,
  llmRequestDurationSeconds,
  dbQueriesTotal,
  dbQueryErrorsTotal,
  dbQueryDurationSeconds,
  ragOperationsTotal,
  ragOperationDurationSeconds,
  chromaOperationsTotal,
  chromaOperationDurationSeconds,
  httpRequestsTotal,
  httpRequestDurationSeconds,
};
