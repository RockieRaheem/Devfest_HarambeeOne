import { Body, Controller, Post } from '@nestjs/common';
@Controller('ai') export class AiController{
 @Post('explain') explain(@Body() body:{question?:string}){return {answer:'Demo assistant: authoritative balances must come from finance services. AI only explains returned records.',question:body.question ?? ''}}
 @Post('match-payment') match(){return {recommendation:{studentId:'H1-00042',confidence:0.91},requiresHumanConfirmation:true}}
}
