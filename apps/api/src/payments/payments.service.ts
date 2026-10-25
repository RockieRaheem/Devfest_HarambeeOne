import { Injectable } from '@nestjs/common';
@Injectable() export class PaymentsService{
 list(){return [{reference:'SP-928291',channel:'SCHOOLPAY',amount:500000,currency:'UGX',status:'RECONCILED'},{reference:'BNK-55102',channel:'BANK',amount:700000,currency:'UGX',status:'MATCH_SUGGESTED'}]}
 states(){return ['RECEIVED','UNMATCHED','MATCH_SUGGESTED','MATCHED','RECONCILED','SETTLED','DISPUTED','REVERSED','REFUNDED']}
}
