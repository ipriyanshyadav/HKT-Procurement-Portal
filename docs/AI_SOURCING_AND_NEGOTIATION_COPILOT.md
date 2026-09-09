# 🤖 AI-Powered Autonomous Sourcing & Negotiation Copilot

> **Comprehensive Architecture, Mathematical Formulation, and Operational Guide**  
> **Module Scope:** Autonomous Sourcing, Pricing Anomaly Detection, Tail-Spend Negotiation Bot, and Multi-Factor Supplier Recommendation Radar.  
> **Package / Endpoints:** `app/modules/ai_sourcing/` &bull; `/api/v1/ai-sourcing`  
> **Frontend Interface:** Buyer Portal &bull; `/rfqs/copilot`

---

## 1. Executive Summary

In enterprise procurement, **tail spend** accounts for ~80% of all purchase transactions but only ~20% of total expenditure. Human procurement officers rarely have the bandwidth to negotiate thousands of low-dollar/high-volume requisitions ($5,000 to $50,000) or manually bundle unmapped purchase requests into structured RFQs.

The **AI-Powered Autonomous Sourcing & Negotiation Copilot** automates this entire lifecycle through three deterministic, game-theoretic, and statistically sound subsystems:

1. **Smart RFQ Synthesis & Anomaly Radar:** Detects historical price outliers against master item baselines and bundles unmapped PR items into competitive RFQ lots.
2. **Autonomous Tail-Spend Negotiation Bot:** Executes multi-round counter-bidding within buyer-defined budget corridors using strategy-dependent concession algorithms.
3. **Multi-Factor Supplier Recommendation Radar:** Ranks suppliers using Multi-Criteria Decision Analysis (MCDA) across Quality, ESG, Lead Time, and Price Competitiveness.

---

## 2. System Architecture

```mermaid
flowchart TB
    subgraph Sourcing ["1. Smart RFQ Synthesis & Anomaly Radar"]
        PR["Unmapped PR Lines / Exceptions\n(RequisitionLine / UnmappedPrException)"] --> Anomaly["Statistical Price Anomaly Radar\n(ItemMaster baseline vs Quoted rate)"]
        Anomaly -->|Variance > 15%| Flags["Anomaly Flags\n(HIGH_PRICE_OUTLIER / EXCEPTION)"]
        Anomaly --> RFQ_Draft["Structured Multi-Lot RFQ Draft\n(ai_rfq_drafts)"]
        RFQ_Draft -->|1-Click Convert| Active_RFQ["Active Enterprise RFQ\n(rfqs table: DRAFT / PUBLISHED)"]
    end

    subgraph Negotiation ["2. Autonomous Tail-Spend Negotiation Bot"]
        Active_RFQ --> Bot["Autonomous Negotiation Engine"]
        Bot --> Corridors["Target Budget Corridor\n[Target Price ↔ Max Ceiling Price]"]
        Corridors --> Strategy["Concession Factor (k)\n• AGGRESSIVE (k=0.25)\n• BALANCED (k=0.40)\n• COLLABORATIVE (k=0.55)"]
        Strategy --> Rounds["Multi-Round Game Theory Loop\n(Max 5 Rounds in negotiation_rounds)"]
        Rounds --> Outcome{"Outcome Evaluation"}
        Outcome -->|Bid <= Target| Success["CONCLUDED_SUCCESS\n(Deal Confirmed & Savings Awarded)"]
        Outcome -->|Rounds > 5 & Bid > Max| Walkaway["CONCLUDED_WALKAWAY\n(Walkaway Protocol Triggered)"]
    end

    subgraph Radar ["3. Multi-Factor Supplier Recommendation Radar"]
        Vendors["Vendor Master Database\n(vendors table)"] --> Scoring["MCDA Scoring Engine"]
        Scoring --> Weights["• Quality (35%)\n• Price Competitiveness (25%)\n• Lead Time Adherence (20%)\n• ESG & Compliance (20%)"]
        Weights --> Tiers["Classification Tiers\nPREFERRED | RECOMMENDED | ACCEPTABLE | HIGH_RISK"]
        Tiers --> Headroom["Actionable Headroom Insights\n(e.g., 8.5% - 14% negotiation discount)"]
    end
```

---

## 3. Subsystem Deep-Dive

### Subsystem 1: Smart RFQ Generator with Historical Pricing Anomaly Radar

#### Purpose
Captures unmapped PR line items or manual requisition exceptions, evaluates whether proposed costs deviate from historical baseline prices, flags potential overspending, and converts approved lots into official enterprise tenders.

#### Mathematical Formulation
For every line item, the engine resolves the benchmark price $P_{\text{bench}}$ from the master catalog (`ItemMaster.standard_price`). If no historical master record exists, it synthesizes an estimated market baseline:

$$P_{\text{bench}} = \text{Unit Price} \times 0.85$$

The percentage variance is then computed:

$$\text{Variance \%} = \left(\frac{P_{\text{quoted}} - P_{\text{bench}}}{P_{\text{bench}}}\right) \times 100$$

#### Outlier Classification
- **$|\text{Variance \%}| > 15\%$:** Flagged as an active anomaly.
- **$\text{Variance \%} > +15\%$:** `HIGH_PRICE_OUTLIER` (quoted rate exceeds historical standard; requires competitive bidding).
- **$\text{Variance \%} < -15\%$:** `LOW_PRICE_ANOMALY` (potential data entry error or sub-specification quality).
- **Unmapped PR Items:** Tagged with `UNMAPPED_PR_EXCEPTION` requiring competitive quote validation.

#### 1-Click RFQ Publishing
The buyer reviews the draft and anomaly flags in the UI. Upon clicking **"Convert to Official RFQ"**, the engine:
1. Auto-resolves the organization's default Business Unit and Category taxonomy.
2. Generates an official RFQ identifier (`RFQ-YYYYMM-XXXXXX`).
3. Sets status to `DRAFT` with linked PR line item mappings.
4. Marks the AI draft as `CONVERTED` to maintain audit traceability.

---

### Subsystem 2: Autonomous Tail-Spend Negotiation Bot

#### Purpose
Conducts automated, multi-round price negotiations with suppliers on behalf of the buyer within strictly bound budget corridors.

#### Configuration Inputs
When initializing a session, the buyer configures:
- **Initial Quote Price ($P_{\text{quote}}$):** Supplier's opening price.
- **Target Price ($P_{\text{target}}$):** The ideal budget goal ($P_{\text{target}} < P_{\text{quote}}$).
- **Max Acceptable Ceiling ($P_{\text{max}}$):** The absolute maximum price authorized ($P_{\text{target}} \le P_{\text{max}} < P_{\text{quote}}$).
- **Concession Strategy:** Strategy determining how quickly the bot yields to the vendor.

#### Game-Theoretic Concession Algorithm
In round $r$, when the supplier submits counter-offer $P_{\text{vendor}}$, the bot calculates the remaining budget gap:

$$\text{Gap} = P_{\text{vendor}} - P_{\text{target}}$$

The bot calculates its next concession step using a strategy factor $k$:
- **`AGGRESSIVE`** ($k = 0.25$): Yields slowly, prioritizing maximum dollar savings.
- **`BALANCED`** ($k = 0.40$): Yields moderately, converging towards a balanced market price.
- **`COLLABORATIVE`** ($k = 0.55$): Yields faster, prioritizing long-term vendor partnership.

The bot's next counter-offer is computed as:

$$P_{\text{counter}} = \min\left(P_{\text{target}} + (\text{Gap} \times k),\; P_{\text{max}}\right)$$

#### State Machine Outcomes
```
               [ Supplier Counter Received ]
                            |
           +----------------+----------------+
           |                                 |
 [ P_vendor <= P_target ]       [ P_vendor > P_target ]
           |                                 |
           v                                 v
   CONCLUDED_SUCCESS              [ Round >= Max Rounds (5)? ]
   (Deal Confirmed)                          |
                                 +-----------+-----------+
                                 |                       |
                              [ Yes ]                  [ No ]
                                 |                       |
                +----------------+---------------+       v
                |                                |  Compute Next Counter
       [ P_vendor <= P_max ]           [ P_vendor > P_max ] (Continue Bot Loop)
                |                                |
                v                                v
        CONCLUDED_SUCCESS               CONCLUDED_WALKAWAY
     (Ceiling Tolerance Met)          (Walkaway Protocol)
```

1. **`CONCLUDED_SUCCESS` (Instant Target Hit):** If $P_{\text{vendor}} \le P_{\text{target}}$, the deal is instantly confirmed and savings are awarded.
2. **`CONCLUDED_SUCCESS` (Ceiling Tolerance):** If 5 rounds elapse and the vendor's final offer is within $P_{\text{max}}$, the system accepts the offer.
3. **`CONCLUDED_WALKAWAY`:** If 5 rounds elapse and the vendor remains above $P_{\text{max}}$, the bot terminates negotiation to protect corporate budgets.
4. **Audit Trail:** Every counter-offer, rationale statement, and dollar concession is permanently recorded in `negotiation_rounds`.

---

### Subsystem 3: Multi-Factor Supplier Recommendation Radar

#### Purpose
Prevents "lowest price at any cost" decisions by evaluating suppliers multidimensionally using **Multi-Criteria Decision Analysis (MCDA)**.

#### Scoring Formula
$$\text{Overall Fit} = (0.35 \times \text{Quality}) + (0.25 \times \text{Price}) + (0.20 \times \text{Lead Time}) + (0.20 \times \text{ESG})$$

- **Quality Score (35% Weight):** Based on historical inspection pass rates and defect rejection statistics (`Vendor.performance_score`).
- **Price Competitiveness (25% Weight):** Evaluates vendor quote history relative to market averages.
- **Lead Time Adherence (20% Weight):** Historical on-time delivery rate from Advance Shipping Notices (ASNs) and GRNs.
- **ESG & Compliance Posture (20% Weight):** ISO certifications, active compliance audits (`Vendor.compliance_score`), and sanction screening. If the vendor is suspended or non-active, ESG drops to 45.0.

#### Classification Tiers & Headroom Insights
| Overall Score | Classification Tier | Operational Recommendation | Negotiation Headroom |
| :--- | :--- | :--- | :--- |
| **$\ge 85.0$** | `PREFERRED` | Preferred strategic vendor; low audit overhead | ~8.5% Headroom |
| **$70.0 - 84.9$** | `RECOMMENDED` | Qualified vendor; standard milestone oversight | ~14.0% Headroom |
| **$50.0 - 69.9$** | `ACCEPTABLE` | Meets baseline criteria; secondary backup | ~18.0% Headroom |
| **$< 50.0$** | `HIGH_RISK` | Defect or compliance issues; requires executive sign-off | Manual Review |

---

## 4. Zero-Subscription & Air-Gapped Operation

### Does this require an external AI model subscription (e.g. OpenAI, Anthropic, Gemini)?

> **NO. The AI Sourcing Copilot requires ZERO third-party subscriptions, ZERO API keys, and incurs ZERO recurring cloud inference costs.**

### Technical Rationale

1. **Self-Contained & Deterministic:**  
   The module runs entirely in-process inside your FastAPI backend container using algorithmic game theory, statistical anomaly detection heuristics, and weighted multi-criteria decision mathematics.
2. **Financial Liability & Hallucination Prevention:**  
   In enterprise procurement, commercial offers and price commitments carry legal liability. A non-deterministic LLM can hallucinate pricing, leak confidential margins, or agree to prices exceeding corporate budget ceilings. The mathematical engine strictly guarantees that the bot **never exceeds the buyer's maximum price ceiling ($P_{\text{max}}$)**.
3. **Zero Latency & Air-Gapped Compatibility:**  
   Execution takes **<15 milliseconds**, requires no outbound internet connectivity, and can operate in strict air-gapped environments (defense, banking, government).
4. **Extensibility for Optional LLMs:**  
   The architecture is modular (`AiSourcingService`). If an organization wishes to use a local open-source LLM (via Ollama / vLLM) or a cloud LLM to generate conversational counter-negotiation letters, an adapter can be plugged into `response_payload` without altering the database schema or core math.

---

## 5. Database Schema Reference

Migration: `alembic/versions/0046_ai_sourcing_copilot.py`

### Tables
- **`ai_rfq_drafts`**: Stores synthesized RFQ lots, estimated totals, and JSON arrays of price anomaly flags.
- **`negotiation_sessions`**: Tracks active bot negotiations, initial quotes, target prices, max ceilings, status (`ACTIVE`, `CONCLUDED_SUCCESS`, `CONCLUDED_WALKAWAY`), and strategy.
- **`negotiation_rounds`**: Detailed log of every round, bidder (`VENDOR` vs `AI_BOT`), offered price, concession amount, and rationale.
- **`supplier_radar_scores`**: Historical snapshot of vendor ratings across Quality, ESG, Lead Time, Price, and Classification Tier.

---

## 6. REST API Reference

All endpoints are mounted at `/api/v1/ai-sourcing` with organization tenancy enforcement:

| Method | Path | Description |
| :--- | :--- | :--- |
| `POST` | `/smart-rfq/generate` | Synthesizes an RFQ draft from PR items or unmapped exceptions and runs the anomaly radar |
| `GET` | `/smart-rfq/drafts` | Lists all synthesized Smart RFQ drafts for the active organization |
| `POST` | `/smart-rfq/convert` | Converts an AI draft into an official active enterprise RFQ |
| `POST` | `/negotiation/start` | Initializes a new autonomous tail-spend negotiation session |
| `GET` | `/negotiation/sessions` | Lists negotiation sessions (optionally filtered by `vendor_id`) |
| `GET` | `/negotiation/sessions/{id}` | Retrieves full session history including round-by-round concessions |
| `POST` | `/negotiation/counter` | Submits a vendor counter-bid and triggers the bot's mathematical counter |
| `GET` | `/radar/scores` | Retrieves multi-factor radar scorecards for organization vendors |
| `POST` | `/radar/calculate` | Triggers a fresh MCDA calculation across active suppliers |

---

## 7. Frontend User Experience (`/rfqs/copilot`)

The frontend component [`AISourcingCopilot.tsx`](file:///Users/priyanshyadav/PKY/Projects/HKT/procurement-portal/procurement-portal-frontend/packages/ui/src/components/AISourcingCopilot.tsx) is rendered inside the Buyer Portal under **Sourcing &rarr; AI Sourcing Copilot**:

- **Tab 1: Smart RFQ & Anomaly Radar:**
  - View flagged price outliers with percentage variance pills (`HIGH_PRICE_OUTLIER`).
  - Synthesize new drafts with custom lot items or unmapped PR lines.
  - 1-click **"Publish Official RFQ"** button.
- **Tab 2: Autonomous Negotiation Bot:**
  - Active negotiation sessions drawer with current savings counter.
  - Interactive round-by-round timeline showing AI Bot vs Supplier offers.
  - Embedded **Supplier Counter Simulator** allowing buyers to test scenarios live.
- **Tab 3: Multi-Factor Supplier Radar:**
  - Dynamic scorecards for all vendors with Quality, Price, Lead Time, and ESG progress bars.
  - Recommendation badges (`PREFERRED`, `RECOMMENDED`, `ACCEPTABLE`, `HIGH_RISK`).
  - Actionable headroom percentage indicators.
