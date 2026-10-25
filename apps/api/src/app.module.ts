import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './common/health.controller';
import { StudentsModule } from './students/students.module';
import { PaymentsModule } from './payments/payments.module';
import { SponsorsModule } from './sponsors/sponsors.module';
import { GovernanceModule } from './governance/governance.module';
import { SettlementModule } from './settlement/settlement.module';
import { AiModule } from './ai/ai.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DatabaseModule } from './database/database.module';
@Module({imports:[ConfigModule.forRoot({isGlobal:true}),DatabaseModule,DashboardModule,StudentsModule,PaymentsModule,SponsorsModule,GovernanceModule,SettlementModule,AiModule],controllers:[HealthController]})
export class AppModule{}
