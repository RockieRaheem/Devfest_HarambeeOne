import { Injectable } from '@nestjs/common';
@Injectable() export class StudentsService{
 list(){return [{id:'H1-00041',name:'Sarah Namusoke',class:'S2',stream:'East',status:'ACTIVE',balance:300000},{id:'H1-00042',name:'Peter Kato',class:'S3',stream:'North',status:'ACTIVE',balance:750000}]}
 one(id:string){return this.list().find(x=>x.id===id) ?? null}
}
