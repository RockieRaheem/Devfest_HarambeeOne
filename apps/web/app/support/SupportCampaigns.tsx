'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight, CheckCircle2, CircleDollarSign, HeartHandshake,
  LockKeyhole, ReceiptText, School, ShieldCheck, Sparkles,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { clientFetch as fetch } from '@/lib/api/client';

type Campaign = {
  public_code:string; title:string; public_summary:string; need_category:string;
  target_amount:string; verified_amount:string; pending_amount:string; remaining_amount:string;
  currency:string; status:string; school:string; supporter_count:number; update_count:number;
  image_url:string|null; image_alt:string|null;
  beneficiary:null|{display_name:string;registration_verified:boolean;verification_label:string;record_protection:string};
};

const money=(value:string|number)=>`UGX ${Number(value).toLocaleString('en-UG')}`;
const labels:Record<string,string>={fees:'School fees',examination:'Examinations',uniform:'Uniform',learning_materials:'Learning materials',meals:'School meals',transport:'Transport',other:'Other need'};

function CampaignVisual({item,featured=false}:{item:Campaign;featured?:boolean}) {
  return <div className={`campaign-visual need-${item.need_category} ${featured?'featured':''}`}>
    {item.image_url
      ? <Image src={item.image_url} alt={item.image_alt ?? 'Consented campaign image'} fill sizes={featured?'66vw':'33vw'} unoptimized/>
      : <div className="campaign-visual-fallback"><Sparkles/><span>{labels[item.need_category] ?? 'Learning support'}</span></div>}
    <div className="campaign-visual-shade"/>
    <span className="campaign-need-pill">{labels[item.need_category] ?? item.need_category}</span>
    {item.status === 'funded' && <span className="campaign-funded-pill"><CheckCircle2/> Fully funded</span>}
  </div>;
}

export default function SupportCampaigns(){
  const [items,setItems]=useState<Campaign[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [filter,setFilter]=useState('all');
  useEffect(()=>{fetch('/api/support/campaigns',{cache:'no-store'}).then(async response=>{const text=await response.text();let body:Campaign[]&{detail?:string};try{body=JSON.parse(text)}catch{throw new Error(`The campaign service returned an invalid response (${response.status}).`)}if(!response.ok)throw new Error(body.detail??'Campaigns could not be loaded.');setItems(body)}).catch(reason=>setError(reason.message)).finally(()=>setLoading(false))},[]);
  const categories=useMemo(()=>Array.from(new Set(items.map(item=>item.need_category))),[items]);
  const visible=filter==='all'?items:items.filter(item=>item.need_category===filter);
  const verified=items.reduce((sum,item)=>sum+Number(item.verified_amount),0);
  const supporters=items.reduce((sum,item)=>sum+item.supporter_count,0);
  return <div className="support-site support-home">
    <header className="support-header"><Link href="/support" className="support-brand"><Image src="/harambeeone-logo.png" alt="HarambeeOne" width={42} height={42}/><span><strong>Harambee Support</strong><small>Verified school giving</small></span></Link><div className="support-header-actions"><div className="support-trust"><ShieldCheck size={16}/> School-verified</div><Link href="/support-admin" className="support-school-link"><School size={16}/> School workspace</Link></div></header>
    <main>
      <section className="support-hero support-hero-new"><div><span className="support-kicker">Small gifts. Visible progress. A learner stays learning.</span><h1>Give directly to a verified school need.</h1><p>Discover real education needs, donate without creating an account, and follow every verified contribution from payment to the learner&apos;s school obligation.</p><div className="support-hero-actions"><a href="#campaigns" className="support-primary-action">Find a campaign <ArrowRight size={16}/></a><a href="#how-it-works" className="support-secondary-action">How trust works</a></div><div className="support-live-metrics"><div><strong>{money(verified)}</strong><span>verified support</span></div><div><strong>{supporters}</strong><span>confirmed contributions</span></div><div><strong>{items.length}</strong><span>school-verified campaigns</span></div></div></div><div className="support-hero-story"><div className="hero-story-mark"><HeartHandshake/></div><blockquote>“A donation becomes meaningful when a donor can see the need, the school can account for it, and the learner&apos;s dignity remains protected.”</blockquote><div className="hero-trust-row"><ShieldCheck/><span><strong>Consent before visibility</strong>A beneficiary photo and limited name appear only after guardian permission, learner assent and school safeguarding approval.</span></div></div></section>
      <section className="support-trust-strip" id="how-it-works"><article><span>01</span><LockKeyhole/><div><strong>Verified, protected identity</strong><p>Donors see a consented limited name, approved photo and registration badge; admission numbers, documents, contacts and family context stay private.</p></div></article><article><span>02</span><ReceiptText/><div><strong>Verified allocation</strong><p>A pledge changes progress only after settlement is independently verified and posted to the learner ledger.</p></div></article><article><span>03</span><CircleDollarSign/><div><strong>Transparent proof</strong><p>Receipts, outcome updates and Stellar testnet transaction evidence remain traceable without putting learner identity on-chain.</p></div></article></section>
      <section className="support-campaign-section" id="campaigns"><div className="support-section-head"><div><span>Choose where your help lands</span><h2>Urgent needs, made human.</h2></div><p>Every target comes from a live school obligation. Pending promises never inflate the green verified total.</p></div>
        <div className="support-filter-row" role="group" aria-label="Filter campaigns"><button className={filter==='all'?'active':''} onClick={()=>setFilter('all')}>All needs <b>{items.length}</b></button>{categories.map(category=><button key={category} className={filter===category?'active':''} onClick={()=>setFilter(category)}>{labels[category]??category.replaceAll('_',' ')} <b>{items.filter(item=>item.need_category===category).length}</b></button>)}</div>
        {loading&&<div className="support-state">Loading verified campaigns…</div>}{error&&<div className="support-state error">{error}</div>}{!loading&&!error&&!items.length&&<div className="support-state support-empty-state"><strong>No public campaigns yet.</strong><span>A campaign appears after consent, school review and owner approval.</span><Link href="/support-admin" className="support-primary-action">Create the first campaign <ArrowRight size={16}/></Link></div>}
        <div className="support-cards support-cards-new">{visible.map((item,index)=>{const percentage=Math.min(100,Number(item.verified_amount)/Number(item.target_amount)*100);return <article className={`support-card support-card-new ${index===0&&visible.length>2?'campaign-featured':''}`} key={item.public_code}><CampaignVisual item={item} featured={index===0}/><div className="campaign-card-body"><div className="support-card-top"><span><School/> {item.school}</span><em>{item.public_code}</em></div>{item.beneficiary&&<div className="campaign-beneficiary"><strong>{item.beneficiary.display_name}</strong><span><ShieldCheck size={15}/>{item.beneficiary.verification_label}</span></div>}<h3>{item.title}</h3><p>{item.public_summary}</p><div className="campaign-social-proof"><span><HeartHandshake/> {item.supporter_count} supporter{item.supporter_count===1?'':'s'}</span><span><CheckCircle2/> {item.update_count} update{item.update_count===1?'':'s'}</span></div><div className="support-progress"><div><i style={{width:`${percentage}%`}}/></div><span><strong>{money(item.verified_amount)}</strong><b>{Math.round(percentage)}%</b></span><small>{money(item.remaining_amount)} still needed{Number(item.pending_amount)>0?` · ${money(item.pending_amount)} pending`:''}</small></div><Link href={`/support/${item.public_code}`} className="campaign-open">See the story and donate <ArrowRight size={16}/></Link></div></article>})}</div>
      </section>
    </main><footer className="support-footer"><span>HarambeeOne</span><p>Human stories. School accountability. Privacy by consent.</p></footer>
  </div>;
}
