'use client';

import Link from 'next/link';
import { Bell, CheckCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { clientFetch as fetch } from '@/lib/api/client';

type Notification = {id:string;title:string;body:string;href:string;created_at:string;read:boolean};

export function NotificationIndicator() {
  const [unread,setUnread]=useState(0);
  const load=useCallback(async()=>{const response=await fetch('/api/backend/api/v1/notifications?limit=100');if(!response.ok)return;const body=await response.json();setUnread(body.unread_count);},[]);
  useEffect(()=>{void load();const handler=()=>void load();window.addEventListener('harambee:push',handler);return()=>window.removeEventListener('harambee:push',handler);},[load]);
  return <Link className="notification-indicator" href="/notifications" aria-label={unread?`Updates, ${unread} unread`:'Updates'}><Bell size={18}/><span>Updates</span>{unread>0&&<b>{unread>99?'99+':unread}</b>}</Link>;
}

export default function NotificationCenter() {
  const [items,setItems]=useState<Notification[]>([]),[unread,setUnread]=useState(0);
  const [loading,setLoading]=useState(true),[error,setError]=useState('');
  const load=useCallback(async()=>{setError('');try{const response=await fetch('/api/backend/api/v1/notifications?limit=100');if(!response.ok)throw new Error();const body=await response.json();setItems(body.items);setUnread(body.unread_count);}catch{setError('Updates could not be loaded. Please try again.');}finally{setLoading(false);}},[]);
  const [pushNotice,setPushNotice]=useState(false);
  useEffect(()=>{void load();const handler=()=>{setPushNotice(true);void load();};window.addEventListener('harambee:push',handler);return()=>window.removeEventListener('harambee:push',handler);},[load]);
  async function markRead(item:Notification){if(!item.read)await fetch(`/api/backend/api/v1/notifications/${item.id}/read`,{method:'POST'});await load();}
  async function markAll(){await fetch('/api/backend/api/v1/notifications/read-all',{method:'POST'});await load();}
  return <section className="notification-center" aria-label="Notifications"><header><div><Bell size={18}/><h1>Updates</h1>{unread>0&&<span>{unread} new</span>}</div>{unread>0&&<button type="button" onClick={markAll}><CheckCheck size={15}/>Mark all read</button>}</header>{pushNotice&&<p className="push-arrived" role="status">A new secure update has arrived.</p>}{error?<div className="notification-empty" role="alert">{error}<button type="button" onClick={()=>void load()}>Try again</button></div>:loading?<p className="notification-empty">Loading updates…</p>:items.length?<div className="notification-list">{items.map(item=><Link key={item.id} href={item.href} className={item.read?'read':''} onClick={()=>void markRead(item)}><span aria-hidden="true"/><div><strong>{item.title}</strong><p>{item.body}</p><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString('en-UG')}</time></div></Link>)}</div>:<p className="notification-empty">No updates yet. Important activity will appear here.</p>}</section>;
}
