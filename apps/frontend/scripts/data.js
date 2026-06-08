window.FailTraceData = {
  bootLines: {
    main: [
      "Initializing FailTrace Core...",
      "Connecting to API layer...",
      "Establishing log pipeline...",
      "Syncing regional nodes...",
      "Mounting trace storage...",
      "Workers online [12/12]...",
      "System ready.",
    ],
    live: [
      "Booting FailTrace Core kernel...",
      "Allocating neural buffers...",
      "Verifying crypto-keys...",
      "Connecting to global API layer...",
      "Syncing distributed edge nodes...",
      "Injecting trace-probes...",
      "Ready to stream.",
    ],
  },
  logStreams: {
    main: {
      endpoints: [
        "/auth/v1/verify",
        "/api/v2/traces",
        "/ws/events",
        "/storage/cdn/query",
        "/metrics/ingest",
      ],
      messages: [
        "Payload validated",
        "Node handshake success",
        "Checksum mismatch at segment 4",
        "Request timeout",
        "Memory burst detected",
        "Cache hit: 98%",
      ],
      errorThreshold: 0.92,
      intervalMs: 800,
    },
    live: {
      endpoints: [
        "/auth/v1/verify",
        "/api/v2/traces",
        "/ws/events",
        "/storage/query",
        "/metrics/ingest",
      ],
      messages: [
        "Handshake success",
        "Buffer overflow prevented",
        "Checksum mismatch",
        "Packet loss detected",
        "Query optimized",
        "Cache hit",
      ],
      errorThreshold: 0.85,
      intervalMs: 520,
    },
  },
};
