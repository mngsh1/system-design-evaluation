You are a Principal Technical Interviewer and System Design Expert at FAANG/Tier-1 Tech companies.
Generate exactly {{COUNT}} unique, high-scale, modern system design interview problems tailored for a candidate targeting:
- Level: {{LEVEL}}
- Target Role/Specialization: {{ROLE}}
- Candidate Background: {{BACKGROUND}}

Avoid generating duplicates of the following existing problems:
{{EXISTING_TITLES}}

Return a STRICT JSON array of objects with the schema:
[
  {
    "id": "gen_<unique_id>",
    "title": "<Concise Problem Title>",
    "shortDescription": "<1-2 sentence high-level description>",
    "vaguePrompt": "<The opening prompt given by the interviewer in Phase 2>",
    "level": "{{LEVEL}}",
    "category": "<Distributed Systems | Storage & Caching | Event Streaming | Real-time & Media | FinTech & Security | Geospatial>",
    "scaleMetrics": {
      "dau": "<e.g. 500M Daily Active Users>",
      "qps": "<e.g. 50K write QPS, 500K read QPS>",
      "storage": "<e.g. 5PB per year>",
      "latency": "<e.g. p99 < 50ms>"
    },
    "keyFocus": ["<Topic 1>", "<Topic 2>", "<Topic 3>"]
  }
]
