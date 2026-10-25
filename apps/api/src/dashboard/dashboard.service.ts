import { Injectable } from '@nestjs/common';

export type DashboardActivity = {
  id: string; occurredAt: string; learner: string; learnerRef: string;
  description: string; amount: number; currency: 'UGX'; status: 'RECONCILED'|'MATCH_SUGGESTED'|'SETTLED'|'UNMATCHED';
};

@Injectable()
export class DashboardService {
  private readonly activity: DashboardActivity[] = [
    { id:'ACT-1042', occurredAt:'2026-09-13T10:42:00+03:00', learner:'Sarah Namusoke', learnerRef:'H1-00041 · S2 East', description:'SchoolPay tuition', amount:500000, currency:'UGX', status:'RECONCILED' },
    { id:'ACT-0915', occurredAt:'2026-09-13T09:15:00+03:00', learner:'Peter Kato', learnerRef:'H1-00042 · S3 North', description:'Stanbic bank transfer', amount:700000, currency:'UGX', status:'MATCH_SUGGESTED' },
    { id:'ACT-1530', occurredAt:'2026-09-12T15:30:00+03:00', learner:'Amina Tendo', learnerRef:'H1-00043 · P7 Blue', description:'Girls in STEM allocation', amount:600000, currency:'UGX', status:'SETTLED' },
    { id:'ACT-1100', occurredAt:'2026-09-12T11:00:00+03:00', learner:'Unknown payer', learnerRef:'Reference MM-84211', description:'Mobile Money deposit', amount:350000, currency:'UGX', status:'UNMATCHED' },
  ];

  overview() {
    return {
      mode: 'DEMO' as const,
      school: { id:'demo-school', name:'Kampala Community School' },
      period: { label:'Term 2 · 2026' },
      generatedAt: new Date().toISOString(),
      metrics: { billed:842000000, collected:619000000, outstanding:223000000, activeLearners:1248, accountsInArrears:342, unreconciledCount:12, suggestedMatches:9 },
      weeklyCollections: [72000000,104000000,94000000,143000000,167000000],
      activity: this.activity.slice(0, 8),
      attention: [
        { id:'ATT-1', kind:'PAYMENT', title:'Unmatched Mobile Money reference', detail:'UGX 350,000 · Reference MM-84211', occurredAt:'2026-09-13T10:24:00+03:00' },
        { id:'ATT-2', kind:'APPROVAL', title:'Large adjustment needs approval', detail:'Two-authority threshold applies', occurredAt:'2026-09-13T08:42:00+03:00' },
        { id:'ATT-3', kind:'SETTLEMENT', title:'8 sponsor settlements ready', detail:'Fiat confirmed; ledger posting pending', occurredAt:'2026-09-13T06:20:00+03:00' },
      ],
    };
  }

  recordCash(input: { learnerRef:string; amount:number; payerName:string; note?:string }) {
    const receiptNo = `H1-CASH-${Date.now().toString().slice(-8)}`;
    const entry: DashboardActivity = { id:receiptNo, occurredAt:new Date().toISOString(), learner:input.payerName, learnerRef:input.learnerRef, description:input.note?.trim() || 'Cash payment', amount:input.amount, currency:'UGX', status:'RECONCILED' };
    this.activity.unshift(entry);
    return { receiptNo, status:'RECONCILED' as const, recordedAt:entry.occurredAt, amount:entry.amount, currency:entry.currency };
  }

  importStatement(input: { fileName:string; rowCount:number }) {
    return { importId:`IMP-${Date.now().toString().slice(-8)}`, fileName:input.fileName, rowsReceived:input.rowCount, status:'QUEUED_FOR_REVIEW' as const, importedAt:new Date().toISOString() };
  }
}
