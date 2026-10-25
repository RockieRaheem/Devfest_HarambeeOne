import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  it('returns internally consistent financial metrics', () => {
    const overview = new DashboardService().overview();
    assert.equal(overview.metrics.billed - overview.metrics.collected, overview.metrics.outstanding);
    assert.ok(overview.metrics.activeLearners > 0);
    assert.equal(overview.weeklyCollections.length, 5);
    assert.equal(overview.mode, 'DEMO');
  });

  it('records cash once and exposes its receipt in activity', () => {
    const service = new DashboardService();
    const receipt = service.recordCash({ learnerRef:'H1-00041', amount:500_000, payerName:'Test Guardian' });
    const overview = service.overview();
    assert.equal(receipt.status, 'RECONCILED');
    assert.equal(overview.activity[0].id, receipt.receiptNo);
    assert.equal(overview.activity[0].amount, 500_000);
  });

  it('queues statement metadata without posting learner allocations', () => {
    const result = new DashboardService().importStatement({ fileName:'statement.csv', rowCount:12 });
    assert.equal(result.rowsReceived, 12);
    assert.equal(result.status, 'QUEUED_FOR_REVIEW');
  });
});
