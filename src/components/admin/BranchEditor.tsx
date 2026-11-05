'use client';
import { useState } from 'react';
import { useLocale } from '@/i18n/locale';
import type { MenuData } from '@/cms/schema';
import { branchListSchema, type BranchSettings } from '@/branches/schema';
import { useUnsaved, saveShortcut, focusFirstInvalid } from './Fields';
const days = [ ['Sunday','الأحد'],['Monday','الاثنين'],['Tuesday','الثلاثاء'],['Wednesday','الأربعاء'],['Thursday','الخميس'],['Friday','الجمعة'],['Saturday','السبت'] ];
const clock = (n:number) => `${String(Math.floor(n%1440/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
const minute = (value:string) => { const [h,m]=value.split(':').map(Number); return h*60+m; };
export function BranchEditor({menu,onSave}:{menu:MenuData;onSave:(menu:MenuData)=>Promise<void>}) {
  const {lang}=useLocale(); const ar=lang==='ar';const text=(en:string,arabic:string)=>ar?arabic:en;
  const [draft,setDraft]=useState(()=>structuredClone(menu.branches));
  const [selected,setSelected]=useState(0);const [busy,setBusy]=useState(false);const [errors,setErrors]=useState<Record<string,string>>({});
  const [copyDay,setCopyDay]=useState(0);
  const dirty=JSON.stringify(draft)!==JSON.stringify(menu.branches);useUnsaved(dirty);
  const branch=draft[selected];
  function change(values:Partial<BranchSettings>) {setDraft(rows=>rows.map((row,i)=>i===selected?{...row,...values}:row));setErrors({});}
  function hours(day:number,key:'open'|'close'|'closed',value:string|boolean) {
    const next=branch.hours.map((session,i)=>{if(i!==day)return session;if(key==='closed')return {...session,closed:Boolean(value)};
      const open=key==='open'?minute(String(value)):session.open;
      const end=key==='close'?minute(String(value)):session.close%1440;
      return {...session,open,close:end<=open?end+1440:end};});change({hours:next});
  }
  return <form dir={ar?'rtl':'ltr'} className="branch-editor" onKeyDown={saveShortcut} onSubmit={async event=>{
    event.preventDefault();if(busy)return;const result=branchListSchema.safeParse(draft);
    if(!result.success){const next:Record<string,string>={};for(const issue of result.error.issues)next[issue.path.join('.')]=issue.message;setErrors(next);const first=result.error.issues[0];if(typeof first.path[0]==='number')setSelected(first.path[0]);focusFirstInvalid(event.currentTarget);return;}
    setBusy(true);try{await onSave({...menu,branches:result.data});setDraft(result.data);setErrors({});}catch{/* Preserve draft; Admin shows the save error. */}finally{setBusy(false);}
  }}>
    <div className="branch-editor-tabs" role="group" aria-label={text('Choose branch','اختر الفرع')}>{draft.map((row,i)=><button key={row.slug} type="button" disabled={busy} aria-pressed={selected===i} onClick={()=>{setSelected(i);setErrors({});}}>{ar?row.nameAr:row.name}</button>)}</div>
    <section className="admin-card" aria-label={text('Branch details','بيانات الفرع')}>
      <h2>{text('Branch details','بيانات الفرع')}</h2>
      <div className="admin-grid">
        {(['name','nameAr','phone'] as const).map(key=>{const label={name:text('Name in English','الاسم بالإنجليزية'),nameAr:text('Name in Arabic','الاسم بالعربية'),phone:text('Branch phone number','رقم هاتف الفرع')}[key];const error=errors[`${selected}.${key}`];const id=`branch-${key}-${branch.slug}`;
          return <label className="admin-field" key={key} htmlFor={id}><span>{label}</span><input id={id} type={key==='phone'?'tel':'text'} dir={key==='nameAr'?'rtl':'ltr'} lang={key==='nameAr'?'ar':'en'} required placeholder={key==='phone'?'+974 5507 5933':undefined} maxLength={key==='phone'?24:40} value={branch[key]} disabled={busy} aria-invalid={Boolean(error)} aria-describedby={error?`${id}-error`:undefined} onChange={event=>change({[key]:event.target.value})}/>{error&&<small id={`${id}-error`} className="admin-error">{error}</small>}</label>;
        })}
      </div>
      <p className="branch-editor-note">{text('The existing branch link and map location stay the same.','يبقى رابط الفرع وموقعه على الخريطة كما هما.')}</p>
    </section>
    <section className="admin-card branch-hours" aria-label={text('Opening hours','ساعات العمل')}>
      <header className="branch-hours-heading"><div><h2>{text('Opening hours','ساعات العمل')}</h2><p>{text('Qatar time · Closing after midnight is counted as the next day.','بتوقيت قطر · يُحتسب الإغلاق بعد منتصف الليل في اليوم التالي.')}</p></div></header>
      <div className="branch-hours-copy"><label>{text('Copy hours from','نسخ ساعات يوم')}<select aria-label={text('Copy hours from','نسخ ساعات يوم')} value={copyDay} onChange={event=>setCopyDay(Number(event.target.value))} disabled={busy}>{days.map((day,i)=><option key={i} value={i}>{day[ar?1:0]}</option>)}</select></label><button type="button" disabled={busy} onClick={()=>change({hours:branch.hours.map(()=>({...branch.hours[copyDay]}))})}>{text('Apply to all days','تطبيق على جميع الأيام')}</button></div>
      {days.map((day,i)=>{const session=branch.hours[i];const error=errors[`${selected}.hours.${i}.close`];const dayLabel=day[ar?1:0];return <fieldset className="branch-hours-day" key={`${branch.slug}-${i}`} disabled={busy}>
        <legend className="sr-only">{dayLabel}</legend>
        <strong className="branch-hours-day-name">{dayLabel}</strong>
        <label className="branch-closed"><input type="checkbox" checked={Boolean(session.closed)} onChange={event=>hours(i,'closed',event.target.checked)}/>{text('Closed','مغلق')}</label>
        <label>{text('Opens','يفتح')}<input type="time" dir="ltr" step="60" required disabled={Boolean(session.closed)} value={clock(session.open)} aria-label={`${dayLabel} ${text('opening time','وقت الفتح')}`} onChange={event=>event.target.value&&hours(i,'open',event.target.value)}/></label>
        <label>{text('Closes','يغلق')}<input type="time" dir="ltr" step="60" required disabled={Boolean(session.closed)} value={clock(session.close)} aria-invalid={Boolean(error)} aria-label={`${dayLabel} ${text('closing time','وقت الإغلاق')}`} onChange={event=>event.target.value&&hours(i,'close',event.target.value)}/>{!session.closed&&session.close>=1440&&<small>{text('Next day','اليوم التالي')}</small>}{error&&<small className="admin-error">{error}</small>}</label>
      </fieldset>;})}
    </section>
    {Object.keys(errors).length>0&&<p role="alert" className="admin-error">{text('Check the marked branch details before saving.','يرجى التحقق من بيانات الفرع المحددة قبل الحفظ.')}</p>}
    <div className="branch-editor-save"><button className="primary" disabled={busy||!dirty}>{busy?text('Saving…','جارٍ الحفظ…'):text('Save branches','حفظ الفروع')}</button><button type="button" disabled={busy||!dirty} onClick={()=>{setDraft(structuredClone(menu.branches));setErrors({});}}>{text('Discard changes','تجاهل التغييرات')}</button><span role="status">{dirty?text('Unsaved changes','تغييرات غير محفوظة'):text('All changes saved','تم حفظ جميع التغييرات')}</span></div>
  </form>;
}
