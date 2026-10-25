import { PrismaClient, UserRole } from '@prisma/client';
const prisma = new PrismaClient();
async function main(){
  const org=await prisma.organization.upsert({where:{id:'demo-org'},update:{},create:{id:'demo-org',name:'Kampala Community Education Group',type:'SCHOOL_GROUP'}});
  const school=await prisma.school.upsert({where:{id:'demo-school'},update:{},create:{id:'demo-school',organizationId:org.id,name:'Kampala Community School',district:'Kampala'}});
  const person=await prisma.person.upsert({where:{id:'demo-bursar-person'},update:{},create:{id:'demo-bursar-person',firstName:'Demo',lastName:'Bursar',email:'bursar@harambeeone.local'}});
  await prisma.user.upsert({where:{id:'demo-bursar'},update:{},create:{id:'demo-bursar',organizationId:org.id,personId:person.id,role:UserRole.BURSAR}});
  console.log({org:org.name,school:school.name});
}
main().finally(()=>prisma.$disconnect());
