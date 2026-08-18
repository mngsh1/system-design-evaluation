/**
 * ProblemEngine - Generates and manages System Design Interview problems.
 */
import { LLMService } from './llm.js';
import { PromptRegistry } from './prompts.js';

export const CURATED_PROBLEMS = [
  {
    id: "curated_uber_dispatch",
    title: "Global Ride-Hailing Match & Real-Time Dispatch System",
    shortDescription: "Design a real-time ride-matching and geospatial tracking engine like Uber/Lyft handling millions of concurrent riders and drivers.",
    vaguePrompt: "We need you to design the real-time ride-matching and dispatch system for a global ride-hailing platform. Drivers continuously send their GPS locations every 4 seconds, and riders submit trip requests that must be matched with the nearest available driver within 10 seconds. Walk me through how you would architect this.",
    level: "Senior",
    category: "Real-time & Geospatial",
    scaleMetrics: {
      dau: "50M Active Users",
      qps: "1.2M Driver Location Updates/sec",
      latency: "p99 < 200ms match response",
      storage: "10 TB location telemetry/day"
    },
    keyFocus: ["Geospatial Indexing (H3/S2)", "WebSocket Gateway", "Driver State Machine", "Location Ingestion Pipeline"]
  },
  {
    id: "curated_multi_region_payment",
    title: "Multi-Region Distributed Payment Gateway with Strict Idempotency",
    shortDescription: "Design a mission-critical, double-entry financial ledger and payment processing system with zero loss and zero double-charge guarantee.",
    vaguePrompt: "Design an international payment processing gateway like Stripe that connects merchants with banking rails across North America, Europe, and APAC. The system must guarantee exactly-once payment processing, 99.999% availability, and maintain a verifiable double-entry ledger.",
    level: "Staff",
    category: "FinTech & Distributed Consensus",
    scaleMetrics: {
      dau: "100M Transactions/day",
      qps: "50K peak write QPS",
      latency: "p99 < 150ms processing",
      storage: "Immutable Append-Only Ledger"
    },
    keyFocus: ["Two-Phase Commit / Saga", "Idempotency Keys", "Multi-Region Active-Active", "Double-Entry Ledger"]
  },
  {
    id: "curated_distributed_cache",
    title: "Distributed In-Memory Key-Value Store with Consistent Hashing",
    shortDescription: "Design a distributed in-memory cache clustering system like Redis/Memcached with automatic rebalancing and replication.",
    vaguePrompt: "Design a distributed in-memory caching service that can scale to thousands of nodes, support millions of reads/writes per second, and automatically redistribute keys when nodes join or fail.",
    level: "Senior",
    category: "Storage & Caching",
    scaleMetrics: {
      dau: "Global Infrastructure",
      qps: "10M read QPS, 1M write QPS",
      latency: "p99 < 2ms",
      storage: "50 TB RAM Cluster"
    },
    keyFocus: ["Consistent Hashing with Virtual Nodes", "Gossip Protocol", "Eviction Policies (LRU/LFU)", "Replication"]
  },
  {
    id: "curated_video_transcoder",
    title: "Large-Scale Video Ingestion, Transcoding & Adaptive CDN Pipeline",
    shortDescription: "Architect a YouTube/TikTok video upload, chunked transcoding, and global HLS/DASH streaming platform.",
    vaguePrompt: "Design the video processing backend for a platform where 500 hours of video are uploaded every minute. The system must process videos into multiple resolutions (4K down to 360p) and stream them globally with sub-second startup times.",
    level: "Staff",
    category: "Real-time & Media",
    scaleMetrics: {
      dau: "2 Billion Monthly Users",
      qps: "500 hrs video uploaded/min",
      latency: "Sub-500ms initial video play",
      storage: "Petabytes/day"
    },
    keyFocus: ["Chunked Transcoding Worker Pool", "Object Storage Hierarchy", "Edge CDN Caching", "Adaptive Bitrate"]
  },
  {
    id: "curated_event_stream",
    title: "High-Throughput Distributed Event Log (Kafka-like Stream Engine)",
    shortDescription: "Design a fault-tolerant, partitioned distributed commit log for high-velocity telemetry and message streaming.",
    vaguePrompt: "Design a distributed event stream platform that ingests, persists, and replays billions of events per second with ordered partitions, consumer group semantics, and zero data loss under broker failure.",
    level: "Principal",
    category: "Distributed Systems",
    scaleMetrics: {
      dau: "Enterprise Infrastructure",
      qps: "5M events/sec ingress",
      latency: "p99 < 5ms append",
      storage: "100 TB retention/week"
    },
    keyFocus: ["Zero-Copy Transfer (sendfile)", "Segment Indexing", "Raft/KRaft Leader Election", "Consumer Offset Tracking"]
  },
  {
    id: "curated_rate_limiter",
    title: "Global Multi-Tier Distributed Rate Limiter & Abuse Prevention",
    shortDescription: "Design a high-performance distributed rate limiter protecting public APIs from DDoS and abusive scraping across global edge points.",
    vaguePrompt: "Design a distributed rate limiting service that sits at our API gateway tier across 50 global edge points. It must enforce sliding window and token bucket policies for millions of API consumers with minimal latency overhead.",
    level: "Senior",
    category: "Distributed Systems",
    scaleMetrics: {
      dau: "500M API calls/hour",
      qps: "250K requests/sec",
      latency: "p99 < 1ms overhead",
      storage: "Distributed Memory State"
    },
    keyFocus: ["Sliding Window Counter", "Token Bucket Algorithm", "Redis Cluster vs Local Memory Sync", "Fail-Open Strategy"]
  },
  {
    id: "curated_url_shortener",
    title: "Scalable URL Shortener & Click Analytics Service",
    shortDescription: "Design a high-throughput URL shortening service like Bitly or TinyURL with custom aliases, TTL expiration, and click tracking.",
    vaguePrompt: "Design a URL shortening service like TinyURL. Users submit long URLs and get short 7-character URLs. When someone visits the short URL, they are redirected immediately with minimal latency. Also track click counts.",
    level: "Mid-Level",
    category: "Storage & Caching",
    scaleMetrics: {
      dau: "100M Active Users",
      qps: "100K read QPS, 1K write QPS (100:1 read ratio)",
      latency: "p99 < 15ms redirect",
      storage: "100M new URLs/month (15 TB / 5 years)"
    },
    keyFocus: ["Base62 Encoding & Hash Collision Strategy", "301 Permanent vs 302 Found Redirect Caching", "Read-Heavy Redis Caching (80/20 Rule)", "Database Sharding & Unique ID Generation"]
  },
  {
    id: "curated_notification_system",
    title: "Multi-Channel Notification & Push Alert Engine",
    shortDescription: "Design a scalable, reliable notification service supporting Mobile Push (APNs/FCM), SMS, and Email with rate limiting.",
    vaguePrompt: "Design a centralized notification platform that powers push notifications, SMS alerts, and marketing emails across our company services. It should support user preferences, deduplication, retry policies, and priority queues.",
    level: "Mid-Level",
    category: "Distributed Systems",
    scaleMetrics: {
      dau: "50M Notifications/day",
      qps: "10K peak notifications/sec",
      latency: "p99 < 2s delivery for critical alerts",
      storage: "90-day notification logs (5 TB)"
    },
    keyFocus: ["Decoupled Message Queues (RabbitMQ/SQS)", "Priority Queues (Transactional vs Promotional)", "User Notification Preferences & Rate Limiting", "Third-Party Provider Failover (Twilio/SendGrid/FCM)"]
  },
  {
    id: "curated_search_autocomplete",
    title: "Real-Time Search Autocomplete & Typeahead Suggestions",
    shortDescription: "Design a high-speed search suggestion typeahead service like Google/Amazon returning top-k matching queries in sub-30ms.",
    vaguePrompt: "Design the search autocomplete feature for an e-commerce search bar. As the user types characters, return the top 5 most relevant and frequently searched queries in real-time.",
    level: "Mid-Level",
    category: "Storage & Caching",
    scaleMetrics: {
      dau: "200M Active Users",
      qps: "50K search QPS",
      latency: "p99 < 30ms response SLA",
      storage: "100M query corpus (20 GB memory)"
    },
    keyFocus: ["Trie Data Structure in Memory", "Top-K Frequency Ranking & Caching", "Offline Data Aggregation Pipeline", "Browser & Edge CDN Response Caching"]
  },
  {
    id: "curated_pastebin",
    title: "High-Availability Pastebin & Document Snippet Store",
    shortDescription: "Design a plain-text document sharing service like Pastebin or GitHub Gist with expiration and custom access controls.",
    vaguePrompt: "Design a text sharing website like Pastebin. Users can paste text snippets up to 10MB, get a unique sharing link, set optional expiration times, and view public pastes.",
    level: "Mid-Level",
    category: "Storage & Caching",
    scaleMetrics: {
      dau: "10M Daily Active Users",
      qps: "20K read QPS, 500 write QPS (40:1 read ratio)",
      latency: "p99 < 50ms retrieval",
      storage: "10 TB text data/year"
    },
    keyFocus: ["Object Storage (S3) vs Metadata Database", "Snowflake / UUID Key Generation", "TTL Expiration & Soft-Delete Cleanup", "CDN Edge Caching for Hot Content"]
  }
];

export class ProblemEngine {
  /**
   * Returns pre-seeded curated catalog
   */
  static getCuratedProblems() {
    return CURATED_PROBLEMS;
  }

  /**
   * Generates 10 dynamic problems via the configured LLM matching the candidate's level
   */
  static async generateProblems({
    provider,
    apiKey,
    model,
    level = 'Senior',
    role = 'Distributed Systems Architect',
    background = '',
    count = 10,
    existingTitles = []
  }) {
    const systemPrompt = await PromptRegistry.getProblemGenerationPrompt({
      level,
      role,
      background,
      count,
      existingTitles
    });

    const userPrompt = `Generate exactly ${count} unique, high-quality system design interview problems.
Candidate Level: ${level}
Target Specialization: ${role}
Candidate Background: ${background || 'Standard backend & distributed systems experience'}
Avoid generating any duplicates of these existing problem titles: ${JSON.stringify(existingTitles.slice(0, 15))}

Each problem object in the JSON array MUST have the following structure:
[
  {
    "id": "prob_<unique_short_slug>",
    "title": "<Compelling, Realistic Problem Title>",
    "shortDescription": "<1-2 sentence overview of the system>",
    "vaguePrompt": "<The initial intentionally brief problem statement an interviewer would say at minute 0>",
    "level": "${level}",
    "category": "<One of: Distributed Systems, Storage & Caching, Event Streaming, Real-time & Media, FinTech & Security, Geospatial>",
    "scaleMetrics": {
      "dau": "<e.g. 100M DAU>",
      "qps": "<e.g. 50K write QPS>",
      "latency": "<e.g. p99 < 50ms>",
      "storage": "<e.g. 5 TB / day>"
    },
    "keyFocus": ["<Topic 1>", "<Topic 2>", "<Topic 3>", "<Topic 4>"]
  }
]`;

    const response = await LLMService.complete({
      provider,
      apiKey,
      model,
      systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      temperature: 0.8,
      jsonMode: true
    });

    let problems = [];
    if (Array.isArray(response)) {
      problems = response;
    } else if (response && Array.isArray(response.problems)) {
      problems = response.problems;
    } else if (response && typeof response === 'object') {
      const firstArrayKey = Object.keys(response).find(k => Array.isArray(response[k]));
      if (firstArrayKey) {
        problems = response[firstArrayKey];
      }
    }

    if (!problems || problems.length === 0) {
      throw new Error("LLM did not return a valid list of problem items.");
    }

    // Ensure all have required fields, unique ids, and createdAt timestamp
    const now = Date.now();
    return problems.map((p, idx) => ({
      id: p.id || `gen_${now}_${idx}`,
      title: p.title || 'Distributed System Design',
      shortDescription: p.shortDescription || 'Architect a scalable distributed system.',
      vaguePrompt: p.vaguePrompt || `Design a high-scale system for ${p.title}. Walk me through your design.`,
      level: p.level || level,
      category: p.category || 'Distributed Systems',
      scaleMetrics: p.scaleMetrics || { dau: '50M Active Users', qps: '10K QPS' },
      keyFocus: Array.isArray(p.keyFocus) ? p.keyFocus : ['High Availability', 'Horizontal Scaling'],
      createdAt: p.createdAt || now
    }));
  }

  /**
   * Helper to construct a custom user-defined problem
   */
  static createCustomProblem({
    title,
    shortDescription,
    vaguePrompt,
    level = 'Senior',
    category = 'Distributed Systems',
    scaleMetrics = {}
  }) {
    if (!title || title.trim().length === 0) {
      throw new Error("Problem title is required.");
    }

    const cleanTitle = title.trim();
    const cleanDesc = (shortDescription || cleanTitle).trim();
    const cleanPrompt = (vaguePrompt || `Design a system for ${cleanTitle}. Walk me through your requirements, estimations, architecture, and edge cases.`).trim();
    const now = Date.now();

    return {
      id: `custom_${now}_${Math.random().toString(36).substring(2, 7)}`,
      title: cleanTitle,
      shortDescription: cleanDesc,
      vaguePrompt: cleanPrompt,
      level: level || 'Senior',
      category: category || 'Custom Design',
      isCustom: true,
      createdAt: now,
      scaleMetrics: {
        dau: scaleMetrics.dau || 'Custom Scale',
        qps: scaleMetrics.qps || 'High Throughput',
        latency: scaleMetrics.latency || 'p99 < 100ms',
        storage: scaleMetrics.storage || 'Scalable Storage'
      },
      keyFocus: ['Custom Requirements', 'Architecture', 'Bottlenecks', 'Trade-offs']
    };
  }
}
