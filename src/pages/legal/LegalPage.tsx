import { useParams } from 'react-router-dom';
import PublicLayout from '@/components/layout/PublicLayout';

const titles: Record<string, string> = {
  privacidad: 'Política de Privacidad',
  cookies: 'Política de Cookies',
  terminos: 'Términos y Condiciones',
};

export default function LegalPage() {
  const { type } = useParams();
  const title = titles[type ?? ''] ?? 'Legal';

  return (
    <PublicLayout>
      <div className="pt-20 section-padding min-h-screen">
        <div className="container max-w-3xl">
          <h1 className="text-3xl font-bold text-primary mb-4">{title}</h1>
          <div className="w-[60px] h-[3px] bg-cta rounded-full mb-8" />
          <div className="prose max-w-none text-foreground">
            <p>Contenido de {title.toLowerCase()} — editable desde el dashboard de administración.</p>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
