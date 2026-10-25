import { Module } from '@nestjs/common'; import { GovernanceController } from './governance.controller';
@Module({controllers:[GovernanceController]}) export class GovernanceModule{}
