import { readMenu } from '@/cms/repository';
import { MenuProvider } from '@/cms/context';
import { publicMenu } from '@/cms/schema';
import { OrderingExperience } from '@/components/checkout/OrderingExperience';
import 'maplibre-gl/dist/maplibre-gl.css';
import './order.css';
import { requestLang } from '@/i18n/request-lang';
export async function generateMetadata() {
  const ar = await requestLang() === 'ar';
  const title = ar ? 'استلام عند السيارة' : 'Car collection';
  const description = ar ? 'اختر فرع سوشينا وخصص طلبك للاستلام عند سيارتك.' : 'Choose your Sushinaa branch and build your car-collection order.';
  return { title, description, openGraph: { title, description, url: '/order' }, twitter: { title, description }, robots: { index: false, follow: false }, alternates: { canonical: '/order' } };
}
export const dynamic = 'force-dynamic';
export default async function OrderPage() {
  const { menu } = await readMenu();
  return <MenuProvider menu={publicMenu(menu)}><OrderingExperience initialNow={new Date().toISOString()} /></MenuProvider>;
}
