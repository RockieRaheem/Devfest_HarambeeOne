import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsInt, IsOptional, IsPositive, IsString, Max, MaxLength, Min } from 'class-validator';
import { DashboardService } from './dashboard.service';

class CashPaymentDto {
  @IsString() @MaxLength(50) learnerRef!: string;
  @IsInt() @IsPositive() @Max(100_000_000) amount!: number;
  @IsString() @MaxLength(100) payerName!: string;
  @IsOptional() @IsString() @MaxLength(240) note?: string;
}
class StatementImportDto {
  @IsString() @MaxLength(180) fileName!: string;
  @IsInt() @Min(1) @Max(10_000) rowCount!: number;
}

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}
  @Get() overview() { return this.dashboard.overview(); }
  @Post('cash-payments') recordCash(@Body() body:CashPaymentDto) { return this.dashboard.recordCash(body); }
  @Post('statement-imports') importStatement(@Body() body:StatementImportDto) { return this.dashboard.importStatement(body); }
}
