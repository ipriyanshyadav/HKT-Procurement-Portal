import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const browsePRLatency = new Trend('browse_prs_duration');
const createPRLatency = new Trend('create_pr_duration');
const approveTaskLatency = new Trend('approve_task_duration');
const submitBidLatency = new Trend('submit_bid_duration');
const generateCSLatency = new Trend('generate_cs_duration');
const browseVendorsLatency = new Trend('browse_vendors_duration');
const validateInvoiceLatency = new Trend('validate_invoice_duration');

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';
const TOKEN = __ENV.ACCESS_TOKEN || 'mock-perf-token';
const IS_SMOKE = !__ENV.ENABLE_PERF_TESTS || __ENV.ENABLE_PERF_TESTS === '0';

export const options = {
  scenarios: {
    // Scenario 1: Browse PRs
    browse_prs: {
      executor: 'shared-iterations',
      vus: IS_SMOKE ? 1 : 50,
      iterations: IS_SMOKE ? 2 : 200,
      maxDuration: '1m',
      exec: 'browsePRs',
    },
    // Scenario 2: Create PR
    create_pr: {
      executor: 'shared-iterations',
      vus: IS_SMOKE ? 1 : 20,
      iterations: IS_SMOKE ? 2 : 100,
      maxDuration: '1m',
      exec: 'createPR',
    },
    // Scenario 3: Approve workflow task
    approve_task: {
      executor: 'shared-iterations',
      vus: IS_SMOKE ? 1 : 15,
      iterations: IS_SMOKE ? 2 : 60,
      maxDuration: '1m',
      exec: 'approveTask',
    },
    // Scenario 4: Supplier bid submission peak
    submit_bid: {
      executor: 'shared-iterations',
      vus: IS_SMOKE ? 1 : 30,
      iterations: IS_SMOKE ? 2 : 100,
      maxDuration: '1m',
      exec: 'submitBid',
    },
    // Scenario 5: Comparative Statement generation
    generate_cs: {
      executor: 'shared-iterations',
      vus: IS_SMOKE ? 1 : 10,
      iterations: IS_SMOKE ? 2 : 50,
      maxDuration: '1m',
      exec: 'generateCS',
    },
    // Scenario 6: Browse vendor directory
    browse_vendors: {
      executor: 'shared-iterations',
      vus: IS_SMOKE ? 1 : 25,
      iterations: IS_SMOKE ? 2 : 100,
      maxDuration: '1m',
      exec: 'browseVendors',
    },
    // Scenario 7: Invoice 3-way match validation
    validate_invoice: {
      executor: 'shared-iterations',
      vus: IS_SMOKE ? 1 : 15,
      iterations: IS_SMOKE ? 2 : 60,
      maxDuration: '1m',
      exec: 'validateInvoice',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    errors: ['rate<0.01'],
  },
};

const defaultHeaders = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${TOKEN}`,
};

export default function () {
  browsePRs();
}

// Scenario 1
export function browsePRs() {
  const res = http.get(`${BASE_URL}/api/v1/requisitions?page=1&page_size=20`, { headers: defaultHeaders });
  browsePRLatency.add(res.timings.duration);
  const ok = check(res, { 'status 200 or 401': r => r.status === 200 || r.status === 401 });
  errorRate.add(!ok);
  sleep(0.1);
}

// Scenario 2
export function createPR() {
  const payload = JSON.stringify({
    title: `Perf Test PR ${Date.now()}`,
    business_unit_id: '00000000-0000-0000-0000-000000000001',
    cost_center_id: '00000000-0000-0000-0000-000000000002',
    category_id: '00000000-0000-0000-0000-000000000003',
    currency: 'INR',
    estimated_value: 50000,
    lines: [
      {
        line_number: 1,
        item_description: 'High Pressure Valve',
        category_id: '00000000-0000-0000-0000-000000000003',
        uom_id: '00000000-0000-0000-0000-000000000004',
        quantity: 10,
        estimated_unit_price: 5000,
      },
    ],
  });
  const res = http.post(`${BASE_URL}/api/v1/requisitions`, payload, { headers: defaultHeaders });
  createPRLatency.add(res.timings.duration);
  const ok = check(res, { 'status valid': r => [200, 201, 401, 422].includes(r.status) });
  errorRate.add(!ok);
  sleep(0.1);
}

// Scenario 3
export function approveTask() {
  const taskId = '00000000-0000-0000-0000-000000000010';
  const payload = JSON.stringify({ action: 'APPROVE', comment: 'Approved under baseline perf load' });
  const res = http.post(`${BASE_URL}/api/v1/workflow/tasks/${taskId}/action`, payload, { headers: defaultHeaders });
  approveTaskLatency.add(res.timings.duration);
  const ok = check(res, { 'status valid': r => [200, 401, 404, 422].includes(r.status) });
  errorRate.add(!ok);
  sleep(0.1);
}

// Scenario 4
export function submitBid() {
  const bidId = '00000000-0000-0000-0000-000000000020';
  const payload = JSON.stringify({ rfq_id: '00000000-0000-0000-0000-000000000030', amount: 48000 });
  const res = http.post(`${BASE_URL}/api/v1/bids/${bidId}/submit`, payload, { headers: defaultHeaders });
  submitBidLatency.add(res.timings.duration);
  const ok = check(res, { 'status valid': r => [200, 401, 404, 422].includes(r.status) });
  errorRate.add(!ok);
  sleep(0.1);
}

// Scenario 5
export function generateCS() {
  const rfqId = '00000000-0000-0000-0000-000000000030';
  const res = http.get(`${BASE_URL}/api/v1/rfqs/${rfqId}/evaluation`, { headers: defaultHeaders });
  generateCSLatency.add(res.timings.duration);
  const ok = check(res, { 'status valid': r => [200, 401, 404, 422].includes(r.status) });
  errorRate.add(!ok);
  sleep(0.1);
}

// Scenario 6
export function browseVendors() {
  const res = http.get(`${BASE_URL}/api/v1/vendors?page=1&page_size=50`, { headers: defaultHeaders });
  browseVendorsLatency.add(res.timings.duration);
  const ok = check(res, { 'status valid': r => [200, 401, 422].includes(r.status) });
  errorRate.add(!ok);
  sleep(0.1);
}

// Scenario 7
export function validateInvoice() {
  const invId = '00000000-0000-0000-0000-000000000040';
  const res = http.post(`${BASE_URL}/api/v1/invoices/${invId}/match`, '{}', { headers: defaultHeaders });
  validateInvoiceLatency.add(res.timings.duration);
  const ok = check(res, { 'status valid': r => [200, 401, 404, 422].includes(r.status) });
  errorRate.add(!ok);
  sleep(0.1);
}
