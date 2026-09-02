import { useState, useEffect, useCallback } from 'react';
import { CompanyProfile, UtilityCompany } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export const LOCAL_STORAGE_COMPANY_KEY = 'solarcad_company_profile';

export const DEFAULT_COMPANY_PROFILE: CompanyProfile = {
  companyName: '',
  tradeName: '',
  cnpj: '',
  stateRegistration: '',
  email: '',
  phone: '',
  address: {
    street: '',
    number: '',
    neighborhood: '',
    city: '',
    state: 'RJ',
    zipCode: '',
  },
  legalRepresentative: {
    name: '',
    cpf: '',
    rg: '',
    rgIssuer: 'DETRAN/RJ',
    qualification: 'Engenheiro Eletricista',
    creaCft: '',
    creaState: 'RJ',
    rnp: '',
    email: '',
    phone: '',
  },
  defaultUtility: UtilityCompany.LIGHT,
  defaultArtType: 'OBRA_SERVICO',
};

// --- Funções de Máscara e Formatação ---

export function formatCNPJ(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
}

export function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

export function formatCEP(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`;
}

/**
 * Consulta dados cadastrais de Pessoa Jurídica via BrasilAPI
 */
export async function fetchCNPJData(rawCnpj: string): Promise<{
  companyName: string;
  tradeName: string;
  email: string;
  phone: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
} | null> {
  const cleanCnpj = rawCnpj.replace(/\D/g, '');
  if (cleanCnpj.length !== 14) return null;

  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
    if (!res.ok) return null;
    const data = await res.json();

    return {
      companyName: data.razao_social || '',
      tradeName: data.nome_fantasia || data.razao_social || '',
      email: data.email || '',
      phone: data.ddd_telefone_1 ? formatPhone(data.ddd_telefone_1) : '',
      street: `${data.descricao_tipo_de_logradouro || ''} ${data.logradouro || ''}`.trim(),
      number: data.numero || '',
      neighborhood: data.bairro || '',
      city: data.municipio || '',
      state: data.uf || 'RJ',
      zipCode: data.cep ? formatCEP(data.cep) : '',
    };
  } catch (err) {
    console.error('Erro ao consultar CNPJ:', err);
    return null;
  }
}

export const useCompanyProfile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<CompanyProfile>(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_COMPANY_KEY);
      if (stored) {
        return { ...DEFAULT_COMPANY_PROFILE, ...JSON.parse(stored) };
      }
    } catch {}
    return DEFAULT_COMPANY_PROFILE;
  });
  const [loading, setLoading] = useState(false);

  // Sincroniza do Supabase quando o usuário estiver autenticado
  useEffect(() => {
    if (!user) return;

    let mounted = true;
    const loadFromCloud = async () => {
      try {
        const { data, error } = await supabase
          .from('company_profiles' as any)
          .select('data')
          .eq('user_id', user.id)
          .maybeSingle();

        if (data && (data as any).data && mounted) {
          const cloudData = (data as any).data as CompanyProfile;
          setProfile(prev => {
            const merged = { ...prev, ...cloudData };
            localStorage.setItem(LOCAL_STORAGE_COMPANY_KEY, JSON.stringify(merged));
            return merged;
          });
        }
      } catch {
        // Fallback silencioso para offline/localStorage
      }
    };

    loadFromCloud();
    return () => {
      mounted = false;
    };
  }, [user]);

  const saveProfile = useCallback(async (newProfile: CompanyProfile) => {
    setProfile(newProfile);
    localStorage.setItem(LOCAL_STORAGE_COMPANY_KEY, JSON.stringify(newProfile));

    // Se houver engenheiro no profile, atualiza também a compatibilidade solar_engineer_profile
    if (newProfile.legalRepresentative?.name || newProfile.legalRepresentative?.creaCft) {
      localStorage.setItem('solar_engineer_profile', JSON.stringify({
        name: newProfile.legalRepresentative.name,
        crea: `${newProfile.legalRepresentative.creaCft}/${newProfile.legalRepresentative.creaState}`,
      }));
    }

    if (user) {
      setLoading(true);
      try {
        await supabase
          .from('company_profiles' as any)
          .upsert({
            user_id: user.id,
            data: newProfile as any,
            updated_at: new Date().toISOString(),
          } as any, { onConflict: 'user_id' });
      } catch (err) {
        console.warn('Persistência na nuvem ignorada ou offline:', err);
      } finally {
        setLoading(false);
      }
    }
  }, [user]);

  return {
    profile,
    saveProfile,
    loading,
  };
};
