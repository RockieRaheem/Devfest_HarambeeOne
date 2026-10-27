'use client';

import { BellOff, BellRing } from 'lucide-react';
import { useEffect, useState } from 'react';
import { disablePush, enablePush, pushState, type PushState } from '@/lib/firebase/messaging';

const labels: Record<PushState, string> = {
  checking: 'Checking push…',
  unsupported: 'Push unavailable',
  prompt: 'Enable push',
  enabled: 'Push enabled',
  denied: 'Push blocked',
  error: 'Retry push',
};

export default function PushNotificationControl() {
  const [state, setState] = useState<PushState>('checking');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const handlePushError = () => setState('error');
    let noticeTimer: number | undefined;
    const handlePush = () => {
      setNotice('A secure update arrived. Open Updates for details.');
      window.clearTimeout(noticeTimer);
      noticeTimer = window.setTimeout(() => setNotice(''), 8000);
    };
    window.addEventListener('harambee:push-error', handlePushError);
    window.addEventListener('harambee:push', handlePush);
    void pushState().then(setState);
    return () => {
      window.clearTimeout(noticeTimer);
      window.removeEventListener('harambee:push-error', handlePushError);
      window.removeEventListener('harambee:push', handlePush);
    };
  }, []);

  async function toggle(allDevices = false) {
    if (busy || ['unsupported', 'denied'].includes(state)) return;
    setBusy(true);
    setError('');
    try { setState(state === 'enabled' ? await disablePush(allDevices) : await enablePush()); }
    catch (reason) {
      setState('error');
      setError(reason instanceof Error ? reason.message : 'Push registration failed.');
    }
    finally { setBusy(false); }
  }

  const disabled = busy || ['checking', 'unsupported', 'denied'].includes(state);
  const title = state === 'denied'
    ? 'Allow notifications in your browser settings. In-app updates still work.'
    : error || undefined;
  return <span className="push-controls"><button type="button" className="push-control" onClick={()=>void toggle()} disabled={disabled}
    title={title} aria-describedby={error ? 'push-registration-error' : undefined}>
    {state === 'enabled' ? <BellOff size={14}/> : <BellRing size={14}/>}<span>{busy ? 'Updating…' : labels[state]}</span>
  </button>{state==='enabled'&&<button type="button" className="push-all" onClick={()=>void toggle(true)} disabled={busy}>Disable all devices</button>}{error&&<small className="push-error" id="push-registration-error" role="alert">{error}</small>}{notice&&<small className="push-confirmation" role="status">{notice}</small>}</span>;
}
