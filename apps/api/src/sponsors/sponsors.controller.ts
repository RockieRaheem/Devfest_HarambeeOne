import { Controller, Get } from '@nestjs/common';
@Controller('sponsors') export class SponsorsController{@Get('programmes') list(){return [{id:'PGM-GSTEM-2028',name:'Girls in STEM 2028',beneficiaries:120,schools:5,obligationCurrency:'UGX',treasuryAsset:'USDC',status:'ACTIVE'}]}}
