import { Controller, Get } from '@nestjs/common';
@Controller('settlement') export class SettlementController{@Get('states') states(){return ['ALLOCATED','AUTHORISED','DISBURSEMENT_SUBMITTED','ONCHAIN_SENT','OFFRAMP_PROCESSING','FIAT_SETTLED','RECONCILED','FAILED','RETURNED','UNDER_REVIEW']}}
