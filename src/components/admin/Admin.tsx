"use client";
import Image from "next/image";
import { configuredBranches } from "@/branches/branches";
import { OpsIcon, type OpsIconName } from "./OperationsUI";
import { LangButton } from "@/i18n/locale";
import type { OrderIntent } from "./Dashboard";
import { useLocale } from "@/i18n/locale";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  type MenuSnapshot,
  type MenuData,
  type CmsDish,
  type Category,
} from "@/cms/schema";
import { ItemEditor } from "./ItemEditor";
import { BranchEditor } from "./BranchEditor";
import { SettingsEditor } from "./SettingsEditor";
import { CategoryEditor } from "./CategoryEditor";
import { CategoryList } from "./CategoryList";
import { MenuList } from "./MenuList";
import { Dashboard } from "./Dashboard";
import { Orders } from "./Orders";
import { Payments } from "./Payments";
import { StaffPanel } from "./StaffPanel";
import { CouponsPanel } from "./CouponsPanel";
import { Activity } from "./Activity";
import type { CouponOrderOpen } from "@/ordering/coupons/linked-order";
import type { Role } from "@/cms/permissions";
import { confirmDiscard } from "./Fields";
import { useNotify } from "./Notices";
export function Admin({ initial, role, branchId }: { initial: MenuSnapshot; role: Role; branchId?: string }) {
  const { lang } = useLocale();
  const ar=lang==='ar';const text=(en:string,arabic:string)=>ar?arabic:en;
  const [branch,setBranch]=useState(role==='admin'?'':branchId??'');
  const [mobileNav,setMobileNav]=useState(false);
  const sidebar=useRef<HTMLElement>(null);
  const router=useRouter();
  useEffect(()=>{
    if(!mobileNav)return;
    const previous=document.activeElement as HTMLElement|null;
    const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
    const controls=()=>Array.from(sidebar.current?.querySelectorAll<HTMLElement>('button,a[href]')??[]).filter(el=>el.getClientRects().length);
    controls()[0]?.focus();
    const keys=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();setMobileNav(false);}
      if(event.key==='Tab'){const items=controls(),first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
    };
    document.addEventListener('keydown',keys);
    return()=>{document.removeEventListener('keydown',keys);document.body.style.overflow=overflow;previous?.focus();};
  },[mobileNav]);
  const [orderIntent,setOrderIntent]=useState<OrderIntent&{key:number}>({key:0});
  const [paymentIntent,setPaymentIntent]=useState<{orderId?:string;key:number}>({key:0});
  const labels:Record<string,[string,string,OpsIconName]>={Dashboard:['Dashboard','لوحة التحكم','dashboard'],Orders:['Orders','الطلبات المباشرة','orders'],History:['Order history','سجل الطلبات','history'],Payments:['Payments','المدفوعات','money'],Menu:['Menu','القائمة','menu'],Categories:['Categories','التصنيفات','categories'],Branches:['Branches','الفروع','branches'],Users:['Users','المستخدمون','users'],Coupons:['Coupons','القسائم','money'],Settings:['Settings','الإعدادات','settings'],Activity:['Activity','النشاط','activity']};
  const [unreadOrders, setUnreadOrders] = useState(0);
  const [snapshot, setSnapshot] = useState(initial);
  const params = useSearchParams();
  // A filtered menu link (?category=&show=&q=) opens straight on the Menu.
  const navGroups = role === "admin"
    ? [
        { id: "dashboard", label: ["Dashboard", "لوحة التحكم"] as const, items: ["Dashboard"] },
        { id: "orders", label: ["Orders", "الطلبات"] as const, items: ["Orders", "History", "Payments"] },
        { id: "menu", label: ["Menu", "القائمة"] as const, items: ["Menu", "Categories"] },
        { id: "admin", label: ["Admin", "الإدارة"] as const, items: ["Branches", "Users", "Coupons", "Settings", "Activity"] },
      ]
    : [
        { id: "dashboard", label: ["Dashboard", "لوحة التحكم"] as const, items: ["Dashboard"] },
        { id: "orders", label: ["Orders", "الطلبات"] as const, items: ["Orders", "History"] },
      ];
  const [section, setSection] = useState(() =>
    role !== "admin" ? "Orders" : ["category", "show", "q"].some((k) => params.has(k)) ? "Menu" : "Dashboard",
  );
  const [item, setItem] = useState<CmsDish | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [busy, setBusy] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [creatingCoupon, setCreatingCoupon] = useState(false);
  const notify = useNotify();
  const { menu } = snapshot;
  const branchRows=configuredBranches(menu.branches);
  const selectedBranch=branchRows.find(b=>b.slug===branch);
  function openOrders(intent:OrderIntent={},nextBranch?:string){if(!confirmDiscard())return;if(nextBranch!==undefined)setBranch(nextBranch);setOrderIntent(previous=>({...intent,key:previous.key+1}));setSection(intent.view==='history'?'History':'Orders');}
  function openCouponLinked(target:CouponOrderOpen){
    if(!confirmDiscard())return;
    if(target.section==='payments'){
      setPaymentIntent(previous=>({orderId:target.orderId,key:previous.key+1}));
      setSection('Payments');
      return;
    }
    // Clear branch filter so a Downtown order is not hidden under Al Thumama.
    setBranch('');
    setOrderIntent(previous=>({orderId:target.orderId,view:target.view,key:previous.key+1}));
    setSection(target.view==='history'?'History':'Orders');
  }
  function navigate(next:string){if(next===section){setMobileNav(false);return;}if(!confirmDiscard())return;setSection(next);setCreatingUser(false);setCreatingCoupon(false);setMobileNav(false);if(next==='Orders'||next==='History')setOrderIntent(previous=>({key:previous.key+1}));if(next==='Payments')setPaymentIntent(previous=>({key:previous.key+1}));}
  const categories = [...menu.categories].sort((a, b) => a.order - b.order);
  async function save(next: MenuData) {
    if (busy) throw new Error("Please wait for the current save.");
    setBusy(true);
    try {
      const r = await fetch("/api/admin/menu", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ menu: next, revision: snapshot.revision }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Unable to save");
      setSnapshot(data);
      notify({ tone: "ok", text: "Changes saved" });
    } catch (e) {
      const text = e instanceof Error ? e.message : "Unable to save";
      notify({
        tone: "error",
        text: `Couldn’t save: ${text}. Your edits are still here.`,
        action: text.includes("Reload before saving")
          ? { label: "Reload", onClick: () => window.location.reload() }
          : undefined,
      });
      throw e;
    } finally {
      setBusy(false);
    }
  }
  async function run(next: MenuData) {
    try {
      await save(next);
    } catch {
      // The toast already says the edits are still here.
    }
  }
  function newItem(id = categories[0]?.id) {
    if (!id) {
      setSection("Categories");
      notify({ tone: "ok", text: "Create a category first" });
      return;
    }
    setItem({
      id: "",
      name: "",
      nameAr: "",
      section: id,
      description: "",
      descriptionAr: "",
      image: "",
      imageAlt: "",
      imageAltAr: "",
      tags: [],
      kind: { type: "simple", priceQar: 0 },
      order:
        Math.max(
          -1,
          ...menu.dishes.filter((d) => d.section === id).map((d) => d.order),
        ) + 1,
      visible: true,
      available: true,
    });
  }
  const sorted = (id: string) =>
    menu.dishes
      .filter((d) => d.section === id)
      .sort((a, b) => a.order - b.order);
  return (
    <div className={`admin-workspace${mobileNav?' nav-open':''}`} dir={ar?'rtl':'ltr'} lang={lang}>
      {mobileNav&&<button className="ops-nav-backdrop" aria-label={text('Close navigation','إغلاق التنقل')} onClick={()=>setMobileNav(false)}/>}
      <aside ref={sidebar} className="admin-sidebar" aria-label={text('Administration navigation','التنقل الإداري')}>
        <div className="ops-sidebar-brand"><span><Image src={menu.settings.logo} alt="" width={48} height={48} unoptimized/></span><div><strong>{ar?menu.settings.nameAr:menu.settings.name}</strong><small>{text('OPERATIONS','إدارة العمليات')}</small></div><button className="ops-mobile-close" aria-label={text('Close navigation','إغلاق التنقل')} onClick={()=>setMobileNav(false)}><OpsIcon name="close"/></button></div>
        <nav className="ops-sidebar-nav">{navGroups.map(group=><div key={group.id} className="ops-nav-group">
          {group.id!=='dashboard'?<span className="ops-sidebar-label">{text(group.label[0],group.label[1])}</span>:null}
          {group.items.map(s=><button key={s} className={section===s?'active':''} aria-current={section===s?'page':undefined} aria-label={labels[s][ar?1:0]} onClick={()=>navigate(s)}>
            <OpsIcon name={labels[s][2]}/><span>{labels[s][ar?1:0]}</span>{s==='Orders'&&<span className={unreadOrders?'staff-unread':'ops-nav-live'} aria-hidden="true">{unreadOrders||text('Live','مباشر')}</span>}
          </button>)}
        </div>)}</nav>
        <div className="ops-sidebar-bottom">
          <a href="/" target="_blank" rel="noreferrer"><OpsIcon name="menu" size={17}/>{text('View public menu','عرض قائمة العملاء')}<OpsIcon name="arrow" size={15}/></a>
          <button onClick={async()=>{if(!confirmDiscard())return;try{const r=await fetch('/api/admin/session',{method:'DELETE'});if(!r.ok)throw Error('Unable to sign out');router.push('/admin/login');router.refresh();}catch(e){notify({tone:'error',text:e instanceof Error?e.message:'Unable to sign out'});}}}><OpsIcon name="logout" size={17}/>{text('Sign out','تسجيل الخروج')}</button>
        </div>
      </aside>
      <div className="admin-main">
        <header className="ops-topbar"><div><button className="ops-mobile-menu" aria-label={text('Open navigation','فتح التنقل')} aria-expanded={mobileNav} onClick={()=>setMobileNav(true)}><OpsIcon name="hamburger"/></button><span className="ops-breadcrumb">{ar?menu.settings.nameAr:menu.settings.name}<span>/</span><strong>{labels[section][ar?1:0]}</strong></span></div><div className="ops-topbar-controls">
          {role==='admin'?<label className="ops-global-branch"><OpsIcon name="branches" size={18}/><select aria-label={text('Order branch','فرع الطلب')} value={branch} onChange={e=>{if(confirmDiscard())setBranch(e.target.value);}}><option value="">{text('All branches','جميع الفروع')}</option>{branchRows.map(b=><option value={b.slug} key={b.slug}>{ar?b.nameAr:b.name}</option>)}</select></label>:<span className="ops-branch-fixed"><OpsIcon name="branches" size={17}/>{selectedBranch?(ar?selectedBranch.nameAr:selectedBranch.name):text('Your branch','فرعك')}</span>}
          <LangButton tone="light"/>
        </div></header>
        <main className="admin-content">
          <div className="admin-heading">
            <div><h1>{section==='Menu'?text('Your menu','قائمتك'):section==='Orders'?text('Live orders','الطلبات المباشرة'):labels[section][ar?1:0]}</h1></div>
            {section === "Menu" && (
              <button className="primary" onClick={() => newItem()}>
                {text("Add item","إضافة صنف")}
              </button>
            )}
            {section === "Categories" && (
              <button
                className="primary"
                onClick={() =>
                  setCategory({
                    id: "",
                    name: "",
                    nameAr: "",
                    order: Math.max(-1, ...categories.map((c) => c.order)) + 1,
                    visible: true,
                    featured: false,
                  })
                }
              >
                {text("Add category","إضافة تصنيف")}
              </button>
            )}
            {section === "Users" && role === "admin" && (
              <button className="primary" type="button" onClick={() => setCreatingUser(true)}>
                {lang === "ar" ? "إنشاء مستخدم جديد" : "Create new user"}
              </button>
            )}
            {section === "Coupons" && role === "admin" && (
              <button className="primary" type="button" onClick={() => setCreatingCoupon(true)}>
                {text("Create coupon", "إنشاء قسيمة")}
              </button>
            )}
          </div>
          {section === "Dashboard" && (
            <Dashboard
              menu={menu}
              onEdit={setItem}
              onMenu={() => setSection("Menu")}
              onOrders={openOrders} onBranches={()=>setSection('Branches')} branch={branch} role={role}
            />
          )}
          {section === "Menu" && (
            <MenuList
              menu={menu}
              busy={busy}
              onAdd={newItem}
              onEdit={setItem}
              onEditCategory={setCategory}
              onChange={run}
            />
          )}
          {section === "Categories" && (
            <CategoryList
              menu={menu}
              busy={busy}
              onEdit={setCategory}
              onChange={run}
            />
          )}
          <Orders active={section === "Orders" || section === "History"} view={section==='History'?'history':'active'} branch={branch} intent={orderIntent} onUnread={setUnreadOrders} role={role} menu={menu} />
          {role === "admin" && <Payments active={section === "Payments"} intent={paymentIntent} />}
          {section === "Users" && role === "admin" && <StaffPanel menu={menu} creating={creatingUser} onCreating={setCreatingUser} />}
          {section === "Coupons" && role === "admin" && <CouponsPanel creating={creatingCoupon} onCreating={setCreatingCoupon} onOpenLinked={openCouponLinked} />}
          {section === "Branches" && role === "admin" && <BranchEditor menu={menu} onSave={save} />}
          {section === "Activity" && <Activity />}
          {section === "Settings" && role === "admin" && (
            <SettingsEditor key={snapshot.revision} menu={menu} onSave={save} />
          )}
        </main>
      </div>
      {item && (
        <ItemEditor
          key={item.id}
          item={item}
          categories={categories}
          dishes={menu.dishes}
          currency={menu.settings.currencyEn}
          onClose={() => setItem(null)}
          onSave={async (d) => {
            const previous = menu.dishes.find((x) => x.id === d.id);
            if (!previous || previous.section !== d.section)
              d.order =
                Math.max(-1, ...sorted(d.section).map((x) => x.order)) + 1;
            await save({
              ...menu,
              dishes: previous
                ? menu.dishes.map((x) => (x.id === d.id ? d : x))
                : [...menu.dishes, d],
            });
          }}
        />
      )}
      {category && (
        <CategoryEditor
          key={category.id}
          category={category}
          taken={menu.categories.map((c) => c.id)}
          onClose={() => setCategory(null)}
          onSave={async (c) => {
            await save({
              ...menu,
              categories: menu.categories.some((x) => x.id === c.id)
                ? menu.categories.map((x) => (x.id === c.id ? c : x))
                : [...menu.categories, c],
            });
          }}
        />
      )}
    </div>
  );
}
