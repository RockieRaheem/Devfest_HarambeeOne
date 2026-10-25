import { Controller, Get } from '@nestjs/common';
@Controller('governance') export class GovernanceController{@Get('proposals') list(){return [{id:'PR-101',action:'LARGE_ADJUSTMENT',amount:2000000,status:'PENDING_APPROVAL',required:['HEAD_TEACHER','FINANCE_DIRECTOR']}]} }
