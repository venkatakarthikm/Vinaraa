import { useNavigate } from 'react-router-dom';
import { Compass, House } from 'lucide-react';
import Page from '@/components/Page';
import Button from '@/components/Button';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <Page>
      <div className="py-20 flex flex-col items-center text-center px-5 gap-3">
        <div className="w-[72px] h-[72px] rounded-full bg-surface-2 flex items-center justify-center text-muted shadow-sm">
          <Compass size={32} />
        </div>
        <h1 className="t-h1 text-[28px] font-bold text-text">Page not found</h1>
        <p className="t-body text-[15px] text-muted max-w-[280px]">
          That link doesn't lead anywhere.
        </p>
        <Button size="sm" onClick={() => navigate('/home')} className="mt-2 flex items-center gap-2">
          <House size={18} />
          <span>Go home</span>
        </Button>
      </div>
    </Page>
  );
}
