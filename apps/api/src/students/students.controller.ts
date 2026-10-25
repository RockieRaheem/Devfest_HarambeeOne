import { Controller, Get, Param } from '@nestjs/common'; import { StudentsService } from './students.service';
@Controller('students') export class StudentsController{constructor(private readonly service:StudentsService){} @Get() list(){return this.service.list()} @Get(':id') one(@Param('id') id:string){return this.service.one(id)}}
