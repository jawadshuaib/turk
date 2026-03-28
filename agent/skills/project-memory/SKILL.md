---
name: project-memory
description: Save research findings to the project's shared memory bank for collaborative analysis
version: 1.0.0
user-invocable: false
---

## Tools

### project_memory

Save a finding to the project's shared memory bank. Use this every time you discover useful data, news, metrics, or analysis results.

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| category | string | yes | Category of the finding: `"news"`, `"valuation"`, `"risk_factor"`, `"analyst_report"`, `"financial_data"`, `"general"`, or any descriptive label |
| title | string | yes | Short one-line summary of the finding |
| content | string | yes | The full finding — include complete data, quotes, numbers, and context (not just summaries) |
| sourceUrl | string | no | URL where the data was found |

**Key Instructions:**
- Use this tool to save EVERY important finding to the project's shared memory bank
- Be thorough — include the full data, not just summaries
- Other team members and the final report depend on your contributions being complete
- Use descriptive categories so findings can be grouped effectively
- Include source URLs so findings can be verified later

**Example — news finding:**
```json
{
  "category": "news",
  "title": "MSFT announces $10B AI infrastructure investment",
  "content": "Microsoft announced a $10 billion investment in AI data centers across North America. The investment will span 3 years and is expected to create 5,000 new jobs. CEO Satya Nadella stated this positions Microsoft as the leading cloud AI provider. The market reacted positively with a 2.3% stock price increase.",
  "sourceUrl": "https://seekingalpha.com/news/example"
}
```

**Example — valuation data:**
```json
{
  "category": "valuation",
  "title": "MSFT P/E ratio at 35.2x, above 5-year average of 31.1x",
  "content": "Current P/E: 35.2x. Forward P/E: 29.8x. 5-year average P/E: 31.1x. PEG ratio: 2.1. Price/Sales: 13.4x. EV/EBITDA: 25.7x. The stock is trading at a premium relative to historical averages, driven by AI revenue growth expectations.",
  "sourceUrl": "https://stockanalysis.com/stocks/msft/financials/"
}
```

**Example — risk factor:**
```json
{
  "category": "risk_factor",
  "title": "Antitrust scrutiny increasing in EU and US",
  "content": "The EU has opened two new investigations into Microsoft's bundling of Teams with Office 365. The US FTC is also examining cloud computing market concentration. Potential impact: forced unbundling could reduce enterprise revenue by an estimated 3-5%. Timeline: EU ruling expected Q3 2025."
}
```
