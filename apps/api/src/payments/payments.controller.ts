import { Controller, Get } from '@nestjs/common'; import { PaymentsService } from './payments.service';
@Controller('payments') export class PaymentsController{constructor(private readonly service:PaymentsService){} @Get() list(){return this.service.list()} @Get('states') states(){return this.service.states()}}
